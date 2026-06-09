import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase não configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

function cleanPhone(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function getFirstName(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  return clean.split(" ")[0];
}

function formatWhatsAppPhone(phone: string) {
  const clean = cleanPhone(phone);
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min = 35000, max = 90000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendWhatsApp({
  sessionId,
  number,
  message,
}: {
  sessionId: number;
  number: string;
  message: string;
}) {
  const res = await fetch(`${WHATSAPP_SERVER}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: String(sessionId),
      number,
      message,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Erro ao enviar WhatsApp");
  }

  return data;
}

function buildOpeningMessage(contact: any) {
  const firstName = getFirstName(contact.nome || contact.name || "tudo bem");

  const openings = [
    `oi ${firstName} tudo bem?`,
    `oie ${firstName} tudo certo?`,
    `oiii ${firstName} como vai?`,
    `olá ${firstName} tudo bem?`,
    `oi ${firstName} beleza?`,
    `oie ${firstName} tranquilo?`,
    `fala ${firstName} tudo certo?`,
    `oi ${firstName} como você está?`,
    `olá ${firstName} tudo tranquilo?`,
    `oi ${firstName} tudo certo por aí?`,
    `bom dia ${firstName} tudo bem?`,
    `boa tarde ${firstName} tudo certo?`,
    `boa noite ${firstName} tudo bem?`,
  ];

  return openings[Math.floor(Math.random() * openings.length)];
}

export async function POST() {
  try {
    const supabase = getSupabase();

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("status", "novo")
      .eq("ai_paused", false)
      .limit(5);

    if (error) throw new Error(error.message);

    const results: any[] = [];

    for (const contact of contacts || []) {
      try {
        const rawPhone = contact.telefone || contact.phone;
        const number = formatWhatsAppPhone(rawPhone);

        if (!number) {
          throw new Error("Contato sem telefone");
        }

        const { data: existing } = await supabase
          .from("messages")
          .select("id")
          .eq("contact_id", contact.id)
          .eq("direction", "sent")
          .limit(1);

        if (existing?.length) {
          results.push({
            contact_id: contact.id,
            nome: contact.nome || contact.name,
            telefone: rawPhone,
            status: "skipped",
            reason: "Mensagem inicial já enviada",
          });

          continue;
        }

        const sessionId = Number(contact.session_id || 1);
        const message = buildOpeningMessage(contact);

        await sleep(randomDelay(5000, 12000));

        await sendWhatsApp({
          sessionId,
          number,
          message,
        });

        await supabase
          .from("contacts")
          .update({
            status: "abertura_enviada",
            last_message: message,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", contact.id);

        await supabase.from("messages").insert({
          contact_id: contact.id,
          direction: "sent",
          content: message,
        });

        results.push({
          contact_id: contact.id,
          nome: contact.nome || contact.name,
          telefone: rawPhone,
          status: "sent",
        });

        await sleep(randomDelay(35000, 90000));
      } catch (error: any) {
        results.push({
          contact_id: contact.id,
          nome: contact.nome || contact.name,
          telefone: contact.telefone || contact.phone,
          status: "error",
          error: error?.message || "Erro ao enviar",
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao iniciar campanha",
      },
      { status: 500 }
    );
  }
}