"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function ContactDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [classification, setClassification] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingManual, setSendingManual] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchContact();
  }, []);

  async function fetchContact() {
    setPageLoading(true);

    const { data: contactData } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();

    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: true });

    setContact(contactData);
    setMessages(messagesData || []);
    setPageLoading(false);
  }

  async function reactivateAI() {
    setLoading(true);

    const { error } = await supabase
      .from("contacts")
      .update({
        ai_paused: false,
        conversation_stage: "discovering_objection",
        status: "apresentacao_enviada",
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert("Erro ao reativar IA.");
      console.error(error);
      return;
    }

    await fetchContact();
    alert("IA reativada.");
  }

  async function pauseAI() {
    setLoading(true);

    const { error } = await supabase
      .from("contacts")
      .update({
        ai_paused: true,
        conversation_stage: "human_handoff",
        status: "cotacao",
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert("Erro ao pausar IA.");
      console.error(error);
      return;
    }

    await fetchContact();
    alert("IA pausada.");
  }

  async function resetFunnel() {
    setLoading(true);

    const { error } = await supabase
      .from("contacts")
      .update({
        ai_paused: false,
        conversation_stage: "new",
        status: "novo",
        last_message: null,
        last_message_at: null,
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert("Erro ao resetar funil.");
      console.error(error);
      return;
    }

    await fetchContact();
    alert("Funil resetado.");
  }

  async function markAsQuote() {
    setLoading(true);

    const { error } = await supabase
      .from("contacts")
      .update({
        ai_paused: true,
        conversation_stage: "human_handoff",
        status: "cotacao",
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert("Erro ao marcar como cotação.");
      console.error(error);
      return;
    }

    await fetchContact();
    alert("Contato marcado como cotação.");
  }

  async function sendManualMessage() {
    if (!manualMessage.trim()) {
      alert("Digite uma mensagem.");
      return;
    }

    setSendingManual(true);

    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactId: id,
        message: manualMessage,
        sessionId: "1",
      }),
    });

    const data = await res.json();

    setSendingManual(false);

    if (!data.success) {
      alert(data.error || "Erro ao enviar mensagem.");
      return;
    }

    setManualMessage("");
    await fetchContact();
  }

  async function classifyMessage() {
    if (!message.trim()) {
      alert("Digite uma mensagem para classificar.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      const result = data.classification || "resposta_confusa";

      setClassification(result);

      let newStatus = contact.status || "novo";
      let isBlacklisted = contact.is_blacklisted || false;
      let removalReason = contact.removal_reason || null;
      let nextMessageType: string | null = null;

      if (result === "resposta_neutra") {
        newStatus = "respondeu";
        nextMessageType = "apresentacao";
      }

      if (
        result === "pedido_cotacao" ||
        result === "quer_promocoes" ||
        result === "interessado"
      ) {
        newStatus = "cotacao";
        nextMessageType = "encaminhar_manual";
      }

      if (result === "ja_compra_pmg" || result === "tem_vendedor_pmg") {
        newStatus = "cliente_pmg";
        removalReason = "Cliente já possui relacionamento PMG";
      }

      if (
        result === "sem_interesse" ||
        result === "remover" ||
        result === "empresa_fechou"
      ) {
        newStatus = "removido";
        isBlacklisted = true;
        removalReason = "Cliente removido da automação";
      }

      if (result === "reclamacao_preco") {
        newStatus = "interessado";
        nextMessageType = "recuperacao_preco";
      }

      if (result === "reclamacao_entrega") {
        newStatus = "interessado";
        nextMessageType = "recuperacao_entrega";
      }

      if (result === "reclamacao_atendimento") {
        newStatus = "interessado";
        nextMessageType = "recuperacao_atendimento";
      }

      if (result === "resposta_confusa") {
        newStatus = "revisar";
      }

      await supabase.from("ai_classifications").insert({
        contact_id: id,
        classification: result,
      });

      await supabase.from("messages").insert({
        contact_id: id,
        direction: "received",
        content: message,
      });

      await supabase
        .from("contacts")
        .update({
          status: newStatus,
          is_blacklisted: isBlacklisted,
          removal_reason: removalReason,
          last_message: message,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (nextMessageType) {
        await supabase.from("automation_queue").insert({
          contact_id: id,
          message_type: nextMessageType,
          scheduled_at: new Date().toISOString(),
          status: "pending",
        });
      }

      setMessage("");
      await fetchContact();
    } catch (error) {
      console.error(error);
      alert("Erro ao classificar mensagem.");
    } finally {
      setLoading(false);
    }
  }

  function openWhatsApp() {
    if (!contact?.phone && !contact?.telefone) return;

    const rawPhone = contact.phone || contact.telefone;
    const phone = String(rawPhone).replace(/\D/g, "");

    window.open(`https://wa.me/55${phone}`, "_blank");
  }

  if (pageLoading) return <div className="p-6">Carregando...</div>;
  if (!contact) return <div className="p-6">Contato não encontrado.</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Detalhe do Contato</h1>

      <div className="border rounded-lg p-4 space-y-2">
        <p>
          <strong>Nome:</strong> {contact.name || contact.nome || "Sem nome"}
        </p>
        <p>
          <strong>Telefone:</strong>{" "}
          {contact.phone || contact.telefone || "Sem telefone"}
        </p>
        <p>
          <strong>WhatsApp LID:</strong>{" "}
          {contact.whatsapp_lid || "Não vinculado"}
        </p>
        <p>
          <strong>Status:</strong> {contact.status || "Sem status"}
        </p>
        <p>
          <strong>Etapa:</strong>{" "}
          {contact.conversation_stage || "Sem etapa"}
        </p>
        <p>
          <strong>IA pausada:</strong> {contact.ai_paused ? "Sim" : "Não"}
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Ações rápidas</h2>

        <div className="flex gap-3 flex-wrap">
          <button onClick={openWhatsApp} className="bg-green-600 text-white px-4 py-2 rounded">
            Abrir WhatsApp
          </button>

          <button onClick={reactivateAI} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
            Reativar IA
          </button>

          <button onClick={pauseAI} disabled={loading} className="bg-yellow-500 text-black px-4 py-2 rounded">
            Pausar IA
          </button>

          <button onClick={markAsQuote} disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded">
            Marcar como cotação
          </button>

          <button onClick={resetFunnel} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded">
            Resetar funil
          </button>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Responder pelo CRM</h2>

        <textarea
          value={manualMessage}
          onChange={(e) => setManualMessage(e.target.value)}
          placeholder="Digite a resposta manual..."
          className="w-full border rounded p-3 min-h-24"
        />

        <button
          onClick={sendManualMessage}
          disabled={sendingManual}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {sendingManual ? "Enviando..." : "Enviar mensagem"}
        </button>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Histórico de Conversa</h2>

        {messages.length === 0 && (
          <p className="text-gray-500">Nenhuma mensagem ainda.</p>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded max-w-[80%] ${
                msg.direction === "received"
                  ? "bg-gray-200"
                  : "bg-green-200 ml-auto"
              }`}
            >
              <p className="text-sm whitespace-pre-line">{msg.content}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(msg.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}