"use client";

import { useEffect, useState } from "react";

const SESSIONS = [1, 2, 3, 4, 5];

function getCompanyId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("active_company_id") || "";
}

function buildHeaders() {
  const companyId = getCompanyId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (companyId) {
    headers["x-company-id"] = companyId;
  }

  return headers;
}

export default function WhatsAppPage() {
  const [sessions, setSessions] = useState<any>({});
  const [loading, setLoading] = useState<number | null>(null);

  async function callWhatsApp(action: string, sessionId: number) {
    let url = "";
    let method: "GET" | "POST" = "GET";

    if (action === "qr") {
      url = `/api/whatsapp/qr?sessionId=${sessionId}`;
      method = "GET";
    }

    if (action === "start") {
      url = "/api/whatsapp/start";
      method = "POST";
    }

    if (action === "restart") {
      url = "/api/whatsapp/restart";
      method = "POST";
    }

    const res = await fetch(url, {
      method,
      headers: buildHeaders(),
      body:
        method === "POST"
          ? JSON.stringify({
              sessionId: String(sessionId),
            })
          : undefined,
      cache: "no-store",
      credentials: "include",
    });

    return res.json();
  }

  async function loadQr(sessionId: number) {
    try {
      const data = await callWhatsApp("qr", sessionId);

      setSessions((prev: any) => ({
        ...prev,
        [sessionId]: data,
      }));
    } catch {
      setSessions((prev: any) => ({
        ...prev,
        [sessionId]: {
          status: "offline",
          qr: null,
        },
      }));
    }
  }

  async function loadAll() {
    await Promise.all(SESSIONS.map((id) => loadQr(id)));
  }

  async function gerarQr(sessionId: number) {
    setLoading(sessionId);

    try {
      await callWhatsApp("start", sessionId);

      setTimeout(() => {
        loadQr(sessionId);
        setLoading(null);
      }, 3000);
    } catch {
      alert("Erro ao gerar QR");
      setLoading(null);
    }
  }

  async function resetarSessao(sessionId: number) {
    const ok = confirm(
      `Resetar o WhatsApp ${sessionId}? Isso vai gerar uma nova sessão para esta empresa.`
    );

    if (!ok) return;

    setLoading(sessionId);

    try {
      await callWhatsApp("restart", sessionId);

      setTimeout(() => {
        loadQr(sessionId);
        setLoading(null);
      }, 4000);
    } catch {
      alert("Erro ao resetar sessão");
      setLoading(null);
    }
  }

  useEffect(() => {
    loadAll();

    const interval = setInterval(() => {
      loadAll();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-black p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-green-950/40 p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-green-400">
            WhatsApp Multiempresa
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-5xl">
            💬 Conectar WhatsApp
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Cada empresa possui sessões isoladas. Nenhum WhatsApp será misturado
            entre clientes diferentes.
          </p>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {SESSIONS.map((sessionId) => {
            const session = sessions[sessionId];
            const status = session?.status || "offline";
            const qr = session?.qr || null;
            const isOnline = status === "online";
            const isQr = status === "qr_pending";

            return (
              <div
                key={sessionId}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-black">
                      WhatsApp {sessionId}
                    </h2>

                    <p
                      className={`mt-1 text-sm font-bold ${
                        isOnline
                          ? "text-green-400"
                          : isQr
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {isOnline
                        ? "Conectado"
                        : isQr
                        ? "Aguardando QR"
                        : "Desconectado"}
                    </p>
                  </div>

                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-black text-zinc-300">
                    Sessão {sessionId}
                  </span>
                </div>

                <div className="mb-5 flex min-h-[280px] items-center justify-center rounded-3xl border border-zinc-800 bg-black">
                  {isOnline ? (
                    <div className="text-center">
                      <div className="mb-3 text-5xl">✅</div>
                      <p className="font-black text-green-400">
                        WhatsApp conectado
                      </p>
                      {session?.companyId && (
                        <p className="mt-2 text-xs text-zinc-600">
                          Empresa: {session.companyId}
                        </p>
                      )}
                    </div>
                  ) : qr ? (
                    <div className="text-center">
                      <img
                        src={qr}
                        alt={`QR WhatsApp ${sessionId}`}
                        className="mx-auto h-64 w-64 rounded-2xl bg-white p-3"
                      />

                      <p className="mt-3 text-sm text-zinc-400">
                        Leia este QR no WhatsApp
                      </p>
                    </div>
                  ) : (
                    <div className="text-center text-zinc-500">
                      <div className="mb-3 text-4xl">📲</div>
                      <p>Nenhum QR gerado</p>
                      {session?.error && (
                        <p className="mt-2 text-xs text-red-400">
                          {session.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => gerarQr(sessionId)}
                    disabled={loading === sessionId}
                    className="rounded-2xl bg-green-600 px-4 py-3 font-black hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading === sessionId ? "Gerando..." : "Gerar QR"}
                  </button>

                  <button
                    onClick={() => resetarSessao(sessionId)}
                    disabled={loading === sessionId}
                    className="rounded-2xl bg-red-600 px-4 py-3 font-black hover:bg-red-700 disabled:opacity-50"
                  >
                    Resetar
                  </button>

                  <button
                    onClick={() => loadQr(sessionId)}
                    className="rounded-2xl bg-zinc-800 px-4 py-3 font-black hover:bg-zinc-700"
                  >
                    Atualizar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}