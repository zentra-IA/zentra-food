"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

const SESSIONS = [1, 2, 3, 4, 5];
const MAX_PER_SESSION_DAY = 30;

type SessionStats = {
  online: boolean;
  used: number;
  remaining: number;
};

function cleanPhone(value: any) {
  return String(value || "").replace(/\D/g, "");
}

async function getAvailableSessions() {
  const online: number[] = [];

  for (const id of SESSIONS) {
    try {
      const res = await fetch(`${WHATSAPP_SERVER}/status/${id}`);
      const data = await res.json().catch(() => ({}));

      if (data.status === "online" || data.connected === true) {
        online.push(id);
      }
    } catch {}
  }

  return online;
}

export default function ContactsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [sessionId, setSessionId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sessionStats, setSessionStats] = useState<Record<number, SessionStats>>({});

  async function loadLeads() {
    const res = await fetch("/api/crm/leads", {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao carregar contatos");
      return;
    }

    setLeads(data || []);
  }

  async function saveLead(payload: { name: string; phone: string; session_id: number }) {
    const res = await fetch("/api/crm/leads", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Erro ao salvar contato");

    return data;
  }

  async function queueLeadCampaign(lead: any, intent: string, label: string) {
    try {
      setLoading(true);

      const res = await fetch("/api/crm/queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          intent,
          session_id: Number(lead.session_id || sessionId || 1),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Erro ao colocar ${label} na fila`);

      alert(`${label} colocado na fila para ${lead.name || lead.phone}`);
      await loadLeads();
      await loadSessionStats();
    } catch (error: any) {
      alert(error.message || "Erro ao colocar na fila");
    } finally {
      setLoading(false);
    }
  }

  async function pauseAllQueue() {
    const res = await fetch("/api/crm/queue", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao pausar fila");
      return;
    }

    alert(`Fila pausada. Itens atualizados: ${data.updated || 0}`);
  }

  async function resumeAllQueue() {
    const res = await fetch("/api/crm/queue", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao retomar fila");
      return;
    }

    alert(`Fila retomada. Itens atualizados: ${data.updated || 0}`);
  }

  async function loadSessionStats() {
    const stats: Record<number, SessionStats> = {};

    for (const session of SESSIONS) {
      let online = false;

      try {
        const res = await fetch(`${WHATSAPP_SERVER}/status/${session}`);
        const data = await res.json().catch(() => ({}));
        online = data.status === "online" || data.connected === true;
      } catch {}

      stats[session] = {
        online,
        used: 0,
        remaining: MAX_PER_SESSION_DAY,
      };
    }

    setSessionStats(stats);
  }

  useEffect(() => {
    loadLeads();
    loadSessionStats();

    const interval = setInterval(() => {
      loadLeads();
      loadSessionStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  function parseLine(line: string) {
    const parts = line
      .split(/[,\t;]/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (parts.length === 1) {
      return {
        name: "Contato WhatsApp",
        phone: cleanPhone(parts[0]),
      };
    }

    return {
      name: parts[0] || "Contato WhatsApp",
      phone: cleanPhone(parts[1]),
    };
  }

  function getBestSession(sessionsToUse: number[], index: number) {
    return sessionsToUse[index % sessionsToUse.length];
  }

  async function importBulkText() {
    try {
      setLoading(true);

      const lines = bulkText.split("\n").map((line) => line.trim()).filter(Boolean);
      const onlineSessions = await getAvailableSessions();
      const sessionsToUse = onlineSessions.length > 0 ? onlineSessions : [sessionId];

      let imported = 0;
      let currentSession = 0;

      for (const line of lines) {
        const contact = parseLine(line);
        if (!contact.phone) continue;

        const assignedSession = getBestSession(sessionsToUse, currentSession);
        currentSession++;

        await saveLead({
          name: contact.name,
          phone: contact.phone,
          session_id: assignedSession,
        });

        imported++;
      }

      setBulkText("");
      await loadLeads();
      await loadSessionStats();

      alert(`${imported} contatos adicionados.`);
    } catch (error: any) {
      alert(error.message || "Erro ao importar");
    } finally {
      setLoading(false);
    }
  }

  async function importFile(file: File) {
    try {
      setLoading(true);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      const onlineSessions = await getAvailableSessions();
      const sessionsToUse = onlineSessions.length > 0 ? onlineSessions : [sessionId];

      let imported = 0;
      let currentSession = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        const rowName = String(row[0] || "Contato WhatsApp").trim();
        const rowPhone = cleanPhone(row[1]);

        if (!rowPhone) continue;

        const assignedSession = getBestSession(sessionsToUse, currentSession);
        currentSession++;

        await saveLead({
          name: rowName,
          phone: rowPhone,
          session_id: assignedSession,
        });

        imported++;
      }

      await loadLeads();
      await loadSessionStats();

      alert(`${imported} contatos importados.`);
    } catch (error: any) {
      alert(error.message || "Erro ao importar arquivo");
    } finally {
      setLoading(false);
    }
  }

  async function addManualLead() {
    const clean = cleanPhone(phone);

    if (!clean) {
      alert("Digite um telefone");
      return;
    }

    try {
      await saveLead({
        name: name || "Contato WhatsApp",
        phone: clean,
        session_id: sessionId,
      });

      setName("");
      setPhone("");

      await loadLeads();
      await loadSessionStats();
    } catch (error: any) {
      alert(error.message || "Erro ao salvar");
    }
  }

  async function dispararLead(lead: any) {
    await queueLeadCampaign(lead, "OPENING", "Disparo");
  }

  async function editarLead() {
    alert("Edição será migrada para API segura depois.");
  }

  async function excluirLead(lead: any) {
    if (!confirm(`Excluir ${lead.name || lead.phone}?`)) return;

    const res = await fetch(`/api/crm/leads?id=${lead.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao excluir");
      return;
    }

    await loadLeads();
    await loadSessionStats();
  }

  async function dispararLeads() {
    const novos = leads.filter((lead) => (lead.status || "novo") === "novo");

    if (!novos.length) {
      alert("Nenhum contato novo para disparar.");
      return;
    }

    if (!confirm(`Colocar ${novos.length} contatos novos na fila?`)) return;

    try {
      setLoading(true);

      let total = 0;

      for (const lead of novos) {
        await queueLeadCampaign(lead, "OPENING", "Disparo");
        total++;
      }

      alert(`${total} contatos colocados na fila.`);
      await loadLeads();
      await loadSessionStats();
    } catch (error: any) {
      alert(error.message || "Erro no disparo em massa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-emerald-950 p-5 shadow-2xl md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
            Zentra Disparo
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
            Contatos e Disparos
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-zinc-400 md:text-base">
            Importe contatos, distribua entre WhatsApps 1 a 5 e acompanhe o limite diário.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {SESSIONS.map((session) => {
              const stat = sessionStats[session];
              const used = stat?.used || 0;
              const remaining = stat?.remaining ?? MAX_PER_SESSION_DAY;
              const online = stat?.online;
              const percent = Math.min(100, (used / MAX_PER_SESSION_DAY) * 100);

              return (
                <div key={session} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black">WhatsApp {session}</h3>
                    <span className={`h-3 w-3 rounded-full ${online ? "bg-emerald-400" : "bg-red-500"}`} />
                  </div>

                  <div className="mt-3 text-2xl font-black">
                    {used}/{MAX_PER_SESSION_DAY}
                  </div>

                  <p className="mt-1 text-xs text-zinc-400">
                    {online ? "Online" : "Offline"} • Restam {remaining}
                  </p>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-black">Importar planilha</h2>
            <p className="mt-1 text-sm text-zinc-500">Coluna A = nome • Coluna B = telefone.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select value={sessionId} onChange={(e) => setSessionId(Number(e.target.value))} className="input">
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    WhatsApp {s}
                  </option>
                ))}
              </select>

              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importFile(file);
                }}
                className="input"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={dispararLeads}
                disabled={loading}
                className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Processando..." : "🚀 Disparo"}
              </button>

              <button
                onClick={pauseAllQueue}
                className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white transition hover:bg-red-700"
              >
                ⏸️ Pausar
              </button>

              <button
                onClick={resumeAllQueue}
                className="rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white transition hover:bg-blue-700"
              >
                ▶️ Retomar
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-black">Adicionar manual</h2>
            <p className="mt-1 text-sm text-zinc-500">Crie um contato rápido e escolha o WhatsApp.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="input" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="input" />

              <button onClick={addManualLead} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
                Adicionar
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Colar contatos em massa</h2>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`João, 11999999999\nMaria, 21988888888`}
            className="mt-4 min-h-44 w-full resize-none rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm outline-none focus:border-emerald-500"
          />

          <button
            onClick={importBulkText}
            disabled={loading || !bulkText.trim()}
            className="mt-4 w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50 md:w-auto"
          >
            {loading ? "Importando..." : "Adicionar com distribuição inteligente"}
          </button>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Base de contatos</h2>
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-black text-zinc-400">
              {leads.length} contatos
            </span>
          </div>

          <div className="grid gap-3">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-black">{lead.name || "Contato WhatsApp"}</div>
                    <div className="mt-1 text-sm text-zinc-400">{lead.phone}</div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-400">
                        Status: {lead.status || "novo"}
                      </span>

                      <span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-400">
                        WhatsApp {lead.session_id || 1}
                      </span>

                      {lead.ai_paused && (
                        <span className="rounded-full bg-yellow-950 px-3 py-1 text-yellow-400">
                          IA pausada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                    <button onClick={() => dispararLead(lead)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700">
                      Disparar
                    </button>

                    <button onClick={() => queueLeadCampaign(lead, "REATIVACAO", "Reativação")} className="rounded-2xl bg-purple-600 px-4 py-3 text-xs font-black text-white hover:bg-purple-700">
                      Reativar
                    </button>

                    <button onClick={() => queueLeadCampaign(lead, "POS_VENDA", "Pós-venda")} className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-700">
                      Pós-venda
                    </button>

                    <button onClick={() => queueLeadCampaign(lead, "RECUPERACAO", "Recuperação")} className="rounded-2xl bg-orange-600 px-4 py-3 text-xs font-black text-white hover:bg-orange-700">
                      Recuperar
                    </button>

                    <button onClick={editarLead} className="rounded-2xl bg-yellow-600 px-4 py-3 text-xs font-black text-white hover:bg-yellow-700">
                      Editar
                    </button>

                    <button onClick={() => excluirLead(lead)} className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white hover:bg-red-700">
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!leads.length && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
                Nenhum contato cadastrado ainda.
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
          border-color: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.14);
        }
      `}</style>
    </main>
  );
}