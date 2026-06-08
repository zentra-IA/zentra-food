require("dotenv").config();

const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

async function loadBaileys() {
  return await import("@whiskeysockets/baileys");
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3011;
const ZENTRA_APP_URL = process.env.ZENTRA_APP_URL || "http://localhost:3010";

const sessions = {};
const starting = {};
const pendingAcks = new Map();

function clean(value) {
  return String(value || "").replace(/\D/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForAck(messageId, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAcks.delete(messageId);
      reject(new Error("WhatsApp não confirmou entrega no tempo esperado"));
    }, timeout);

    pendingAcks.set(messageId, {
      resolve: (data) => {
        clearTimeout(timer);
        pendingAcks.delete(messageId);
        resolve(data);
      },
      reject: (error) => {
        clearTimeout(timer);
        pendingAcks.delete(messageId);
        reject(error);
      },
    });
  });
}

function normalizeBrazilPhone(value) {
  let phone = clean(value);
  if (!phone) return "";
  if (!phone.startsWith("55")) phone = `55${phone}`;
  return phone;
}

function getCrmUrlBySession() {
  return `${ZENTRA_APP_URL}/api/whatsapp/incoming`;
}

async function resolveJid(session, payload) {
  const { number, phone, lid, isLid, jid: directJid } = payload;

  if (directJid) return directJid;

  if (isLid && lid) {
    return `${clean(lid)}@lid`;
  }

  const finalPhone = normalizeBrazilPhone(number || phone || lid);

  if (!finalPhone) {
    throw new Error("Telefone inválido");
  }

  const baseJid = `${finalPhone}@s.whatsapp.net`;

  try {
    const result = await session.sock.onWhatsApp(baseJid);
    const found = Array.isArray(result) ? result[0] : null;

    console.log("🔎 onWhatsApp:", {
      input: finalPhone,
      baseJid,
      result,
    });

    if (found?.exists && found?.jid) {
      return found.jid;
    }

    throw new Error(`Número não encontrado no WhatsApp: ${finalPhone}`);
  } catch (error) {
    console.log("⚠️ Falha ao validar onWhatsApp:", error.message);
    return baseJid;
  }
}

