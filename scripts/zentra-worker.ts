import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

const SESSIONS = [1, 2, 3, 4, 5];
const MAX_PER_DAY = 30;
const DELAY_MIN = 120000;
const DELAY_MAX = 300000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanPhone(value: string) {
  let phone = String(value || "").replace(/\D/g, "");
  if (!phone) return "";
  if (!phone.startsWith("55")) phone = `55${phone}`;
  return phone;
}

function buildSessionId(companyId: string, sessionId: number) {
  return `${companyId}_${sessionId}`;
}

function applyVariables(text: string, lead: any) {
  return String(text || "")
    .replaceAll("{nome}", lead?.name || "")
    .replaceAll("{telefone}", lead?.phone || "")
    .trim();
}

async function getTemplateMessage({
  type,
  intent,
  lead,
  companyId,
}: {
  type: "campaign" | "ai";
  intent: string;
  lead: any;
  companyId: string;
}) {
  const { data: template } = await supabase
    .from("message_templates")
    .select("id, base_message")
    .eq("company_id", companyId)
    .eq("type", type)
    .eq("intent", intent)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) return null;

  const { data: variations } = await supabase
    .from("message_variations")
    .select("content")
    .eq("company_id", companyId)
    .eq("template_id", template.id)
    .eq("active", true);

  const list = variations?.length
    ? variations.map((v) => v.content)
    : [template.base_message];

  return applyVariables(list[Math.floor(Math.random() * list.length)], lead);
}

async function getFallbackMessage(intent: string, lead: any) {
  const firstName = lead?.name || "";

  if (intent === "FOLLOW_UP") {
    return `Oi ${firstName}, passando rapidinho 😊

Você conseguiu ver minha mensagem anterior?
Posso te enviar o cardápio?`;
  }

  if (intent === "REATIVACAO") {
    return `Oi ${firstName}, tudo bem?

Faz um tempinho que você não pede com a gente.
Hoje temos opções especiais no delivery.`;
  }

  if (intent === "POS_VENDA") {
    return `Oi ${firstName}, tudo certo?

Seu pedido chegou certinho? 😊`;
  }

  if (intent === "RECUPERACAO") {
    return `Oi ${firstName}, vi que você começou um pedido.

Posso te ajudar a finalizar?`;
  }

  return `Oi ${firstName}, tudo bem?

Temos uma condição especial hoje.
Quer ver o cardápio?`;
}

