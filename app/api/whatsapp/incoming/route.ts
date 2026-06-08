import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { openai } from "@/lib/openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

const CARDAPIO_URL =
  process.env.NEXT_PUBLIC_CARDAPIO_URL || "http://localhost:3010";

const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID || "41edd938-3eb4-420e-9675-2e53703ed70b";

const DEFAULT_BRANCH_ID =
  process.env.DEFAULT_BRANCH_ID || "1f07f893-48c6-4b9c-9c5f-4b680a4fef6c";

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

function isLikelyLid(value: string) {
  const phone = clean(value);
  return Boolean(phone && !phone.startsWith("55") && phone.length > 11);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function resolveCompanyBySession(sessionIdRaw: any) {
  const raw = String(sessionIdRaw || "1");

  if (raw.includes("_")) {
    const [companyId, sessionNumber] = raw.split("_");

    return {
      companyId: companyId || DEFAULT_COMPANY_ID,
      branchId: DEFAULT_BRANCH_ID,
      sessionId: Number(sessionNumber || 1),
      rawSessionId: raw,
    };
  }

  const { data } = await supabase
    .from("WhatsappSession")
    .select("company_id, branch_id")
    .eq("sessionId", raw)
    .maybeSingle();

  return {
    companyId: data?.company_id || DEFAULT_COMPANY_ID,
    branchId: data?.branch_id || DEFAULT_BRANCH_ID,
    sessionId: Number(raw || 1),
    rawSessionId: raw,
  };
}

function buildSendSession(companyId: string, sessionId: number | string) {
  return `${companyId}_${sessionId}`;
}

function applyVariables(text: string, lead: any) {
  return String(text || "")
    .replaceAll("{nome}", lead?.name || "tudo bem")
    .replaceAll("{telefone}", lead?.phone || "")
    .replaceAll("{cardapio}", CARDAPIO_URL)
    .trim();
}

async function getTemplateReply(intent: string, lead: any, companyId: string) {
  const { data: template } = await supabase
    .from("message_templates")
    .select("id, base_message")
    .eq("type", "ai")
    .eq("intent", intent)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) return null;

  const { data: variations } = await supabase
    .from("message_variations")
    .select("content")
    .eq("template_id", template.id)
    .eq("active", true);

  const list = variations?.length
    ? variations.map((v) => v.content)
    : [template.base_message];

  return applyVariables(list[Math.floor(Math.random() * list.length)], lead);
}

