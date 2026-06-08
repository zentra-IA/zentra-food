"use client";

import { useEffect, useRef, useState } from "react";

export default function InboxPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selectedLeadRef = useRef<any>(null);

  useEffect(() => {
    selectedLeadRef.current = selectedLead;
  }, [selectedLead]);

  async function loadLeads() {
    try {
      const res = await fetch(`/api/crm/inbox?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) return;

      setLeads(data || []);

      const current = selectedLeadRef.current;

      if (current?.id) {
        const updated = data.find((lead: any) => lead.id === current.id);

        if (updated) {
          setSelectedLead(updated);
        }
      } else if (data?.length) {
        setSelectedLead(data[0]);
      }
    } catch (error) {
      console.error("Erro loadLeads:", error);
    }
  }

  async function loadMessages(leadId: string) {
    try {
      const res = await fetch(`/api/crm/inbox?leadId=${leadId}&t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) return;

      setMessages(data || []);

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error("Erro loadMessages:", error);
    }
  }

  useEffect(() => {
    loadLeads();

    const interval = setInterval(async () => {
      const current = selectedLeadRef.current;

      await loadLeads();

      if (current?.id) {
        await loadMessages(current.id);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedLead?.id) return;
    loadMessages(selectedLead.id);
  }, [selectedLead?.id]);

  async function sendReply() {
    if (!reply.trim() || !selectedLead) return;

    const message = reply.trim();

    const tempMessage = {
      id: `temp-${Date.now()}`,
      lead_id: selectedLead.id,
      direction: "sent",
      content: message,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setReply("");
    setLoading(true);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const res = await fetch("/api/whatsapp/inbox-send", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          message,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        alert(data?.error || "Erro ao enviar mensagem");

        setMessages((prev) =>
          prev.filter((msg) => msg.id !== tempMessage.id)
        );

        setReply(message);
        return;
      }

      await loadMessages(selectedLead.id);
      await loadLeads();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem");

      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setReply(message);
    } finally {
      setLoading(false);
    }
  }

  async function pauseAI() {
    if (!selectedLead) return;

    const nextPaused = !selectedLead.ai_paused;

    const res = await fetch("/api/crm/inbox", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: selectedLead.id,
        ai_paused: nextPaused,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar IA");
      return;
    }

    setSelectedLead({ ...selectedLead, ai_paused: nextPaused });
    await loadLeads();
  }

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col gap-3 bg-black p-3 text-white md:flex-row">
      <aside className="h-[35vh] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 md:h-full md:w-80">
        <div className="border-b border-zinc-800 p-4">
          <h1 className="text-xl font-black">Inbox</h1>
          <p className="text-sm text-zinc-500">
            Apenas contatos que responderam
          </p>
        </div>

        <div className="h-[calc(100%-73px)] overflow-y-auto">
          {leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className={`w-full border-b border-zinc-900 p-4 text-left transition hover:bg-zinc-900 ${
                selectedLead?.id === lead.id ? "bg-zinc-900" : ""
              }`}
            >
              <div className="truncate font-black">
                {lead.name || "Contato WhatsApp"}
              </div>

              <div className="text-sm text-zinc-500">{lead.phone}</div>

              <div className="mt-1 text-xs text-zinc-600">
                {lead.status || "novo"} · Sessão {lead.session_id || 1}
              </div>
            </button>
          ))}

          {!leads.length && (
            <div className="p-6 text-sm text-zinc-500">
              Nenhuma resposta recebida ainda.
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        {!selectedLead ? (
          <div className="flex flex-1 items-center justify-center text-zinc-500">
            Selecione um contato
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 p-4">
              <div>
                <h2 className="text-xl font-black">
                  {selectedLead.name || "Contato WhatsApp"}
                </h2>
                <p className="text-sm text-zinc-500">
                  {selectedLead.phone} · {selectedLead.status || "novo"}
                </p>
              </div>

              <button
                onClick={pauseAI}
                className={`rounded-2xl px-4 py-2 text-sm font-black ${
                  selectedLead.ai_paused
                    ? "bg-zinc-800 text-zinc-300"
                    : "bg-yellow-600 text-white"
                }`}
              >
                {selectedLead.ai_paused ? "Ativar IA" : "Pausar IA"}
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((msg) => {
                const fromMe =
                  msg.direction === "sent" ||
                  msg.direction === "outgoing" ||
                  msg.from_me === true;

                const text = msg.content || msg.message || "";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      fromMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm md:max-w-[70%] ${
                        fromMe
                          ? "bg-green-600 text-white"
                          : "bg-zinc-800 text-white"
                      }`}
                    >
                      {text}
                    </div>
                  </div>
                );
              })}

              {!messages.length && (
                <div className="pt-10 text-center text-zinc-500">
                  Nenhuma mensagem ainda.
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 border-t border-zinc-800 p-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Digite sua resposta..."
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-green-500"
                rows={2}
              />

              <button
                onClick={sendReply}
                disabled={loading || !reply.trim()}
                className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {loading ? "..." : "Enviar"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}