async function isSessionOnline(sessionId: number, companyId: string) {
  try {
    const finalSessionId = buildSessionId(companyId, sessionId);

    const res = await fetch(`${WHATSAPP_SERVER}/status/${finalSessionId}`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    console.log("DEBUG STATUS WHATSAPP:", {
      finalSessionId,
      status: data?.status,
      hasQr: data?.hasQr,
      me: data?.me,
      activeSessions: data?.activeSessions,
    });

    return data.status === "online" && Boolean(data?.me?.id || data?.me);
  } catch (error: any) {
    console.log("ERRO AO CONSULTAR STATUS:", error?.message || error);
    return false;
  }
}

async function countSentToday(sessionId: number, companyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("automation_queue")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("session_id", sessionId)
    .eq("status", "sent")
    .gte("sent_at", today.toISOString());

  return count || 0;
}

async function sendText(
  sessionId: number,
  companyId: string,
  number: string,
  message: string
) {
  const finalSessionId = buildSessionId(companyId, sessionId);

  const res = await fetch(`${WHATSAPP_SERVER}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: finalSessionId,
      number,
      message,
    }),
  });

  const data = await res.json().catch(() => ({}));

  console.log("RESPOSTA WHATSAPP SERVER:", data);

  if (!res.ok || data.success === false) {
    throw new Error(data?.error || "Erro ao enviar WhatsApp");
  }

  return data;
}

async function processQueue() {
  const now = new Date().toISOString();

  const { data: items, error } = await supabase
    .from("automation_queue")
    .select(`
      *,
      leads (
        id,
        company_id,
        name,
        phone,
        status,
        session_id,
        ai_paused,
        paused
      )
    `)
    .eq("status", "pending")
    .eq("paused", false)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar fila:", error.message);
    return;
  }

  if (!items?.length) {
    console.log("Nenhum item pendente.");
    return;
  }

  const item = items[0];

  try {
    const lead = item.leads;

    if (!item.company_id) {
      throw new Error("Item da fila sem company_id");
    }

    if (lead?.company_id && lead.company_id !== item.company_id) {
      throw new Error("Lead pertence a outra empresa");
    }

    if (item.paused) {
      console.log("Item pausado. Pulando...");
      return;
    }

    if (lead?.paused) {
      console.log("Lead pausado. Pulando...");
      return;
    }

    const sessionId = Number(item.session_id || lead?.session_id || 1);
    const phone = cleanPhone(item.phone || lead?.phone || "");
    const intent = String(item.intent || item.type || "OPENING").toUpperCase();
    const finalSession = buildSessionId(item.company_id, sessionId);

    console.log("DEBUG FILA:", {
      queueId: item.id,
      queueCompany: item.company_id,
      leadCompany: lead?.company_id,
      sessionId,
      finalSession,
      phone,
      intent,
      status: item.status,
    });

    if (!SESSIONS.includes(sessionId)) {
      throw new Error(
        `Sessão inválida: ${sessionId}. Use apenas 1, 2, 3, 4 ou 5.`
      );
    }

    if (!phone) {
      throw new Error("Lead sem telefone");
    }

    const online = await isSessionOnline(sessionId, item.company_id);

    if (!online) {
      throw new Error(
        `WhatsApp ${sessionId} offline ou inválido | sessão real: ${finalSession}`
      );
    }

    const sentToday = await countSentToday(sessionId, item.company_id);

    if (sentToday >= MAX_PER_DAY) {
      throw new Error(
        `WhatsApp ${sessionId} atingiu limite diário de ${MAX_PER_DAY}`
      );
    }

    const templateMessage = await getTemplateMessage({
  type: "campaign",
  intent,
  lead,
  companyId: item.company_id,
});

    const message =
      templateMessage ||
      applyVariables(String(item.message || ""), lead) ||
      (await getFallbackMessage(intent, lead));

    if (!message) {
      throw new Error("Mensagem vazia");
    }

    console.log(
      `Enviando ${intent} para ${phone} pelo WhatsApp ${sessionId} (${finalSession}) | empresa ${item.company_id}`
    );

    await sendText(sessionId, item.company_id, phone, message);

    await supabase
      .from("automation_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", item.id)
      .eq("company_id", item.company_id);

    if (lead?.id) {
      const nextStatus =
        intent === "FOLLOW_UP"
          ? "campanha"
          : intent === "REATIVACAO"
          ? "reativar_futuro"
          : intent === "POS_VENDA"
          ? "finalizado"
          : intent === "RECUPERACAO"
          ? "interesse"
          : "enviado";

      await supabase
        .from("leads")
        .update({
          status: nextStatus,
          last_message: message,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id)
        .eq("company_id", item.company_id);

     await supabase.from("messages").insert({
  company_id: item.company_id,
  branch_id: item.branch_id || null,
  lead_id: lead.id,
  direction: "sent",
  content: message,
  created_at: new Date().toISOString(),
});
    }

    console.log("Enviado com sucesso:", phone);

    const delay = randomDelay(DELAY_MIN, DELAY_MAX);
    console.log(`Aguardando ${Math.round(delay / 1000)}s`);

    await sleep(delay);
  } catch (error: any) {
    console.error("Erro no item:", error.message);

    await supabase
      .from("automation_queue")
      .update({
        status: "failed",
        error: error.message,
      })
      .eq("id", item.id);
  }
}

async function loop() {
  console.log("Worker de disparo iniciado");

  while (true) {
    await processQueue();
    await sleep(10000);
  }
}

loop();