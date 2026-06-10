import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const message = String(body.message || "").trim();
    const whatsappAccounts: number[] = Array.isArray(body.whatsappAccounts)
      ? body.whatsappAccounts
      : [1];

    const targetDays = Number(body.targetDays || 1);

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Mensagem obrigatória." },
        { status: 400 }
      );
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - targetDays);

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .in("status", ["enviado", "campanha"])
      .eq("ai_paused", false)
      .eq("opt_out", false)
      .lte("last_message_at", cutoff.toISOString())
      .lt("campaign_step", 7)
      .limit(300);

    if (error) throw new Error(error.message);

    const { data: campaign } = await supabase
      .from("promotion_campaigns")
      .insert({
        name: `Campanha ${targetDays} dia(s) parado`,
        message,
        whatsapp_accounts: whatsappAccounts,
        target_days: targetDays,
        total_queued: leads?.length || 0,
      })
      .select()
      .single();

    let queued = 0;

    for (const lead of leads || []) {
      const account = whatsappAccounts[queued % whatsappAccounts.length] || 1;
      const step = Number(lead.campaign_step || 0) + 1;

      await supabase.from("automation_queue").insert({
        lead_id: lead.id,
        phone: lead.phone,
        session_id: account,
        message,
        type: "campaign",
        status: "pending",
        scheduled_at: new Date().toISOString(),
      });

      await supabase
        .from("leads")
        .update({
          status: step >= 7 ? "reativar_futuro" : "campanha",
          campaign_step: step,
          last_campaign_at: new Date().toISOString(),
          reactivation_at:
            step >= 7
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              : null,
        })
        .eq("id", lead.id);

      queued++;
    }

    return NextResponse.json({
      success: true,
      campaign,
      queued,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao enviar campanha.",
      },
      { status: 500 }
    );
  }
}