async function notifyCRM(payload) {
  try {
    const crmUrl = getCrmUrlBySession();

    console.log("➡️ Enviando mensagem para Zentra Food:", {
      crmUrl,
      sessionId: payload.sessionId,
      number: payload.number,
      message: payload.message,
    });

    const res = await fetch(crmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    console.log("⬅️ Resposta Zentra Food:", data);

    return data;
  } catch (error) {
    console.error("Erro ao avisar Zentra Food:", error.message);
  }
}

async function startSession(sessionId) {
  sessionId = String(sessionId);

  if (starting[sessionId]) {
    console.log(`⏳ Sessão ${sessionId} já está iniciando`);
    return starting[sessionId];
  }

  const current = sessions[sessionId];

  if (
    current &&
    ["online", "connecting", "qr_pending"].includes(current.status)
  ) {
    console.log(`ℹ️ Sessão ${sessionId} já existe: ${current.status}`);
    return current;
  }

  starting[sessionId] = createSession(sessionId);

  try {
    return await starting[sessionId];
  } finally {
    delete starting[sessionId];
  }
}

function extractMessageText(message) {
  const msg =
    message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message ||
    message?.documentWithCaptionMessage?.message ||
    message;

  return (
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.buttonsResponseMessage?.selectedDisplayText ||
    msg?.buttonsResponseMessage?.selectedButtonId ||
    msg?.listResponseMessage?.title ||
    msg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.templateButtonReplyMessage?.selectedDisplayText ||
    msg?.templateButtonReplyMessage?.selectedId ||
    ""
  );
}

async function createSession(sessionId) {
  sessionId = String(sessionId);

  const baileys = await loadBaileys();
  const makeWASocket = baileys.default;

  const {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
  } = baileys;

  if (sessions[sessionId]?.sock) {
    try {
      sessions[sessionId].sock.end();
    } catch {}
  }

  const { state, saveCreds } = await useMultiFileAuthState(
    `./sessions/${sessionId}`
  );

  const { version } = await fetchLatestBaileysVersion();

  sessions[sessionId] = {
    sock: null,
    status: "connecting",
    qr: null,
    me: null,
  };

  const sock = makeWASocket({
  version,
  auth: state,
  printQRInTerminal: false,

  browser: ["Ubuntu", "Chrome", "20.0.04"],

  syncFullHistory: false,

  markOnlineOnConnect: true,

  generateHighQualityLinkPreview: false,

  connectTimeoutMs: 60000,
  keepAliveIntervalMs: 30000,

  defaultQueryTimeoutMs: 60000,
});

  sessions[sessionId].sock = sock;

  sock.ev.on("creds.update", async () => {
  await saveCreds();
});

  sock.ev.on("messages.update", (updates) => {
    for (const update of updates || []) {
      const messageId = update?.key?.id;
      if (!messageId) continue;

      const pending = pendingAcks.get(messageId);
      if (!pending) continue;

      if (update.error) {
        pending.reject(
          new Error(update.error?.message || "WhatsApp recusou a mensagem")
        );
        continue;
      }

      const status = Number(update.update?.status || update.status || 0);

      console.log("📌 ACK update:", {
        messageId,
        status,
        update,
      });

      if (status >= 2) {
        pending.resolve(update);
      }
    }
  });

  sock.ev.on("messaging-history.set", () => {
    console.log("⏭️ Histórico ignorado");
  });

  sock.ev.on("messages.upsert", async (event) => {
    try {
      const { messages, type } = event;

      console.log("📥 Mensagem recebida:", {
        sessionId,
        type,
        total: messages?.length || 0,
      });

      for (const msg of messages || []) {
        const remoteJid = msg.key?.remoteJid || "";

        if (!msg.message) continue;
        if (msg.key?.fromMe) continue;
        if (remoteJid === "status@broadcast") continue;
        if (remoteJid.includes("@g.us")) continue;
        if (msg.message.protocolMessage) continue;

        const participant = msg.key?.participant || "";
        const senderJid = participant || remoteJid;
        const isLid = senderJid.includes("@lid");

        const phoneFromJid = senderJid.includes("@s.whatsapp.net")
          ? clean(senderJid.replace("@s.whatsapp.net", ""))
          : null;

        const lidFromJid = senderJid.includes("@lid")
          ? clean(senderJid.replace("@lid", ""))
          : null;

        const pushName = msg.pushName || "";
        const number = phoneFromJid || lidFromJid || clean(senderJid);

        if (!number) continue;

        const text = extractMessageText(msg.message);

        if (!text || !text.trim()) continue;

        await notifyCRM({
          sessionId,
          number,
          phone: phoneFromJid,
          lid: lidFromJid,
          isLid,
          remoteJid: senderJid,
          pushName,
          message: text.trim(),
          source: "whatsapp",
          product: "zentra-food",
        });
      }
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
    }
  });

  sock.ev.on("connection.update", async (update) => {
  console.log("CONNECTION UPDATE:", JSON.stringify(update, null, 2));

  const { connection, qr, lastDisconnect } = update;

    if (qr) {
      try {
        const qrImage = await QRCode.toDataURL(qr);

        sessions[sessionId].qr = qrImage;
        sessions[sessionId].status = "qr_pending";

        console.log(`📲 QR gerado para sessão ${sessionId}`);
      } catch (error) {
        console.error("Erro ao gerar QR:", error.message);
      }
    }

    if (connection === "open") {
      sessions[sessionId].status = "online";
      sessions[sessionId].qr = null;
      sessions[sessionId].me = sock.user || null;

      console.log(`✅ Sessão ${sessionId} conectada`);
      console.log("👤 Conta conectada:", sock.user);
      console.log("📌 Sessões ativas:", Object.keys(sessions));
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.data?.statusCode;

      const message = lastDisconnect?.error?.message || "";

      console.log(`❌ Sessão ${sessionId} desconectada:`, message, statusCode);

      if (sessions[sessionId]) {
        sessions[sessionId].status = "offline";
        sessions[sessionId].qr = null;
      }

      if (
        statusCode === DisconnectReason.loggedOut ||
        statusCode === 440 ||
        statusCode === 401
      ) {
        console.log(`♻️ Limpando sessão ${sessionId}...`);

        try {
          const sessionPath = path.join(
            __dirname,
            "sessions",
            String(sessionId)
          );

          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, {
              recursive: true,
              force: true,
            });

            console.log(`🧹 Sessão ${sessionId} apagada`);
          }
        } catch (error) {
          console.error("Erro ao limpar sessão:", error);
        }

        setTimeout(() => startSession(sessionId), 3000);
        return;
      }

      console.log(`🔄 Reconectando sessão ${sessionId} em 5s...`);
      setTimeout(() => startSession(sessionId), 5000);
    }
  });

  return sessions[sessionId];
}

