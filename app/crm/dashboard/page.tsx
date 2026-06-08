"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STAGES = [
  { key: "novo", label: "Novo" },
  { key: "enviado", label: "Enviado" },
  { key: "respondido", label: "Respondeu" },
  { key: "interesse", label: "Interesse" },
  { key: "pedido", label: "Pedido" },
  { key: "campanha", label: "Campanha" },
  { key: "reativar_futuro", label: "Reativar futuro" },
  { key: "finalizado", label: "Finalizado" },
  { key: "sem_interesse", label: "Sem interesse" },
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

function formatDate(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadDashboard() {
    try {
      const res = await fetch("/api/crm/leads", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar leads");
      }

      setLeads(data || []);
    } catch (error: any) {
      console.error("ERRO DASHBOARD:", error);
      alert("Erro ao carregar funil:\n\n" + (error.message || "Erro desconhecido"));
    }
  }

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function moveLead(id: string, status: string) {
    try {
      setLoading(true);

      const res = await fetch("/api/crm/leads/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          id,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao mover contato");
      }

      await loadDashboard();
    } catch (error: any) {
      console.error("ERRO MOVE LEAD:", error);
      alert("Erro ao mover contato:\n\n" + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Zentra CRM</h1>

          <p className="text-zinc-500 mt-2">
            Funil de atendimento, campanhas e WhatsApp.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/crm/dashboard/contacts"
            className="bg-red-600 hover:bg-red-700 px-5 py-3 rounded-xl font-semibold"
          >
            Abrir contatos
          </Link>

          <Link
            href="/crm/dashboard/campaigns"
            className="bg-purple-600 hover:bg-purple-700 px-5 py-3 rounded-xl font-semibold"
          >
            Campanhas
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card title="Total" value={leads.length} />
        <Card title="Novos" value={leads.filter((x) => x.status === "novo").length} />
        <Card title="Enviados" value={leads.filter((x) => x.status === "enviado").length} />
        <Card title="Responderam" value={leads.filter((x) => x.status === "respondido").length} />
        <Card title="Campanhas" value={leads.filter((x) => x.status === "campanha").length} />
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const items = leads
              .filter((lead) => (lead.status || "novo") === stage.key)
              .sort((a, b) => daysStopped(b) - daysStopped(a));

            return (
              <div
                key={stage.key}
                className="w-80 shrink-0 rounded-2xl border border-zinc-800 bg-zinc-950"
              >
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="font-bold">{stage.label}</h2>

                  <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded-full">
                    {items.length}
                  </span>
                </div>

                <div className="p-3 space-y-3 min-h-[420px]">
                  {items.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-zinc-800 bg-black p-4"
                    >
                      <div className="font-bold">
                        {lead.name || "Contato WhatsApp"}
                      </div>

                      <div className="text-sm text-zinc-500 mt-1">
                        {lead.phone}
                      </div>

                      <div className="text-xs text-zinc-600 mt-2">
                        WhatsApp {lead.session_id || 1}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2">
                          <span className="text-zinc-500 block">Parado há</span>
                          <strong className="text-yellow-400">
                            {daysStopped(lead)} dia(s)
                          </strong>
                        </div>

                        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2">
                          <span className="text-zinc-500 block">Atualizado</span>
                          <strong className="text-zinc-300">
                            {formatDate(getLastDate(lead))}
                          </strong>
                        </div>
                      </div>

                      {lead.status === "campanha" && (
                        <div className="mt-2 rounded-lg bg-purple-950/40 border border-purple-800 p-2 text-xs text-purple-300">
                          Campanha {lead.campaign_step || 0}/7
                        </div>
                      )}

                      {lead.status === "reativar_futuro" && (
                        <div className="mt-2 rounded-lg bg-blue-950/40 border border-blue-800 p-2 text-xs text-blue-300">
                          Reativar depois
                        </div>
                      )}

                      {lead.last_message && (
                        <div className="mt-3 text-xs text-zinc-400 line-clamp-3">
                          {lead.last_message}
                        </div>
                      )}

                      <div className="mt-4">
                        <select
                          disabled={loading}
                          value={lead.status || "novo"}
                          onChange={(e) => moveLead(lead.id, e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                        >
                          {STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Link
                        href="/crm/dashboard/inbox"
                        className="mt-3 block text-center bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3 py-2 text-sm"
                      >
                        Abrir conversa
                      </Link>
                    </div>
                  ))}

                  {!items.length && (
                    <div className="text-center text-zinc-600 text-sm py-10">
                      Nenhum contato aqui.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
      <div className="text-zinc-500 text-sm">{title}</div>
      <div className="text-4xl font-bold mt-3">{value}</div>
    </div>
  );
}