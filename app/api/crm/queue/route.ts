import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

const ALLOWED_INTENTS = [
  "OPENING",
  "REATIVACAO",
  "POS_VENDA",
  "RECUPERACAO",
  "CARDAPIO",
  "PROMOCAO",
  "PEDIDO",
  "ENTREGA",
  "PAGAMENTO",
  "HORARIO",
  "ENDERECO",
];

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const leadId = String(body?.lead_id || "").trim();
    const intent = String(body?.intent || "OPENING").trim();
    const sessionId = Number(body?.session_id || 1);

    if (!leadId) {
      return NextResponse.json(
        { error: "lead_id é obrigatório" },
        { status: 400 }
      );
    }

    if (!ALLOWED_INTENTS.includes(intent)) {
      return NextResponse.json({ error: "Intent inválida" }, { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (leadError) throw new Error(leadError.message);

    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado nesta empresa" },
        { status: 404 }
      );
    }

    if (!lead.phone) {
      return NextResponse.json({ error: "Lead sem telefone" }, { status: 400 });
    }

    const { data: item, error: queueError } = await supabase
      .from("automation_queue")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        lead_id: lead.id,
        phone: lead.phone,
        session_id: Number.isNaN(sessionId) ? 1 : sessionId,
        type: "campaign",
        intent,
        status: "pending",
        scheduled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        attempts: 0,
      })
      .select("*")
      .single();

    if (queueError) throw new Error(queueError.message);

    await supabase
      .from("leads")
      .update({
        status: intent === "OPENING" ? "enviado" : "campanha",
        conversation_stage: intent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao adicionar na fila" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);
    const body = await req.json();

    const action = String(body?.action || "").trim();

    if (!["pause", "resume"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const currentStatus = action === "pause" ? "pending" : "paused";
    const nextStatus = action === "pause" ? "paused" : "pending";

    const { data, error } = await supabase
      .from("automation_queue")
      .update({ status: nextStatus })
      .eq("company_id", companyId)
      .eq("status", currentStatus)
      .select("id");

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar fila" },
      { status: 500 }
    );
  }
}