import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCompany } from "@/lib/server-company";

const MAX_PER_SESSION_DAY = 30;

const CAMPAIGN_TYPES: Record<string, string[]> = {
  FOLLOW_UP: ["enviado"],
  REATIVACAO: ["respondido", "interesse", "campanha", "reativar_futuro"],
  POS_VENDA: ["pedido", "finalizado"],
  RECUPERACAO: ["respondido", "interesse"],
};

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getLastDate(lead: any) {
  return lead.last_message_at || lead.updated_at || lead.created_at;
}

function daysStopped(lead: any) {
  const date = getLastDate(lead);
  if (!date) return 0;

  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type") || "FOLLOW_UP";
    const targetDays = Number(searchParams.get("targetDays") || 1);
    const sessions = String(searchParams.get("sessions") || "1,2,3,4,5")
      .split(",")
      .map(Number)
      .filter(Boolean);

    const statuses = CAMPAIGN_TYPES[type] || CAMPAIGN_TYPES.FOLLOW_UP;

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .in("status", statuses)
      .order("updated_at", { ascending: true });

    if (error) throw new Error(error.message);

    const leads = (data || []).filter((lead) => {
      if (!lead.phone) return false;
      if (lead.ai_paused === true) return false;
      if (lead.paused === true) return false;
      if (!sessions.includes(Number(lead.session_id || 1))) return false;
      return daysStopped(lead) >= targetDays;
    });

    return NextResponse.json(leads);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao carregar campanha" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const campaignType = String(body.campaignType || "FOLLOW_UP");
    const targetDays = Number(body.targetDays || 1);
    const selectedWpp: number[] = Array.isArray(body.selectedWpp)
      ? body.selectedWpp.map(Number)
      : [1, 2, 3, 4, 5];

    const statuses = CAMPAIGN_TYPES[campaignType] || CAMPAIGN_TYPES.FOLLOW_UP;

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .in("status", statuses)
      .order("updated_at", { ascending: true });

    if (error) throw new Error(error.message);

    const eligible = (leads || []).filter((lead) => {
      if (!lead.phone) return false;
      if (lead.ai_paused === true) return false;
      if (lead.paused === true) return false;
      if (!selectedWpp.includes(Number(lead.session_id || 1))) return false;
      return daysStopped(lead) >= targetDays;
    });

    if (!eligible.length) {
      return NextResponse.json(
        { error: "Nenhum contato elegível para esta campanha" },
        { status: 400 }
      );
    }

    const { data: campaign } = await supabase
      .from("promotion_campaigns")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        message: campaignType,
        whatsapp_accounts: selectedWpp,
        status: "running",
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    let queued = 0;
    let scheduledAt = new Date();

    for (const lead of eligible) {
      const session = Number(lead.session_id || 1);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("automation_queue")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("session_id", session)
        .in("status", ["pending", "sent"])
        .gte("scheduled_at", today.toISOString());

      if ((count || 0) >= MAX_PER_SESSION_DAY) continue;

      const { error: queueError } = await supabase
        .from("automation_queue")
        .insert({
          company_id: companyId,
          branch_id: branchId || null,
          lead_id: lead.id,
          phone: lead.phone,
          session_id: session,
          campaign_id: campaign?.id || null,
          type: "campaign",
          intent: campaignType,
          status: "pending",
          paused: false,
          scheduled_at: scheduledAt.toISOString(),
          created_at: new Date().toISOString(),
          attempts: 0,
        });

      if (!queueError) {
        queued++;

        await supabase
          .from("leads")
          .update({
            status:
              campaignType === "FOLLOW_UP"
                ? "campanha"
                : campaignType === "REATIVACAO"
                ? "reativar_futuro"
                : campaignType === "POS_VENDA"
                ? "finalizado"
                : "campanha",
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("company_id", companyId);

        scheduledAt = new Date(
          scheduledAt.getTime() + randomDelay(120000, 300000)
        );
      }
    }

    return NextResponse.json({
      success: true,
      queued,
      campaign,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao iniciar campanha" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const body = await req.json();

    const action = String(body.action || "");

    if (!["pause", "resume"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("automation_queue")
      .update({ paused: action === "pause" })
      .eq("company_id", companyId)
      .eq("status", "pending")
      .select("id");

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar campanha" },
      { status: 500 }
    );
  }
}