app.post("/start/:id", async (req, res) => {
  try {
    const session = await startSession(req.params.id);

    res.json({
      success: true,
      status: session.status,
      qr: session.qr,
      me: session.me,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/start/:id", async (req, res) => {
  try {
    const session = await startSession(req.params.id);

    res.json({
      success: true,
      status: session.status,
      qr: session.qr,
      me: session.me,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/restart/:id", async (req, res) => {
  try {
    const sessionId = String(req.params.id);

    console.log(`♻️ Resetando sessão ${sessionId}...`);

    if (sessions[sessionId]?.sock) {
      try {
        sessions[sessionId].sock.end();
      } catch {}
    }

    delete sessions[sessionId];

    const sessionPath = path.join(__dirname, "sessions", sessionId);

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🧹 Pasta da sessão ${sessionId} apagada`);
    }

    await sleep(1000);

    const session = await startSession(sessionId);

    res.json({
      success: true,
      status: session.status,
      qr: session.qr,
      me: session.me,
    });
  } catch (error) {
    console.error("Erro ao resetar sessão:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/restart/:id", async (req, res) => {
  try {
    const sessionId = String(req.params.id);

    console.log(`♻️ Resetando sessão ${sessionId}...`);

    if (sessions[sessionId]?.sock) {
      try {
        sessions[sessionId].sock.end();
      } catch {}
    }

    delete sessions[sessionId];

    const sessionPath = path.join(__dirname, "sessions", sessionId);

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🧹 Pasta da sessão ${sessionId} apagada`);
    }

    await sleep(1000);

    const session = await startSession(sessionId);

    res.json({
      success: true,
      status: session.status,
      qr: session.qr,
      me: session.me,
    });
  } catch (error) {
    console.error("Erro ao resetar sessão:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/send", async (req, res) => {
  try {
    const payload = req.body;

    const { sessionId, message } = payload;
    const finalNumber =
      payload.number || payload.phone || payload.lid || payload.jid;

    console.log("📤 /send recebido:", {
      sessionId,
      number: payload.number,
      phone: payload.phone,
      lid: payload.lid,
      jid: payload.jid,
      message,
    });

    if (!sessionId || !finalNumber || !message) {
      return res.status(400).json({
        success: false,
        error: "sessionId, number/phone/lid/jid e message são obrigatórios",
      });
    }

    const session = sessions[String(sessionId)];

    if (!session || !session.sock) {
      return res.status(400).json({
        success: false,
        error: `Sessão ${sessionId} não encontrada`,
        activeSessions: Object.keys(sessions),
      });
    }

    if (session.status !== "online") {
      return res.status(400).json({
        success: false,
        error: `Sessão ${sessionId} offline`,
        status: session.status,
      });
    }

    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        error: "Mensagem vazia",
      });
    }

    const jid = await resolveJid(session, payload);

    console.log("🎯 JID final:", jid);

    try {
      await session.sock.presenceSubscribe(jid);
      await session.sock.sendPresenceUpdate("composing", jid);
    } catch (e) {
      console.log("⚠️ Falha no presence/composing:", e.message);
    }

    await sleep(Math.floor(Math.random() * 2000) + 1000);

    const result = await session.sock.sendMessage(jid, {
      text: cleanMessage,
    });

    console.log("✅ Resultado sendMessage:", result);

    if (!result?.key?.id) {
      return res.status(500).json({
        success: false,
        error: "WhatsApp não gerou ID da mensagem",
        jid,
        result,
      });
    }

    try {
      const ack = await waitForAck(result.key.id);
      console.log("✅ ACK confirmado:", ack);
    } catch (ackError) {
      console.error("❌ ACK falhou:", ackError.message);

      return res.status(500).json({
        success: false,
        error: ackError.message,
        jid,
        messageId: result.key.id,
      });
    }

    try {
      await session.sock.sendPresenceUpdate("paused", jid);
    } catch {}

    return res.json({
      success: true,
      jid,
      messageId: result.key.id,
      from: session.me || session.sock.user || null,
    });
  } catch (error) {
    console.log("❌ Erro no envio de texto:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

app.post("/send-audio", async (req, res) => {
  try {
    const payload = req.body;

    const { sessionId, audioUrl } = payload;
    const finalNumber =
      payload.number || payload.phone || payload.lid || payload.jid;

    if (!sessionId || !finalNumber || !audioUrl) {
      return res.status(400).json({
        success: false,
        error: "sessionId, number/phone/lid/jid e audioUrl são obrigatórios",
      });
    }

    const session = sessions[String(sessionId)];

    if (!session || !session.sock) {
      return res.status(400).json({
        success: false,
        error: `Sessão ${sessionId} não encontrada`,
        activeSessions: Object.keys(sessions),
      });
    }

    if (session.status !== "online") {
      return res.status(400).json({
        success: false,
        error: `Sessão ${sessionId} offline`,
        status: session.status,
      });
    }

    const jid = await resolveJid(session, payload);

    await session.sock.presenceSubscribe(jid);
    await session.sock.sendPresenceUpdate("recording", jid);

    await sleep(Math.floor(Math.random() * 3000) + 2000);

    const result = await session.sock.sendMessage(jid, {
      audio: { url: audioUrl },
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
    });

    console.log("✅ Resultado sendAudio:", result);

    if (!result?.key?.id) {
      return res.status(500).json({
        success: false,
        error: "WhatsApp não confirmou envio do áudio",
        jid,
        result,
      });
    }

    try {
      const ack = await waitForAck(result.key.id);
      console.log("✅ ACK áudio confirmado:", ack);
    } catch (ackError) {
      console.error("❌ ACK áudio falhou:", ackError.message);

      return res.status(500).json({
        success: false,
        error: ackError.message,
        jid,
        messageId: result.key.id,
      });
    }

    try {
      await session.sock.sendPresenceUpdate("paused", jid);
    } catch {}

    return res.json({
      success: true,
      jid,
      messageId: result.key.id,
      from: session.me || session.sock.user || null,
    });
  } catch (error) {
    console.error("Erro ao enviar áudio:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

app.get("/qr/:id", (req, res) => {
  const session = sessions[String(req.params.id)];

  if (!session) {
    return res.json({
      qr: null,
      status: "offline",
    });
  }

  res.json({
    qr: session.qr,
    status: session.status,
    me: session.me,
  });
});

app.get("/status/:id", (req, res) => {
  const session = sessions[String(req.params.id)];

  res.json({
    status: session?.status || "offline",
    hasQr: Boolean(session?.qr),
    activeSessions: Object.keys(sessions),
    me: session?.me || null,
  });
});

app.get("/me/:id", (req, res) => {
  const session = sessions[String(req.params.id)];

  res.json({
    success: Boolean(session?.sock),
    status: session?.status || "offline",
    me: session?.me || session?.sock?.user || null,
    activeSessions: Object.keys(sessions),
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp server Zentra Food rodando",
    port: PORT,
    appUrl: ZENTRA_APP_URL,
    activeSessions: Object.keys(sessions),
    routing: {
      "all sessions": "Zentra Food CRM",
      endpoint: `${ZENTRA_APP_URL}/api/whatsapp/incoming`,
    },
  });
});

async function restoreSessions() {
  try {
    const sessionsDir = path.join(__dirname, "sessions");

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      return;
    }

    const folders = fs
      .readdirSync(sessionsDir)
      .filter((file) =>
        fs.statSync(path.join(sessionsDir, file)).isDirectory()
      );

    console.log("♻️ Restaurando sessões:", folders);

    for (const sessionId of folders) {
      try {
        await startSession(sessionId);
      } catch (error) {
        console.error(
          `Erro ao restaurar sessão ${sessionId}:`,
          error?.message || error
        );
      }
    }
  } catch (error) {
    console.error("Erro ao restaurar sessões:", error);
  }
}

app.listen(PORT, async () => {
  console.log(`🔥 WhatsApp server Zentra Food rodando na porta ${PORT}`);
  console.log(`📌 Todas as sessões → ${ZENTRA_APP_URL}/api/whatsapp/incoming`);

  await restoreSessions();
});