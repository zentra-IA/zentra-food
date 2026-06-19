import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCompanyId } from "@/lib/server-company";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

function clean(value: any) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(value: any) {
  const phone = clean(value);
  if (!phone) return "";
  if (phone.startsWith("55")) return phone;
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;
  return phone;
}

function normalizeLid(value: any) {
  if (!value) return null;
  const raw = String(value);
  if (raw.includes("@lid")) return raw;
  const cleaned = clean(raw);
  return cleaned ? `${cleaned}@lid` : null;
}

function buildSession(companyId: string, sessionId: string | number) {
  return `${companyId}_${sessionId || 1}`;
}

export async function POST(req: NextRequest) {
  try {
    const companyId =
      getCompanyId(req) ||
      process.env.DEFAULT_COMPANY_ID ||
      "41edd938-3eb4-420e-9675-2e53703ed70b";

    const body = await req.json();

    const contactId = body.contactId || body.leadId || body.id;
    const message = String(body.message || "").trim();
    const sessionId = body.sessionId || body.session_id || "1";

    if (!contactId || !message) {
      return NextResponse.json(
        { success: false, error: "contactId/leadId e message obrigatórios" },
        { status: 400 }
      );
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", contactId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !lead) {
      return NextResponse.json(
        { success: false, error: "Lead não encontrado nesta empresa" },
        { status: 404 }
      );
    }

    const finalSession = buildSession(
      companyId,
      sessionId || lead.session_id || 1
    );

    const lid = normalizeLid(lead.whatsapp_lid || lead.remote_jid);
    const phone = lid ? "" : normalizePhone(lead.phone || "");

    if (!phone && !lid) {
      return NextResponse.json(
        { success: false, error: "Lead sem telefone ou LID válido" },
        { status: 400 }
      );
    }

    const response = await fetch(`${WHATSAPP_SERVER}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: finalSession,
        number: phone,
        phone,
        lid,
        jid: lid,
        message,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Falha ao enviar pelo WhatsApp",
          result,
        },
        { status: 500 }
      );
    }

    await supabase.from("messages").insert({
      lead_id: lead.id,
      direction: "sent",
      topic: "whatsapp",
      extension: "text",
      content: message,
      event: "manual_message_sent",
      payload: {
        jid: result.jid || null,
        message_id: result.messageId || null,
      },
      created_at: new Date().toISOString(),
    });

    await supabase
      .from("leads")
      .update({
        status: lead.status === "novo" ? "respondido" : lead.status,
        last_message: message,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      sessionId: finalSession,
      phone,
      lid,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao enviar WhatsApp",
      },
      { status: 500 }
    );
  }
}