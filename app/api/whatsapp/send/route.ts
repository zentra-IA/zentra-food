import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCompanyId } from "@/lib/server-company";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

function clean(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(value: string) {
  const phone = clean(value);
  if (!phone) return "";
  if (phone.startsWith("55")) return phone;
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;
  return phone;
}

function buildSession(companyId: string, sessionId: string) {
  return `${companyId}_${sessionId}`;
}

export async function POST(req: NextRequest) {
  try {
    const companyId =
      getCompanyId(req) ||
      process.env.DEFAULT_COMPANY_ID ||
      "b7336aa2-345d-4624-8141-0ea0de084c3d";

    const body = await req.json();

    const { contactId, message, sessionId } = body;

    if (!contactId || !message) {
      return NextResponse.json(
        { success: false, error: "contactId e message obrigatórios" },
        { status: 400 }
      );
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .eq("company_id", companyId)
      .single();

    if (error || !contact) {
      return NextResponse.json(
        { success: false, error: "Contato não encontrado nesta empresa" },
        { status: 404 }
      );
    }

    const rawSession =
      sessionId ||
      contact.session_id ||
      contact.whatsapp_session ||
      contact.sessionId ||
      "1";

    const finalSession = buildSession(companyId, String(rawSession));

    const phone =
      contact.telefone ||
      contact.phone ||
      contact.number ||
      contact.whatsapp ||
      "";

    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone) {
      return NextResponse.json(
        { success: false, error: "Contato sem telefone" },
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
        number: cleanPhone,
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
      company_id: companyId,
      contact_id: contact.id,
      direction: "sent",
      content: message,
      created_at: new Date().toISOString(),
    });

    await supabase
      .from("contacts")
      .update({
        status: "abordado",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", contact.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      sessionId: rawSession,
      phone: cleanPhone,
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