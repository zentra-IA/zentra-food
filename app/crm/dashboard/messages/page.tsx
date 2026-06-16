"use client";

import { useEffect, useRef, useState } from "react";

const CAMPAIGN_INTENTS = [
  { value: "OPENING", label: "Abertura", desc: "Primeira mensagem do disparo." },
  { value: "REATIVACAO", label: "Reativação", desc: "Clientes antigos voltarem a comprar." },
  { value: "POS_VENDA", label: "Pós-venda", desc: "Mensagem depois do pedido entregue." },
  { value: "RECUPERACAO", label: "Recuperação", desc: "Cliente que parou no meio do pedido." },
];

const AI_INTENTS = [
  { value: "OPENING", label: "Primeira resposta", desc: "Quando o cliente chama pela primeira vez." },
  { value: "FAQ_CUSTOM", label: "Resposta automática personalizada", desc: "Quando o cliente escrever uma das palavras configuradas, o robô responde automaticamente." },
  { value: "CARDAPIO", label: "Cardápio", desc: "Quando pede cardápio/produtos." },
  { value: "PROMOCAO", label: "Promoção", desc: "Quando pergunta por ofertas." },
  { value: "PEDIDO", label: "Pedido", desc: "Quando quer comprar." },
  { value: "ENTREGA", label: "Entrega", desc: "Delivery, taxa e região." },
  { value: "PAGAMENTO", label: "Pagamento", desc: "PIX, dinheiro, cartão." },
  { value: "HORARIO", label: "Horário", desc: "Horário de funcionamento." },
  { value: "ENDERECO", label: "Endereço", desc: "Localização da empresa." },
  { value: "DEFAULT", label: "Resposta padrão", desc: "Quando o robô não encontrar uma resposta específica." },
];

const KANBAN_STATUS = [
  { value: "", label: "Não alterar etapa" },
  { value: "novo", label: "Novo lead" },
  { value: "respondido", label: "Contato respondido" },
  { value: "interesse", label: "Interessado" },
  { value: "pedido", label: "Pedido / oportunidade" },
  { value: "finalizado", label: "Finalizado" },
  { value: "sem_interesse", label: "Sem interesse" },
];

const VARIABLES = [
  { label: "Nome", value: "{nome}" },
  { label: "Telefone", value: "{telefone}" },
  { label: "Última mensagem", value: "{ultima_mensagem}" },
  { label: "Link WhatsApp", value: "{link_whatsapp}" },
  { label: "Cardápio", value: "{cardapio}" },
];

const DEFAULT_NOTIFY_MESSAGE =
  "🚨 Novo atendimento\n\nCliente: {nome}\nTelefone: {telefone}\n\nÚltima mensagem:\n{ultima_mensagem}\n\nAbrir conversa:\n{link_whatsapp}";

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

