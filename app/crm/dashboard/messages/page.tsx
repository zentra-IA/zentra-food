"use client";

import { useEffect, useState } from "react";

const CAMPAIGN_INTENTS = [
  { value: "OPENING", label: "Abertura", desc: "Primeira mensagem do disparo." },
  { value: "REATIVACAO", label: "Reativação", desc: "Para clientes antigos voltarem a comprar." },
  { value: "POS_VENDA", label: "Pós-venda", desc: "Mensagem depois do pedido entregue." },
  { value: "RECUPERACAO", label: "Recuperação", desc: "Cliente que parou no meio do pedido." },
];

const AI_INTENTS = [
  { value: "OPENING", label: "Primeira resposta", desc: "Mensagem inicial quando o cliente chama." },
  { value: "PERSONALIDADE", label: "Personalidade", desc: "Tom de voz do atendimento." },
  { value: "FAQ_CUSTOM", label: "Mensagem personalizada", desc: "Pergunta e resposta específica do negócio." },
  { value: "CARDAPIO", label: "Cardápio", desc: "Quando pede cardápio/produtos." },
  { value: "PROMOCAO", label: "Promoção", desc: "Quando pergunta por ofertas." },
  { value: "PEDIDO", label: "Pedido", desc: "Quando quer comprar." },
  { value: "ENTREGA", label: "Entrega", desc: "Delivery, taxa e região." },
  { value: "PAGAMENTO", label: "Pagamento", desc: "PIX, dinheiro, cartão." },
  { value: "HORARIO", label: "Horário", desc: "Horário de funcionamento." },
  { value: "ENDERECO", label: "Endereço", desc: "Localização da empresa." },
  { value: "DEFAULT", label: "Padrão", desc: "Quando a IA não entende." },
];

function hasFeature(data: any, feature: string) {
  const fromPlan = data?.features?.some(
    (item: any) => item.feature === feature && item.enabled
  );

  const fromGrant = data?.grants?.some((item: any) => {
    if (item.feature !== feature || !item.active) return false;
    if (!item.expires_at) return true;
    return new Date(item.expires_at) > new Date();
  });

  return Boolean(fromPlan || fromGrant);
}

export default function MessagesPage() {
  const [companyData, setCompanyData] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [type, setType] = useState<"campaign" | "ai">("campaign");
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("OPENING");
  const [baseMessage, setBaseMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const canUseChatbot = hasFeature(companyData, "chatbot_ia");
  const intents = type === "campaign" ? CAMPAIGN_INTENTS : AI_INTENTS;
  const selectedIntent = intents.find((item) => item.value === intent);

  async function loadCompany() {
    const res = await fetch("/api/company/current", {
      cache: "no-store",
      credentials: "include",
    });

    const data = await res.json();
    if (data?.success) setCompanyData(data);
  }

  async function loadTemplates() {
    const res = await fetch("/api/crm/message-templates", {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao carregar mensagens");
      return;
    }

    setTemplates(data || []);
  }

  useEffect(() => {
    loadCompany();
    loadTemplates();
  }, []);

  function changeType(nextType: "campaign" | "ai") {
    if (nextType === "ai" && !canUseChatbot) {
      alert("Chatbot IA está bloqueado no seu plano atual. Faça upgrade para liberar.");
      return;
    }

    setType(nextType);
    setIntent("OPENING");
  }

  async function saveTemplate() {
    if (type === "ai" && !canUseChatbot) {
      alert("Chatbot IA está bloqueado no seu plano atual.");
      return;
    }

    if (!name.trim() || !baseMessage.trim()) {
      alert("Preencha nome e mensagem.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/crm/message-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          intent,
          base_message: baseMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao salvar mensagem");
        return;
      }

      setName("");
      setBaseMessage("");
      setIntent("OPENING");
      setType("campaign");

      await loadTemplates();
    } finally {
      setLoading(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Excluir esta mensagem?")) return;

    const res = await fetch(`/api/crm/message-templates?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao excluir mensagem");
      return;
    }

    await loadTemplates();
  }

  async function toggleTemplate(item: any) {
    const res = await fetch("/api/crm/message-templates", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        active: !item.active,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar mensagem");
      return;
    }

    await loadTemplates();
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white md:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 to-emerald-950 p-5 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
            Zentra CRM
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-5xl">
            Mensagens
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Crie mensagens de disparo e, nos planos liberados, respostas automáticas do Chatbot IA.
          </p>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Nova mensagem</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              value={type}
              onChange={(e) => changeType(e.target.value as "campaign" | "ai")}
              className="input"
            >
              <option value="campaign">Disparo / Campanha</option>
              <option value="ai">
                Resposta da IA / Chatbot {canUseChatbot ? "" : "🔒"}
              </option>
            </select>

            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="input"
            >
              {intents.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            {type === "ai" && !canUseChatbot && (
              <div className="rounded-2xl border border-yellow-700 bg-yellow-950/30 p-4 text-sm text-yellow-200 md:col-span-2">
                🔒 Chatbot IA bloqueado no seu plano atual. Você ainda pode criar mensagens de disparo normalmente.
              </div>
            )}

            {selectedIntent && (
              <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200 md:col-span-2">
                <strong>{selectedIntent.label}:</strong> {selectedIntent.desc}
              </div>
            )}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome interno. Ex: Abertura campanha Junho"
              className="input md:col-span-2"
            />

            <textarea
              value={baseMessage}
              onChange={(e) => setBaseMessage(e.target.value)}
              placeholder="Mensagem. Use variáveis: {nome}, {telefone}, {cardapio}"
              className="input min-h-40 md:col-span-2"
            />
          </div>

          <button
            onClick={saveTemplate}
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black hover:bg-emerald-700 disabled:opacity-50 md:w-auto"
          >
            {loading ? "Salvando..." : "Salvar mensagem"}
          </button>
        </section>

        <section className="mt-5 grid gap-4">
          {templates.map((item) => (
            <article
              key={item.id}
              className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-black">{item.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {item.type === "campaign" ? "Disparo" : "Chatbot IA"} ·{" "}
                    {item.intent} · {item.active ? "Ativa" : "Inativa"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleTemplate(item)}
                    className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-black"
                  >
                    {item.active ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    onClick={() => deleteTemplate(item.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-black p-4 text-sm text-zinc-300">
                {item.base_message}
              </div>
            </article>
          ))}
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