async function sendMessage({ sessionId, number, message, lid, isLid }: any) {
  await sleep(randomDelay());

  const res = await fetch(`${WHATSAPP_SERVER}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: String(sessionId),
      number,
      message,
      lid,
      isLid,
    }),
  });

  return await res.json().catch(() => ({}));
}

function isNoInterest(text: string) {
  const t = text.toLowerCase().trim();

  return (
    t.includes("não quero") ||
    t.includes("nao quero") ||
    t.includes("sem interesse") ||
    t.includes("não tenho interesse") ||
    t.includes("nao tenho interesse") ||
    t.includes("agora não") ||
    t.includes("agora nao") ||
    t.includes("pare") ||
    t.includes("sair") ||
    t.includes("remover")
  );
}

function detectIntent(text: string) {
  const t = text.toLowerCase().trim();

  if (isNoInterest(t)) return "SEM_INTERESSE";
  if (t.includes("cardápio") || t.includes("cardapio") || t.includes("menu"))
    return "CARDAPIO";
  if (t.includes("promo") || t.includes("combo") || t.includes("desconto"))
    return "PROMOCAO";
  if (
    t.includes("pedido") ||
    t.includes("comprar") ||
    t.includes("quero pedir") ||
    t.includes("preço") ||
    t.includes("preco") ||
    t.includes("valor")
  )
    return "PEDIDO";
  if (t.includes("entrega") || t.includes("delivery") || t.includes("frete"))
    return "ENTREGA";
  if (t.includes("pix") || t.includes("cartão") || t.includes("pagamento"))
    return "PAGAMENTO";
  if (t.includes("horário") || t.includes("horario") || t.includes("funciona"))
    return "HORARIO";

  return "DEFAULT";
}

async function saveReceivedMessage(
  leadId: string,
  message: string,
  companyId: string,
  branchId: string | null
) {
  const receivedInsert = await supabase.from("messages").insert({
  lead_id: leadId,
  direction: "received",
  topic: "whatsapp",
  extension: "text",
  content: message,
  event: "message_received",
  payload: {},
  created_at: new Date().toISOString(),
});

  if (receivedInsert.error) {
    console.error("ERRO AO SALVAR MENSAGEM RECEBIDA:", receivedInsert.error);
  }
}

async function saveSentMessage(
  leadId: string,
  reply: string,
  companyId: string,
  branchId: string | null
) {
  const sentInsert = await supabase.from("messages").insert({
  lead_id: leadId,
  direction: "sent",
  topic: "whatsapp",
  extension: "text",
  content: reply,
  event: "message_sent",
  payload: {},
  created_at: new Date().toISOString(),
});

  if (sentInsert.error) {
    console.error("ERRO AO SALVAR MENSAGEM ENVIADA:", sentInsert.error);
  }
}

async function replyAndSave({
  sessionId,
  phone,
  lid,
  isLid,
  leadId,
  reply,
  companyId,
  branchId,
}: any) {
  const result = await sendMessage({
    sessionId,
    number: phone,
    lid,
    isLid,
    message: reply,
  });

  if (result?.success !== false) {
    await saveSentMessage(leadId, reply, companyId, branchId);
  }

  return result;
}

async function generateAIReply(message: string, lead: any) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return `Oi! 😄 Posso te ajudar com cardápio, combos, promoções, entrega ou pagamento.

Cardápio:
${CARDAPIO_URL}`;
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `
Você é o atendente virtual da Zentra Food, uma pizzaria/delivery.
Responda em português brasileiro.
Seja curto, simpático e objetivo.
Não invente preços.
Quando o cliente quiser pedir, envie o link do cardápio.
Link do cardápio: ${CARDAPIO_URL}
          `.trim(),
        },
        {
          role: "user",
          content: `Cliente: ${lead?.name || "Cliente"}\nMensagem: ${message}`,
        },
      ],
    });

    return (
      completion.choices[0]?.message?.content?.trim() ||
      `Oi! 😄 Posso te ajudar com cardápio, combos, promoções ou pedido.

Cardápio:
${CARDAPIO_URL}`
    );
  } catch {
    return `Oi! 😄 Posso te ajudar com cardápio, combos, promoções, entrega ou pagamento.

Cardápio:
${CARDAPIO_URL}`;
  }
}

async function getFinalReply(
  intent: string,
  message: string,
  lead: any,
  companyId: string
) {
  const templateReply = await getTemplateReply(intent, lead, companyId);
  if (templateReply) return templateReply;

  const defaultTemplate = await getTemplateReply("DEFAULT", lead, companyId);
  if (defaultTemplate) return defaultTemplate;

  return await generateAIReply(message, lead);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawPhone = clean(body.phone || "");
    const rawNumber = clean(body.number || "");
    const rawLid = body.lid ? clean(body.lid) : null;

    const incomingIsLid = Boolean(body.isLid) || isLikelyLid(rawNumber);
    const lid = rawLid || (incomingIsLid ? rawNumber : null);

    const phone = incomingIsLid
      ? normalizePhone(rawPhone)
      : normalizePhone(rawPhone || rawNumber);

    const remoteJid = body.remoteJid || null;
    const message = String(body.message || "").trim();

    const resolved = await resolveCompanyBySession(body.sessionId || "1");

    const companyId = resolved.companyId;
    const branchId = resolved.branchId;
    const sessionId = resolved.sessionId;
    const sendSessionId = buildSendSession(companyId, sessionId);

    if ((!phone && !lid) || !message) {
      return NextResponse.json(
        { success: false, error: "Telefone/LID ou mensagem inválida" },
        { status: 400 }
      );
    }

    let lead: any = null;

    if (phone) {
      const result = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .eq("phone", phone)
        .maybeSingle();

      lead = result.data;
    }

    if (!lead && remoteJid) {
      const result = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .eq("remote_jid", remoteJid)
        .maybeSingle();

      lead = result.data;
    }

    if (!lead && lid) {
      const result = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .eq("whatsapp_lid", lid)
        .maybeSingle();

      lead = result.data;
    }

    if (!lead && incomingIsLid && lid) {
      const result = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .eq("session_id", sessionId)
        .in("status", [
          "novo",
          "enviado",
          "respondido",
          "interesse",
          "pedido",
          "campanha",
          "reativar_futuro",
          "finalizado",
          "sem_interesse",
        ])
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      lead = result.data;

      if (lead) {
        await supabase
          .from("leads")
          .update({
            whatsapp_lid: lid,
            remote_jid: remoteJid,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("company_id", companyId);
      }
    }

    if (!lead) {
      const created = await supabase
        .from("leads")
        .insert({
          company_id: companyId,
          branch_id: branchId,
          name: body.pushName || "Contato WhatsApp",
          phone: phone || lid,
          whatsapp_lid: lid,
          remote_jid: remoteJid,
          status: "respondido",
          session_id: sessionId,
          ai_paused: false,
          last_message: message,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (created.error) {
        throw new Error(created.error.message);
      }

      lead = created.data;
    }

    if (!lead?.id) {
      return NextResponse.json(
        { success: false, error: "Lead não encontrado/criado." },
        { status: 500 }
      );
    }

    await saveReceivedMessage(lead.id, message, companyId, branchId);

    await supabase
      .from("leads")
      .update({
        status:
          lead.status === "novo" || lead.status === "enviado"
            ? "respondido"
            : lead.status,
        unread_count: Number(lead.unread_count || 0) + 1,
        last_message: message,
        last_message_at: new Date().toISOString(),
        whatsapp_lid: lid || lead.whatsapp_lid || null,
        remote_jid: remoteJid || lead.remote_jid || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("company_id", companyId);

    if (lead.ai_paused === true) {
      return NextResponse.json({
        success: true,
        action: "ia_pausada",
      });
    }

    const intent = detectIntent(message);

    if (intent === "SEM_INTERESSE") {
      const reply =
        (await getTemplateReply("SEM_INTERESSE", lead, companyId)) ||
        "Tudo bem! 😊 Se quiser ver o cardápio ou alguma promoção depois, é só chamar.";

      await replyAndSave({
        sessionId: sendSessionId,
        phone: lead.phone || phone,
        lid,
        isLid: incomingIsLid,
        leadId: lead.id,
        reply,
        companyId,
        branchId,
      });

      await supabase
        .from("leads")
        .update({
          status: "sem_interesse",
          ai_paused: true,
          last_message: message,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id)
        .eq("company_id", companyId);

      return NextResponse.json({ success: true, action: "sem_interesse" });
    }

    const reply = await getFinalReply(intent, message, lead, companyId);

    await replyAndSave({
      sessionId: sendSessionId,
      phone: lead.phone || phone,
      lid,
      isLid: incomingIsLid,
      leadId: lead.id,
      reply,
      companyId,
      branchId,
    });

    const nextStatus =
      intent === "PEDIDO"
        ? "pedido"
        : intent === "CARDAPIO" || intent === "PROMOCAO" || intent === "ENTREGA"
        ? "interesse"
        : "respondido";

    await supabase
      .from("leads")
      .update({
        status: nextStatus,
        last_message: message,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      action: "resposta_template_ia",
      intent,
      lead_id: lead.id,
      company_id: companyId,
      phone: lead.phone || phone,
      lid,
      session_id: sessionId,
      send_session_id: sendSessionId,
    });
  } catch (error: any) {
    console.error("ERRO API WHATSAPP INCOMING:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
        stack:
          process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}