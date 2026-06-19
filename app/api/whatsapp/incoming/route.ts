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

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function keywordMatches(message: string, keyword: string, matchType = "contains") {
  const text = normalizeText(message);
  const key = normalizeText(keyword);

  if (!key) return false;
  if (matchType === "exact") return text === key;
  if (matchType === "starts_with") return text.startsWith(key);
  return text.includes(key);
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

async function resolveCompanyBySession(supabase: any, sessionIdRaw: any) {
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

function getCompanySearchOrder(companyId: string) {
  const list = [companyId];

  if (DEFAULT_COMPANY_ID && DEFAULT_COMPANY_ID !== companyId) {
    list.push(DEFAULT_COMPANY_ID);
  }

  return list.filter(Boolean);
}

function applyVariables(text: string, lead: any, extra: any = {}) {
  const phone = lead?.phone || extra?.phone || "";
  const lastMessage = extra?.lastMessage || "";
  const linkWhatsapp = phone ? `https://wa.me/${clean(phone)}` : "";

  return String(text || "")
    .replaceAll("{nome}", lead?.name || "")
    .replaceAll("{telefone}", phone)
    .replaceAll("{ultima_mensagem}", lastMessage)
    .replaceAll("{link_whatsapp}", linkWhatsapp)
    .replaceAll("{cardapio}", CARDAPIO_URL)
    .trim();
}

function pickText(baseMessage: string, variations: any[], lead: any, extra: any) {
  const options = [
    baseMessage,
    ...(variations?.map((v: any) => v.content) || []),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);

  if (!options.length) return "";

  return applyVariables(
    options[Math.floor(Math.random() * options.length)],
    lead,
    extra
  );
}

async function getTemplateReply(
  supabase: any,
  intent: string,
  lead: any,
  companyId: string,
  extra: any = {}
) {
  let selectedTemplate: any = null;

  for (const targetCompanyId of getCompanySearchOrder(companyId)) {
    const { data: template, error } = await supabase
      .from("message_templates")
      .select("id, base_message, company_id")
      .eq("company_id", targetCompanyId)
      .eq("type", "ai")
      .eq("intent", intent)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("ERRO AO BUSCAR TEMPLATE POR INTENT:", error);
      continue;
    }

    if (template) {
      selectedTemplate = template;
      break;
    }
  }

  if (!selectedTemplate) return null;

  const { data: variations } = await supabase
    .from("message_variations")
    .select("content")
    .eq("template_id", selectedTemplate.id)
    .eq("active", true);

  const reply = pickText(
    selectedTemplate.base_message,
    variations || [],
    lead,
    extra
  );

  return reply || null;
}

async function getTriggeredTemplates({
  supabase,
  companyId,
  flowMode,
  flowStep,
}: {
  supabase: any;
  companyId: string;
  flowMode: "global" | "sequence";
  flowStep?: number | null;
}) {
  const companyIds = getCompanySearchOrder(companyId);

  for (const targetCompanyId of companyIds) {
    let query = supabase
      .from("message_templates")
      .select(
        "id, company_id, name, base_message, trigger_keywords, match_type, media_url, media_type, kanban_status, notify_enabled, notify_number, notify_message, flow_mode, flow_step, next_step, message_variations(content)"
      )
      .eq("company_id", targetCompanyId)
      .eq("type", "ai")
      .eq("intent", "FAQ_CUSTOM")
      .eq("active", true)
      .eq("flow_mode", flowMode);

    if (flowMode === "sequence") {
      query = query.eq("flow_step", Number(flowStep || 1));
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("ERRO AO BUSCAR GATILHOS:", error);
      continue;
    }

    if (data?.length) return data;
  }

  return [];
}

async function findTriggeredTemplate({
  supabase,
  message,
  lead,
  companyId,
  flowMode,
  flowStep,
}: {
  supabase: any;
  message: string;
  lead: any;
  companyId: string;
  flowMode: "sequence" | "global";
  flowStep?: number | null;
}) {
  const templates = await getTriggeredTemplates({
    supabase,
    companyId,
    flowMode,
    flowStep,
  });

  for (const template of templates || []) {
    const triggers = Array.isArray(template.trigger_keywords)
      ? template.trigger_keywords
      : [];

    const matched = triggers.some((keyword: string) =>
      keywordMatches(message, keyword, template.match_type || "contains")
    );

    if (matched) {
      const reply = pickText(
        template.base_message || "",
        template.message_variations || [],
        lead,
        { lastMessage: message }
      );

      return {
        id: template.id,
        companyId: template.company_id,
        name: template.name,
        reply,
        mediaUrl: template.media_url || null,
        mediaType: template.media_type || "text",
        kanbanStatus: template.kanban_status || null,
        notifyEnabled: Boolean(template.notify_enabled),
        notifyNumber: template.notify_number || null,
        notifyMessage: template.notify_message || null,
        flowMode: template.flow_mode || "global",
        flowStep: template.flow_step || null,
        nextStep: template.next_step || null,
        source: flowMode === "sequence" ? "sequence_trigger" : "global_trigger",
      };
    }
  }

  return null;
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

async function sendMedia({
  sessionId,
  number,
  lid,
  isLid,
  mediaUrl,
  mediaType,
  caption,
}: any) {
  if (!mediaUrl) return null;

  try {
    const res = await fetch(`${WHATSAPP_SERVER}/send-media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  sessionId: String(sessionId),
  number,
  message,

  lid: lid?.includes("@lid") ? lid : null,

  isLid: Boolean(lid?.includes("@lid")),
}),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.success !== false) {
      return data;
    }
  } catch {}

  return await sendMessage({
    sessionId,
    number,
    lid,
    isLid,
    message: caption ? `${caption}\n\n${mediaUrl}` : mediaUrl,
  });
}

async function sendInternalNotification({
  sessionId,
  number,
  message,
}: {
  sessionId: string;
  number: string;
  message: string;
}) {
  if (!number || !message) return null;

  try {
    return await sendMessage({
      sessionId,
      number: normalizePhone(number),
      message,
      lid: null,
      isLid: false,
    });
  } catch (error) {
    console.error("ERRO AO ENVIAR NOTIFICAÇÃO INTERNA:", error);
    return null;
  }
}

function isNoInterest(text: string) {
  const t = normalizeText(text);

  return (
    t.includes("nao quero") ||
    t.includes("sem interesse") ||
    t.includes("nao tenho interesse") ||
    t.includes("agora nao") ||
    t.includes("pare") ||
    t.includes("sair") ||
    t.includes("remover")
  );
}

function detectIntent(text: string) {
  const t = normalizeText(text);

  if (isNoInterest(t)) return "SEM_INTERESSE";
  if (t.includes("cardapio") || t.includes("menu")) return "CARDAPIO";
  if (t.includes("promo") || t.includes("combo") || t.includes("desconto"))
    return "PROMOCAO";
  if (
    t.includes("pedido") ||
    t.includes("comprar") ||
    t.includes("quero pedir") ||
    t.includes("preco") ||
    t.includes("valor")
  )
    return "PEDIDO";
  if (t.includes("entrega") || t.includes("delivery") || t.includes("frete"))
    return "ENTREGA";
  if (t.includes("pix") || t.includes("cartao") || t.includes("pagamento"))
    return "PAGAMENTO";
  if (t.includes("horario") || t.includes("funciona")) return "HORARIO";

  return "DEFAULT";
}

function getIncomingMessageId(body: any) {
  return (
    body.messageId ||
    body.message_id ||
    body.key?.id ||
    body.id ||
    body.message?.key?.id ||
    null
  );
}

async function wasMessageAlreadyProcessed(
  supabase: any,
  leadId: string,
  messageId: string | null
) {
  if (!messageId) return false;

  const { data } = await supabase
    .from("messages")
    .select("id")
    .eq("lead_id", leadId)
    .eq("event", "message_received")
    .contains("payload", { message_id: messageId })
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

async function saveReceivedMessage(
  supabase: any,
  leadId: string,
  message: string,
  messageId?: string | null
) {
  const receivedInsert = await supabase.from("messages").insert({
    lead_id: leadId,
    direction: "received",
    topic: "whatsapp",
    extension: "text",
    content: message,
    event: "message_received",
    payload: {
      message_id: messageId || null,
    },
    created_at: new Date().toISOString(),
  });

  if (receivedInsert.error) {
    console.error("ERRO AO SALVAR MENSAGEM RECEBIDA:", receivedInsert.error);
  }
}

async function saveSentMessage(
  supabase: any,
  leadId: string,
  reply: string,
  mediaUrl?: string | null,
  mediaType?: string | null
) {
  const sentInsert = await supabase.from("messages").insert({
    lead_id: leadId,
    direction: "sent",
    topic: "whatsapp",
    extension: mediaType || "text",
    content: reply,
    event: "message_sent",
    payload: {
      media_url: mediaUrl || null,
      media_type: mediaType || "text",
    },
    created_at: new Date().toISOString(),
  });

  if (sentInsert.error) {
    console.error("ERRO AO SALVAR MENSAGEM ENVIADA:", sentInsert.error);
  }
}

async function replyAndSave({
  supabase,
  sessionId,
  phone,
  lid,
  isLid,
  leadId,
  reply,
  mediaUrl = null,
  mediaType = "text",
}: any) {
  let result: any = null;

  if (reply) {
    result = await sendMessage({
      sessionId,
      number: phone,
      lid,
      isLid,
      message: reply,
    });
  }

  if (mediaUrl) {
    result = await sendMedia({
      sessionId,
      number: phone,
      lid,
      isLid,
      mediaUrl,
      mediaType,
      caption: "",
    });
  }

  if (result?.success !== false) {
    await saveSentMessage(
      supabase,
      leadId,
      reply || mediaUrl,
      mediaUrl,
      mediaType
    );
  }

  return result;
}

async function getFinalReply(
  supabase: any,
  intent: string,
  message: string,
  lead: any,
  companyId: string
) {
  const currentStep = Number(lead?.current_flow_step || 1);

  const globalTemplate = await findTriggeredTemplate({
    supabase,
    message,
    lead,
    companyId,
    flowMode: "global",
  });

  if (globalTemplate?.reply || globalTemplate?.mediaUrl) {
    return globalTemplate;
  }

  const sequenceTemplate = await findTriggeredTemplate({
    supabase,
    message,
    lead,
    companyId,
    flowMode: "sequence",
    flowStep: currentStep,
  });

  if (sequenceTemplate?.reply || sequenceTemplate?.mediaUrl) {
    return sequenceTemplate;
  }

  const templateReply = await getTemplateReply(
    supabase,
    intent,
    lead,
    companyId,
    { lastMessage: message }
  );

  if (templateReply) {
    return {
      reply: templateReply,
      mediaUrl: null,
      mediaType: "text",
      kanbanStatus: null,
      notifyEnabled: false,
      notifyNumber: null,
      notifyMessage: null,
      flowMode: "intent",
      flowStep: null,
      nextStep: null,
      source: "intent_template",
    };
  }

  return {
    reply: null,
    mediaUrl: null,
    mediaType: "text",
    kanbanStatus: null,
    notifyEnabled: false,
    notifyNumber: null,
    notifyMessage: null,
    flowMode: "none",
    flowStep: null,
    nextStep: null,
    source: "no_template",
  };
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const messageId = getIncomingMessageId(body);

    const rawPhone = clean(body.phone || "");
    const rawNumber = clean(body.number || "");
    const rawLid =
  typeof body.lid === "string" && body.lid.includes("@lid")
    ? body.lid
    : null;
   const incomingIsLid = Boolean(rawLid);
    const lid = rawLid;

    const phone = incomingIsLid
      ? normalizePhone(rawPhone)
      : normalizePhone(rawPhone || rawNumber);

    const remoteJid = body.remoteJid || null;
    const message = String(body.message || "").trim();

    const resolved = await resolveCompanyBySession(
      supabase,
      body.sessionId || "1"
    );

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
          current_flow_step: 1,
          last_message: message,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (created.error) throw new Error(created.error.message);
      lead = created.data;
    }

    if (!lead?.id) {
      return NextResponse.json(
        { success: false, error: "Lead não encontrado/criado." },
        { status: 500 }
      );
    }

    const duplicated = await wasMessageAlreadyProcessed(
      supabase,
      lead.id,
      messageId
    );

    if (duplicated) {
      return NextResponse.json({
        success: true,
        action: "duplicate_ignored",
      });
    }

    await saveReceivedMessage(supabase, lead.id, message, messageId);

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
        current_flow_step: Number(lead.current_flow_step || 1),
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
      const reply = await getTemplateReply(
        supabase,
        "SEM_INTERESSE",
        lead,
        companyId,
        { lastMessage: message }
      );

      if (!reply) {
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

        return NextResponse.json({
          success: true,
          action: "sem_interesse_sem_template",
        });
      }

      await replyAndSave({
        supabase,
        sessionId: sendSessionId,
        phone: lead.phone || phone,
        lid,
        isLid: incomingIsLid,
        leadId: lead.id,
        reply,
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

    const finalReply = await getFinalReply(
      supabase,
      intent,
      message,
      lead,
      companyId
    );

    if (!finalReply.reply && !finalReply.mediaUrl) {
      return NextResponse.json({
        success: true,
        action: "no_template_found",
        intent,
        source: finalReply.source,
        current_flow_step: Number(lead.current_flow_step || 1),
        company_id: companyId,
        fallback_company_id: DEFAULT_COMPANY_ID,
      });
    }

    await replyAndSave({
      supabase,
      sessionId: sendSessionId,
      phone: lead.phone || phone,
      lid,
      isLid: incomingIsLid,
      leadId: lead.id,
      reply: finalReply.reply,
      mediaUrl: finalReply.mediaUrl,
      mediaType: finalReply.mediaType,
    });

    if (finalReply.notifyEnabled && finalReply.notifyNumber) {
      const internalMessage = applyVariables(
        finalReply.notifyMessage ||
          "🚨 Novo atendimento\n\nCliente: {nome}\nTelefone: {telefone}\n\nÚltima mensagem:\n{ultima_mensagem}\n\nAbrir conversa:\n{link_whatsapp}",
        lead,
        {
          phone: lead.phone || phone,
          lastMessage: message,
        }
      );

      await sendInternalNotification({
        sessionId: sendSessionId,
        number: finalReply.notifyNumber,
        message: internalMessage,
      });
    }

    const fallbackStatus =
      intent === "PEDIDO"
        ? "pedido"
        : intent === "CARDAPIO" || intent === "PROMOCAO" || intent === "ENTREGA"
        ? "interesse"
        : "respondido";

    const nextStatus = finalReply.kanbanStatus || fallbackStatus;

    const nextFlowStep =
      finalReply.flowMode === "sequence" && finalReply.nextStep
        ? Number(finalReply.nextStep)
        : Number(lead.current_flow_step || 1);

    await supabase
      .from("leads")
      .update({
        status: nextStatus,
        current_flow_step: nextFlowStep,
        last_message: message,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      action: "resposta_template_configurado",
      intent,
      source: finalReply.source,
      flow_mode: finalReply.flowMode,
      flow_step: finalReply.flowStep,
      next_step: finalReply.nextStep,
      current_flow_step: nextFlowStep,
      lead_id: lead.id,
      company_id: companyId,
      fallback_company_id: DEFAULT_COMPANY_ID,
      template_company_id: (finalReply as any).companyId || companyId,
      phone: lead.phone || phone,
      lid,
      session_id: sessionId,
      send_session_id: sendSessionId,
      kanban_status: nextStatus,
      notify_sent: Boolean(finalReply.notifyEnabled && finalReply.notifyNumber),
    });
  } catch (error: any) {
    console.error("ERRO API WHATSAPP INCOMING:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
