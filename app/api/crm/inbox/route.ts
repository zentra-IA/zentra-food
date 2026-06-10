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

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    if (leadId) {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (leadError) throw new Error(leadError.message);

      if (!lead) {
        return NextResponse.json([]);
      }

      await supabase
        .from("leads")
        .update({
          unread_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id)
        .eq("company_id", companyId);

      const { data: samePhoneLeads } = await supabase
        .from("leads")
        .select("id")
        .eq("company_id", companyId)
        .eq("phone", lead.phone);

      const leadIds = (samePhoneLeads || []).map((item: any) => item.id);

      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("*")
        .in("lead_id", leadIds.length ? leadIds : [lead.id])
        .order("created_at", { ascending: true });

      if (msgError) throw new Error(msgError.message);

      const finalMessages = [...(messages || [])];

      if (
        lead.last_message &&
        !finalMessages.some(
          (msg: any) =>
            String(msg.content || "").trim() ===
            String(lead.last_message || "").trim()
        )
      ) {
        finalMessages.push({
          id: `fallback-${lead.id}`,
          lead_id: lead.id,
          direction: "received",
          content: lead.last_message,
          created_at:
            lead.last_message_at || lead.updated_at || lead.created_at,
        });
      }

      finalMessages.sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );

      return NextResponse.json(finalMessages);
    }

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .in("status", [
        "respondido",
        "interesse",
        "pedido",
        "campanha",
        "reativar_futuro",
        "finalizado",
        "sem_interesse",
      ])
      .order("last_message_at", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(100);

    if (error) throw new Error(error.message);

    return NextResponse.json(
      (data || []).map((lead: any) => ({
        ...lead,
        unread_count: lead.unread_count || 0,
        latest_received_at:
          lead.last_message_at || lead.updated_at || lead.created_at,
      }))
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar inbox" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);

    const body = await req.json();

    const leadId = String(body?.leadId || "");
    const action = String(body?.action || "");
    const aiPaused = Boolean(body?.ai_paused);

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId obrigatório" },
        { status: 400 }
      );
    }

    if (action === "mark_read") {
      const { error } = await supabase
        .from("leads")
        .update({
          unread_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("company_id", companyId);

      if (error) throw new Error(error.message);

      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from("leads")
      .update({
        ai_paused: aiPaused,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar lead" },
      { status: 500 }
    );
  }
}