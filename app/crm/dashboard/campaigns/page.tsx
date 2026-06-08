"use client";

import { useEffect, useState } from "react";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

const SESSIONS = [1, 2, 3, 4, 5];
const MAX_PER_SESSION_DAY = 30;

const CAMPAIGN_TYPES = [
  {
    value: "FOLLOW_UP",
    label: "Follow-up sem resposta",
    desc: "Clientes que receberam disparo, mas ainda não responderam.",
  },
  {
    value: "REATIVACAO",
    label: "Reativação",
    desc: "Clientes que responderam ou demonstraram interesse, mas não compraram.",
  },
  {
    value: "POS_VENDA",
    label: "Pós-venda",
    desc: "Clientes que compraram, finalizaram ou estão em etapa de pedido/finalizado.",
  },
  {
    value: "RECUPERACAO",
    label: "Recuperação",
    desc: "Clientes que iniciaram contato, pediram informações, mas não avançaram.",
  },
];

function getLastDate(lead: any) {
  return lead.last_message_at || lead.updated_at || lead.created_at;
}

function daysStopped(lead: any) {
  const date = getLastDate(lead);
  if (!date) return 0;

  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

async function getAvailableSessions(selected: number[]) {
  const online: number[] = [];

  for (const id of selected) {
    try {
      const res = await fetch(
        `/api/whatsapp/qr?sessionId=${id}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (
        data?.status === "online" ||
        data?.me ||
        data?.connected
      ) {
        online.push(id);
      }
    } catch {}
  }

  return online;
}

export default function CampaignsPage() {
  const [campaignType, setCampaignType] = useState("FOLLOW_UP");
  const [targetDays, setTargetDays] = useState(1);
  const [selectedWpp, setSelectedWpp] = useState<number[]>([1, 2, 3, 4, 5]);
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);

  const currentType =
    CAMPAIGN_TYPES.find((item) => item.value === campaignType) ||
    CAMPAIGN_TYPES[0];

  function toggleWpp(id: number) {
    setSelectedWpp((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function loadSessionStats() {
    const stats: Record<number, any> = {};

    for (const session of SESSIONS) {
      let online = false;

      try {
        const res = await fetch(
  `/api/whatsapp/qr?sessionId=${session}`,
  {
    cache: "no-store",
    credentials: "include",
  }
);
        const data = await res.json().catch(() => ({}));
       online =
  data?.status === "online" ||
  Boolean(data?.me) ||
  Boolean(data?.connected);
      } catch {}

      stats[session] = {
        online,
        used: 0,
        remaining: MAX_PER_SESSION_DAY,
      };
    }

    setSessionStats(stats);
  }

  async function loadPreview() {
    const params = new URLSearchParams({
      type: campaignType,
      targetDays: String(targetDays),
      sessions: selectedWpp.join(","),
    });

    const res = await fetch(`/api/crm/campaigns?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao buscar contatos");
      return;
    }

    setPreviewLeads(data || []);
  }

  useEffect(() => {
    loadSessionStats();
  }, []);

  useEffect(() => {
    loadPreview();
  }, [campaignType, targetDays, selectedWpp.join(",")]);

  async function pauseCampaign() {
    const res = await fetch("/api/crm/campaigns", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao pausar campanha");
      return;
    }

    alert(`Campanhas pendentes pausadas: ${data.updated || 0}`);
    await loadSessionStats();
  }

  async function resumeCampaign() {
    const res = await fetch("/api/crm/campaigns", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao retomar campanha");
      return;
    }

    alert(`Campanhas pendentes retomadas: ${data.updated || 0}`);
    await loadSessionStats();
  }

  async function startCampaign() {
    if (!selectedWpp.length) {
      alert("Selecione pelo menos um WhatsApp.");
      return;
    }

    if (!previewLeads.length) {
      alert("Nenhum contato elegível para esta campanha.");
      return;
    }

    const confirmSend = confirm(
      `Colocar ${previewLeads.length} contato(s) na fila de ${currentType.label}?`
    );

    if (!confirmSend) return;

    setLoading(true);

    try {
      const onlineSessions = await getAvailableSessions(selectedWpp);

      if (!onlineSessions.length) {
        alert("Nenhum WhatsApp selecionado está online.");
        return;
      }

      const res = await fetch("/api/crm/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignType,
          targetDays,
          selectedWpp: onlineSessions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao iniciar campanha");
        return;
      }

      alert(`${data.queued || 0} contato(s) colocados na fila.`);
      await loadPreview();
      await loadSessionStats();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
        <section className="rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-purple-950 p-5 shadow-2xl md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
            Zentra Campanhas
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
            Campanhas inteligentes
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-zinc-400 md:text-base">
            Follow-up, reativação, pós-venda e recuperação usando mensagens cadastradas.
          </p>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {SESSIONS.map((session) => {
            const stat = sessionStats[session];
            const used = stat?.used || 0;
            const remaining = stat?.remaining ?? MAX_PER_SESSION_DAY;
            const online = stat?.online;
            const percent = Math.min(100, (used / MAX_PER_SESSION_DAY) * 100);

            return (
              <button
                key={session}
                onClick={() => toggleWpp(session)}
                className={`rounded-3xl border p-4 text-left transition ${
                  selectedWpp.includes(session)
                    ? "border-purple-500 bg-purple-950/40"
                    : "border-zinc-800 bg-zinc-950"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black">WhatsApp {session}</h3>
                  <span
                    className={`h-3 w-3 rounded-full ${
                      online ? "bg-emerald-400" : "bg-red-500"
                    }`}
                  />
                </div>

                <div className="mt-3 text-2xl font-black">
                  {used}/{MAX_PER_SESSION_DAY}
                </div>

                <p className="mt-1 text-xs text-zinc-400">
                  {online ? "Online" : "Offline"} • Restam {remaining}
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
            );
          })}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-4">
          {CAMPAIGN_TYPES.map((item) => (
            <button
              key={item.value}
              onClick={() => setCampaignType(item.value)}
              className={`rounded-[2rem] border p-5 text-left transition ${
                campaignType === item.value
                  ? "border-purple-500 bg-purple-950/40"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <h2 className="text-xl font-black">{item.label}</h2>
              <p className="mt-2 text-sm text-zinc-400">{item.desc}</p>
            </button>
          ))}
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Dias sem resposta/atividade
              </label>

              <select
                value={targetDays}
                onChange={(e) => setTargetDays(Number(e.target.value))}
                className="input"
              >
                {[1, 2, 3, 4, 5, 6, 7, 10, 15, 30].map((day) => (
                  <option key={day} value={day}>
                    {day} dia(s)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startCampaign}
              disabled={loading || !previewLeads.length}
              className="rounded-2xl bg-purple-600 px-5 py-4 text-sm font-black text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {loading
                ? "Colocando na fila..."
                : `Iniciar: ${currentType.label}`}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={pauseCampaign}
                className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white hover:bg-red-700"
              >
                ⏸️ Pausar
              </button>

              <button
                onClick={resumeCampaign}
                className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white hover:bg-emerald-700"
              >
                ▶️ Retomar
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-zinc-800 bg-black p-4">
            <h3 className="font-black">Resumo da campanha</h3>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <Card title="Tipo" value={currentType.label} />
              <Card title="Elegíveis" value={previewLeads.length} />
              <Card title="Dias" value={`${targetDays}+`} />
              <Card title="WhatsApps" value={selectedWpp.join(", ")} />
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">Contatos elegíveis</h2>

            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-black text-zinc-400">
              {previewLeads.length} contatos
            </span>
          </div>

          <div className="grid gap-3">
            {previewLeads.slice(0, 50).map((lead) => (
              <div
                key={lead.id}
                className="rounded-2xl border border-zinc-800 bg-black p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-black">
                      {lead.name || "Contato WhatsApp"}
                    </div>

                    <div className="text-sm text-zinc-500">{lead.phone}</div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-400">
                      Status: {lead.status || "novo"}
                    </span>

                    <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-300">
                      {daysStopped(lead)} dia(s)
                    </span>

                    <span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-300">
                      WhatsApp {lead.session_id || 1}
                    </span>

                    {lead.paused && (
                      <span className="rounded-full bg-red-950 px-3 py-1 text-red-400">
                        Pausado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {!previewLeads.length && (
              <div className="rounded-3xl border border-zinc-800 bg-black p-8 text-center text-zinc-500">
                Nenhum contato encontrado para esse critério.
              </div>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #27272a;
          background: #09090b;
          padding: 13px 14px;
          color: white;
          outline: none;
          font-size: 14px;
        }

        .input:focus {
          border-color: #a855f7;
          box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.14);
        }
      `}</style>
    </main>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  );
}