function formatVariations(value: any) {
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.content || "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

export default function MessagesPage() {
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const notifyRef = useRef<HTMLTextAreaElement | null>(null);

  const [companyData, setCompanyData] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<"campaign" | "ai">("campaign");
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("OPENING");
  const [baseMessage, setBaseMessage] = useState("");
  const [messageVariations, setMessageVariations] = useState("");
  const [triggerKeywords, setTriggerKeywords] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [kanbanStatus, setKanbanStatus] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("text");

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyNumber, setNotifyNumber] = useState("");
  const [notifyMessage, setNotifyMessage] = useState(DEFAULT_NOTIFY_MESSAGE);

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

  function resetForm() {
    setEditingId(null);
    setType("campaign");
    setName("");
    setIntent("OPENING");
    setBaseMessage("");
    setMessageVariations("");
    setTriggerKeywords("");
    setMatchType("contains");
    setKanbanStatus("");
    setMediaUrl("");
    setMediaType("text");
    setNotifyEnabled(false);
    setNotifyNumber("");
    setNotifyMessage(DEFAULT_NOTIFY_MESSAGE);
  }

  function changeType(nextType: "campaign" | "ai") {
    if (nextType === "ai" && !canUseChatbot) {
      alert("Chatbot IA está bloqueado no seu plano atual.");
      return;
    }

    setType(nextType);
    setIntent("OPENING");
    setTriggerKeywords("");
    setKanbanStatus("");
    setMessageVariations("");
  }

  function insertVariable(target: "message" | "notify", variable: string) {
    if (target === "message") {
      const textarea = messageRef.current;
      const start = textarea?.selectionStart ?? baseMessage.length;
      const end = textarea?.selectionEnd ?? baseMessage.length;
      const next =
        baseMessage.slice(0, start) + variable + baseMessage.slice(end);

      setBaseMessage(next);

      setTimeout(() => {
        textarea?.focus();
        textarea?.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      }, 0);
    }

    if (target === "notify") {
      const textarea = notifyRef.current;
      const start = textarea?.selectionStart ?? notifyMessage.length;
      const end = textarea?.selectionEnd ?? notifyMessage.length;
      const next =
        notifyMessage.slice(0, start) + variable + notifyMessage.slice(end);

      setNotifyMessage(next);

      setTimeout(() => {
        textarea?.focus();
        textarea?.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      }, 0);
    }
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

  function editTemplate(item: any) {
    setEditingId(item.id);
    setType(item.type || "campaign");
    setName(item.name || "");
    setIntent(item.intent || "OPENING");
    setBaseMessage(item.base_message || "");

    setMessageVariations(
      Array.isArray(item.message_variations)
        ? item.message_variations.map((v: any) => v.content).join("\n")
        : ""
    );

    setTriggerKeywords(
      Array.isArray(item.trigger_keywords)
        ? item.trigger_keywords.join("\n")
        : ""
    );

    setMatchType(item.match_type || "contains");
    setKanbanStatus(item.kanban_status || "");
    setMediaUrl(item.media_url || "");
    setMediaType(item.media_type || "text");
    setNotifyEnabled(Boolean(item.notify_enabled));
    setNotifyNumber(item.notify_number || "");
    setNotifyMessage(item.notify_message || DEFAULT_NOTIFY_MESSAGE);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveTemplate() {
    if (type === "ai" && !canUseChatbot) {
      alert("Chatbot IA está bloqueado no seu plano atual.");
      return;
    }

    if (!name.trim() || !baseMessage.trim()) {
      alert("Preencha nome da automação e mensagem principal.");
      return;
    }

    if (isCustomTrigger && !triggerKeywords.trim()) {
      alert("Preencha pelo menos uma frase que o cliente pode escrever.");
      return;
    }

    if (notifyEnabled && !notifyNumber.trim()) {
      alert("Informe o WhatsApp interno que receberá a notificação.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/crm/message-templates", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          type,
          name,
          intent,
          base_message: baseMessage,
          message_variations: messageVariations,
          trigger_keywords: triggerKeywords,
          match_type: matchType,
          media_url: mediaUrl || null,
          media_type: mediaUrl ? mediaType : "text",
          kanban_status: kanbanStatus || null,
          notify_enabled: notifyEnabled,
          notify_number: notifyNumber,
          notify_message: notifyMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao salvar mensagem");
        return;
      }

      resetForm();
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
            Mensagens automáticas
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Configure disparos, respostas automáticas, variações, áudio, imagem,
            PDF, Kanban e aviso interno.
          </p>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">
              {editingId ? "Editar automação" : "Nova automação"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-black"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              value={type}
              onChange={(e) => changeType(e.target.value as "campaign" | "ai")}
              className="input"
            >
              <option value="campaign">Mensagem de campanha / disparo</option>
              <option value="ai">
                Resposta automática no WhatsApp {canUseChatbot ? "" : "🔒"}
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
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-black">
                    O que o cliente pode escrever
                  </label>
                  <textarea
                    value={triggerKeywords}
                    onChange={(e) => setTriggerKeywords(e.target.value)}
                    placeholder={`Digite uma opção por linha.\nEx:\nquero simular\nsimular fgts\ntenho interesse\nqual o valor\nquero catálogo`}
                    className="input min-h-32"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Se o cliente enviar qualquer uma dessas frases, o robô envia
                    a resposta configurada abaixo.
                  </p>
                </div>

                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="input"
                >
                  <option value="contains">
                    Palavra em qualquer lugar da mensagem
                  </option>
                  <option value="exact">Mensagem igual exatamente</option>
                  <option value="starts_with">Mensagem começa com</option>
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
              placeholder="Nome da automação. Ex: Abertura FGTS, Catálogo, Pós-venda"
              className="input md:col-span-2"
            />

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black">
                Mensagem principal
              </label>

              <textarea
                ref={messageRef}
                value={baseMessage}
                onChange={(e) => setBaseMessage(e.target.value)}
                placeholder="Ex: Olá {nome}, tudo bem? Posso te mandar uma informação rápida?"
                className="input min-h-36"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {VARIABLES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => insertVariable("message", item.value)}
                    className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-900"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black">
                Variações da mensagem
              </label>

              <textarea
                value={messageVariations}
                onChange={(e) => setMessageVariations(e.target.value)}
                placeholder={`Digite uma variação por linha.\nEx:\nOi {nome}, tudo bem?\nOlá {nome}, tudo certo?\nOpa {nome}, posso te mandar uma informação?\nE aí {nome}, tudo tranquilo?\nOlá {nome}, tenho uma novidade rápida.`}
                className="input min-h-40"
              />

              <p className="mt-2 text-xs text-zinc-500">
                O sistema escolhe uma versão aleatória em cada disparo. Isso
                ajuda a evitar mensagens repetidas.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-4 md:col-span-2">
              <p className="text-sm font-black">Mídia opcional</p>
              <p className="mt-1 text-xs text-zinc-500">
                Anexe áudio, imagem, PDF ou vídeo para enviar junto com a
                resposta.
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
                    type="button"
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

            <div className="rounded-2xl border border-blue-900 bg-blue-950/20 p-4 md:col-span-2">
              <label className="flex items-center gap-3 text-sm font-black">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                />
                Avisar alguém da equipe quando essa automação disparar
              </label>

              <p className="mt-2 text-xs text-zinc-400">
                Use isso para mandar um alerta interno para outro WhatsApp, como
                vendedor, atendente, gerente ou cozinha.
              </p>

              {notifyEnabled && (
                <div className="mt-4 grid gap-3">
                  <input
                    value={notifyNumber}
                    onChange={(e) => setNotifyNumber(e.target.value)}
                    placeholder="WhatsApp da equipe. Ex: 5511999999999"
                    className="input"
                  />

                  <textarea
                    ref={notifyRef}
                    value={notifyMessage}
                    onChange={(e) => setNotifyMessage(e.target.value)}
                    placeholder="Mensagem que a equipe vai receber"
                    className="input min-h-36"
                  />

                  <div className="flex flex-wrap gap-2">
                    {VARIABLES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => insertVariable("notify", item.value)}
                        className="rounded-xl border border-blue-800 bg-blue-950/40 px-3 py-2 text-xs font-black text-blue-200 hover:bg-blue-900"
                      >
                        + {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={saveTemplate}
            disabled={loading || uploading}
            className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black hover:bg-emerald-700 disabled:opacity-50 md:w-auto"
          >
            {loading
              ? "Salvando..."
              : editingId
              ? "Atualizar automação"
              : "Salvar automação"}
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
                    {item.type === "campaign" ? "Campanha" : "Chatbot"} ·{" "}
                    {item.intent} · {item.active ? "Ativa" : "Inativa"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editTemplate(item)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleTemplate(item)}
                    className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-black"
                  >
                    {item.active ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteTemplate(item.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {item.trigger_keywords?.length > 0 && (
                <div className="mt-4 rounded-2xl bg-emerald-950/30 p-4 text-sm text-emerald-200">
                  <strong>Cliente pode escrever:</strong>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {formatTriggers(item.trigger_keywords)}
                  </pre>
                </div>
              )}

              <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-black p-4 text-sm text-zinc-300">
                {item.base_message}
              </div>

              {item.message_variations?.length > 0 && (
                <div className="mt-4 rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-100">
                  <strong>Variações:</strong>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {formatVariations(item.message_variations)}
                  </pre>
                </div>
              )}

              {item.notify_enabled && (
                <div className="mt-4 rounded-2xl border border-blue-900 bg-blue-950/20 p-4 text-sm text-blue-200">
                  <p>
                    <strong>Avisa equipe:</strong> {item.notify_number}
                  </p>
                  {item.notify_message && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-blue-100">
                      {item.notify_message}
                    </pre>
                  )}
                </div>
              )}

              {item.media_url && (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">
                  <p>
                    <strong>Mídia:</strong> {item.media_type}
                  </p>
                  <a
                    href={item.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all text-emerald-300"
                  >
                    {item.media_url}
                  </a>
                </div>
              )}

              {item.kanban_status && (
                <p className="mt-3 text-xs text-zinc-500">
                  Move cliente para: <strong>{item.kanban_status}</strong>
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
