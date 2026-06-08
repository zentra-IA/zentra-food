"use client";

import { useEffect, useState } from "react";

export default function CampaignPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  const [campaignName, setCampaignName] = useState("");
  const [emailAccountId, setEmailAccountId] = useState("");
  const [batchId, setBatchId] = useState("");

  const [objetivo, setObjetivo] = useState("");
  const [assunto, setAssunto] = useState("");
  const [textoEmail, setTextoEmail] = useState("");

  const [subjects, setSubjects] = useState<string[]>([]);
  const [messages, setMessages] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    const accRes = await fetch("/api/email/accounts", {
      credentials: "include",
      cache: "no-store",
    });

    const accData = await accRes.json();
    setAccounts(accData.accounts || []);

    if (accData.accounts?.[0]) {
      setEmailAccountId(accData.accounts[0].id);
    }

    const batchRes = await fetch("/api/email/batches", {
      credentials: "include",
      cache: "no-store",
    });

    const batchData = await batchRes.json();
    setBatches(batchData.batches || []);

    if (batchData.batches?.[0]) {
      setBatchId(batchData.batches[0].id);
    }
  }

  async function gerarIA() {
    setLoading(true);

    try {
      const res = await fetch("/api/email/ai-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objetivo }),
      });

      const data = await res.json();

      setAssunto(data.subject || "");
      setSubjects(data.subjects || []);
      setMessages(data.messages || []);

      if (data.messages?.[0]) {
        setTextoEmail(data.messages[0]);
      }
    } catch {
      alert("Erro ao gerar IA");
    }

    setLoading(false);
  }

  async function criarCampanha() {
    if (!campaignName.trim()) return alert("Digite o nome da campanha");
    if (!emailAccountId) return alert("Selecione uma conta de envio");
    if (!batchId) return alert("Selecione um lote");
    if (!assunto.trim()) return alert("Digite ou gere um assunto");
    if (!textoEmail.trim()) return alert("Digite ou gere o texto do email");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Olá [Nome],</p>
        <p>${textoEmail.replace(/\n/g, "<br/>")}</p>
        <br/>
        <a href="https://wa.me/5511911206933"
          style="background:#25D366;padding:12px 20px;color:white;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
          Falar no WhatsApp
        </a>
        <br/><br/>
        <p>[Seu Nome]</p>
      </div>
    `;

    setSaving(true);

    const res = await fetch("/api/email/campaigns/create-from-batch", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaignName,
        subject: assunto,
        html,
        emailAccountId,
        batchId,
      }),
    });

    const data = await res.json();

    setSaving(false);

    if (!data.success) {
      alert(data.error || "Erro ao criar campanha");
      return;
    }

    alert(`Campanha criada com ${data.recipients} destinatários`);

    setCampaignName("");
    setObjetivo("");
    setAssunto("");
    setTextoEmail("");
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-4xl font-bold">Campanha IA</h1>

      <input
        value={campaignName}
        onChange={(e) => setCampaignName(e.target.value)}
        placeholder="Nome da campanha. Ex: Promoção Junho"
        className="mt-6 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      />

      <label className="mt-6 mb-2 block font-bold">Conta de envio</label>

      <select
        value={emailAccountId}
        onChange={(e) => setEmailAccountId(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      >
        <option value="">Selecione a conta de envio</option>

        {accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.from_email} — {acc.domain}
          </option>
        ))}
      </select>

      <label className="mt-6 mb-2 block font-bold">Selecionar lote</label>

      <select
        value={batchId}
        onChange={(e) => setBatchId(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      >
        <option value="">Selecione um lote</option>

        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.name} — {batch.total || 0} contatos
          </option>
        ))}
      </select>

      {batches.length === 0 && (
        <p className="mt-2 text-sm text-yellow-400">
          Nenhum lote encontrado. Importe contatos primeiro.
        </p>
      )}

      <textarea
        value={objetivo}
        onChange={(e) => setObjetivo(e.target.value)}
        placeholder="Ex: campanha de promoção para clientes antigos"
        className="mt-6 h-32 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      />

      <button
        onClick={gerarIA}
        disabled={loading}
        className="mt-4 rounded-xl bg-purple-600 px-6 py-3 disabled:opacity-40"
      >
        {loading ? "Gerando..." : "Gerar IA"}
      </button>

      <label className="mt-6 mb-2 block font-bold">Assunto do email</label>

      <input
        value={assunto}
        onChange={(e) => setAssunto(e.target.value)}
        placeholder="Assunto"
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      />

      <label className="mt-6 mb-2 block font-bold">Texto do email</label>

      <textarea
        value={textoEmail}
        onChange={(e) => setTextoEmail(e.target.value)}
        placeholder="Texto que será enviado no email"
        className="h-48 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      />

      <p className="mt-2 text-sm text-zinc-500">
        O sistema troca automaticamente [Nome] pelo nome do contato.
      </p>

      <button
        onClick={criarCampanha}
        disabled={saving}
        className="mt-6 rounded-xl bg-green-600 px-6 py-3 font-bold disabled:opacity-40"
      >
        {saving ? "Criando..." : "Criar campanha"}
      </button>

      <div className="mt-8">
        <h2 className="font-bold">Assuntos alternativos</h2>

        {subjects.map((s, i) => (
          <button
            key={i}
            onClick={() => setAssunto(s)}
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left hover:border-purple-500"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="font-bold">Mensagens IA</h2>

        {messages.map((m, i) => (
          <button
            key={i}
            onClick={() => setTextoEmail(m)}
            className="mt-4 w-full whitespace-pre-line rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left hover:border-purple-500"
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}