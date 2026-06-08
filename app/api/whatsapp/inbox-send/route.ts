import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCompany } from "@/lib/server-company";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

function clean(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = requireCompany(req);

    const body = await req.json();

    const leadId = String(body?.leadId || "").trim();
    const message = String(body?.message || "").trim();

    if (!leadId || !message) {
      return NextResponse.json(
        { success: false, error: "leadId e message obrigatórios" },
        { status: 400 }
      );
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("company_id", companyId)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { success: false, error: "Lead não encontrado nesta empresa" },
        { status: 404 }
      );
    }

    const phone = clean(lead.phone || "");
    const lid = lead.whatsapp_lid ? clean(lead.whatsapp_lid) : null;
    const sessionId = String(lead.session_id || 1);

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Lead sem telefone" },
        { status: 400 }
      );
    }

    const res = await fetch(`${WHATSAPP_SERVER}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        number: phone,
        message,
        lid,
        isLid: Boolean(lid),
      }),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || result.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: result?.error || "Erro ao enviar no WhatsApp",
          result,
        },
        { status: 500 }
      );
    }

    await supabase.from("messages").insert({
      company_id: companyId,
      branch_id: branchId || null,
      lead_id: lead.id,
      direction: "sent",
      content: message,
      created_at: new Date().toISOString(),
    });

    await supabase
      .from("leads")
      .update({
        status: "respondido",
        last_message: message,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("ERRO INBOX SEND:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao enviar mensagem",
      },
      { status: 500 }
    );
  }
}