"use client";

import { useEffect, useState } from "react";

const CAMPAIGN_INTENTS = [
  { value: "OPENING", label: "Abertura", desc: "Primeira mensagem do disparo." },
  { value: "REATIVACAO", label: "Reativação", desc: "Clientes antigos voltarem a comprar." },
  { value: "POS_VENDA", label: "Pós-venda", desc: "Mensagem depois do pedido entregue." },
  { value: "RECUPERACAO", label: "Recuperação", desc: "Cliente que parou no meio do pedido." },
];

const AI_INTENTS = [
  { value: "OPENING", label: "Primeira resposta", desc: "Quando o cliente chama." },
  { value: "FAQ_CUSTOM", label: "Mensagem por gatilho", desc: "Se o cliente responder X, o robô responde Y." },
  { value: "CARDAPIO", label: "Cardápio", desc: "Quando pede cardápio/produtos." },
  { value: "PROMOCAO", label: "Promoção", desc: "Quando pergunta por ofertas." },
  { value: "PEDIDO", label: "Pedido", desc: "Quando quer comprar." },
  { value: "ENTREGA", label: "Entrega", desc: "Delivery, taxa e região." },
  { value: "PAGAMENTO", label: "Pagamento", desc: "PIX, dinheiro, cartão." },
  { value: "HORARIO", label: "Horário", desc: "Horário de funcionamento." },
  { value: "ENDERECO", label: "Endereço", desc: "Localização da empresa." },
  { value: "DEFAULT", label: "Padrão", desc: "Quando a IA não entende." },
];

const KANBAN_STATUS = [
  { value: "", label: "Não mover no Kanban" },
  { value: "novo", label: "Novo" },
  { value: "respondido", label: "Respondido" },
  { value: "interesse", label: "Interesse" },
  { value: "pedido", label: "Pedido" },
  { value: "finalizado", label: "Finalizado" },
  { value: "sem_interesse", label: "Sem interesse" },
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

function formatTriggers(value: any) {
  if (Array.isArray(value)) return value.join("\n");
  return "";
}

export default function MessagesPage() {
  const [companyData, setCompanyData] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  const [type, setType] = useState<"campaign" | "ai">("campaign");
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("OPENING");
  const [baseMessage, setBaseMessage] = useState("");
  const [triggerKeywords, setTriggerKeywords] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [kanbanStatus, setKanbanStatus] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("text");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canUseChatbot = hasFeature(companyData, "chatbot_ia");
  const intents = type === "campaign" ? CAMPAIGN_INTENTS : AI_INTENTS;
  const selectedIntent = intents.find((item) => item.value === intent);
  const isCustomTrigger = type === "ai" && intent === "FAQ_CUSTOM";

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
      alert("Chatbot IA está bloqueado no seu plano atual.");
      return;
    }

    setType(nextType);
    setIntent("OPENING");
    setTriggerKeywords("");
    setKanbanStatus("");
  }

  async function uploadFile(file: File) {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "message-templates");

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || data.details || "Erro ao enviar arquivo");
        return;
      }

      setMediaUrl(data.mediaUrl || data.url);
      setMediaType(data.mediaType || "file");
    } finally {
      setUploading(false);
    }
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

    if (isCustomTrigger && !triggerKeywords.trim()) {
      alert("Para mensagem por gatilho, preencha pelo menos um gatilho.");
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
          trigger_keywords: triggerKeywords,
          match_type: matchType,
          media_url: mediaUrl || null,
          media_type: mediaUrl ? mediaType : "text",
          kanban_status: kanbanStatus || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao salvar mensagem");
        return;
      }

      setName("");
      setBaseMessage("");
      setTriggerKeywords("");
      setMediaUrl("");
      setMediaType("text");
      setKanbanStatus("");
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
            Crie mensagens de disparo, respostas automáticas por gatilho, áudio, imagem, PDF e movimentação no Kanban.
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
                Resposta automática / Chatbot {canUseChatbot ? "" : "🔒"}
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

            {selectedIntent && (
              <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200 md:col-span-2">
                <strong>{selectedIntent.label}:</strong> {selectedIntent.desc}
              </div>
            )}

            {isCustomTrigger && (
              <>
                <textarea
                  value={triggerKeywords}
                  onChange={(e) => setTriggerKeywords(e.target.value)}
                  placeholder={`Gatilhos do cliente, um por linha.\nEx:\nsim\nquero\nquero simular\ntenho interesse`}
                  className="input min-h-32 md:col-span-2"
                />

                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="input"
                >
                  <option value="contains">Contém a palavra/frase</option>
                  <option value="exact">Texto exato</option>
                  <option value="starts_with">Começa com</option>
                </select>

                <select
                  value={kanbanStatus}
                  onChange={(e) => setKanbanStatus(e.target.value)}
                  className="input"
                >
                  {KANBAN_STATUS.map((item) => (
                    <option key={item.value || "none"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome interno. Ex: Resposta FGTS - Quero simular"
              className="input md:col-span-2"
            />

            <textarea
              value={baseMessage}
              onChange={(e) => setBaseMessage(e.target.value)}
              placeholder="Mensagem do robô. Use variáveis: {nome}, {telefone}, {cardapio}"
              className="input min-h-40 md:col-span-2"
            />

            <div className="rounded-2xl border border-zinc-800 bg-black p-4 md:col-span-2">
              <p className="text-sm font-black">Mídia opcional</p>
              <p className="mt-1 text-xs text-zinc-500">
                Você pode anexar áudio, imagem, PDF ou vídeo junto com o texto.
              </p>

              <input
                type="file"
                accept="image/*,audio/*,video/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
                className="mt-3 block w-full text-sm text-zinc-300"
              />

              {uploading && (
                <p className="mt-2 text-xs text-yellow-300">
                  Enviando arquivo...
                </p>
              )}

              {mediaUrl && (
                <div className="mt-3 rounded-xl bg-zinc-900 p-3 text-xs text-zinc-300">
                  <p>
                    <strong>Arquivo:</strong> {mediaType}
                  </p>
                  <p className="mt-1 break-all text-zinc-500">{mediaUrl}</p>
                  <button
                    onClick={() => {
                      setMediaUrl("");
                      setMediaType("text");
                    }}
                    className="mt-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-black"
                  >
                    Remover mídia
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={saveTemplate}
            disabled={loading || uploading}
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
                    {item.type === "campaign" ? "Disparo" : "Chatbot"} ·{" "}
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

              {item.trigger_keywords?.length > 0 && (
                <div className="mt-4 rounded-2xl bg-emerald-950/30 p-4 text-sm text-emerald-200">
                  <strong>Gatilhos:</strong>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {formatTriggers(item.trigger_keywords)}
                  </pre>
                </div>
              )}

              <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-black p-4 text-sm text-zinc-300">
                {item.base_message}
              </div>

              {item.media_url && (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">
                  <p>
                    <strong>Mídia:</strong> {item.media_type}
                  </p>
                  <a
                    href={item.media_url}
                    target="_blank"
                    className="mt-2 block break-all text-emerald-300"
                  >
                    {item.media_url}
                  </a>
                </div>
              )}

              {item.kanban_status && (
                <p className="mt-3 text-xs text-zinc-500">
                  Move lead para: <strong>{item.kanban_status}</strong>
                </p>
              )}
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