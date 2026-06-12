"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SupportChat from "@/components/SupportChat";

type FeatureKey =
  | "always"
  | "pdv"
  | "pedidos"
  | "cupons"
  | "bi"
  | "erp"
  | "whatsapp"
  | "estoque"
  | "cardapio"
  | "produtos"
  | "categorias"
  | "adicionais"
  | "combos"
  | "crm"
  | "disparo"
  | "radar"
  | "chatbot_ia"
  | "ficha_tecnica_ia"
  | "relatorios_completos";

type RoleKey =
  | "administrador"
  | "gerente"
  | "caixa"
  | "atendente"
  | "entregador"
  | "estoque"
  | "financeiro";

type MenuItem = {
  title: string;
  desc?: string;
  href: string;
  emoji?: string;
  feature: FeatureKey;
  external?: boolean;
};

const permissions: Record<RoleKey, string[]> = {
  administrador: ["*"],
  gerente: [
    "pdv",
    "pedidos",
    "cardapio",
    "produtos",
    "categorias",
    "adicionais",
    "combos",
    "cupons",
    "crm",
    "disparo",
    "radar",
    "whatsapp",
    "chatbot_ia",
    "bi",
    "estoque",
    "ficha_tecnica_ia",
  ],
  caixa: ["pdv", "pedidos"],
  atendente: ["pedidos", "crm", "disparo", "whatsapp", "chatbot_ia"],
  entregador: ["pedidos"],
  estoque: ["produtos", "categorias", "adicionais", "estoque"],
  financeiro: ["bi", "erp", "relatorios_completos"],
};

const quickActions: MenuItem[] = [
  { title: "PDV", href: "/pdv", feature: "pdv" },
  { title: "Pedidos", href: "/admin/pedidos", feature: "pedidos" },
  { title: "Cupons", href: "/admin/cupons", feature: "cupons" },
  { title: "BI", href: "/crm/dashboard/bi", feature: "bi" },
  { title: "ERP", href: "/crm/dashboard/bi/costs", feature: "erp" },
  { title: "WhatsApp", href: "/crm/whatsapp", feature: "whatsapp" },
  { title: "Estoque", href: "/crm/dashboard/estoque", feature: "estoque" },
];

const baseSections: { group: string; items: MenuItem[] }[] = [
  {
    group: "Operação",
    items: [
      { title: "PDV / Balcão", desc: "Atendimento rápido.", href: "/pdv", emoji: "🏪", feature: "pdv" },
      { title: "Pedidos", desc: "Gerenciar pedidos.", href: "/admin/pedidos", emoji: "📦", feature: "pedidos" },
      { title: "Cardápio", desc: "Ver site do cliente.", href: "#", emoji: "📱", feature: "cardapio", external: true },
    ],
  },
  {
    group: "Cardápio",
    items: [
      { title: "Produtos", desc: "Editar produtos.", href: "/admin/produtos", emoji: "🍕", feature: "produtos" },
      { title: "Categorias", desc: "Organizar cardápio.", href: "/admin/categorias", emoji: "🗂️", feature: "categorias" },
      { title: "Adicionais", desc: "Extras e bordas.", href: "/admin/additionals", emoji: "➕", feature: "adicionais" },
      { title: "Promoções", desc: "Criar promoções.", href: "/admin/combos", emoji: "🎁", feature: "combos" },
      { title: "Cupons", desc: "Criar cupons.", href: "/admin/cupons", emoji: "🎟️", feature: "cupons" },
    ],
  },
  {
    group: "BI e Financeiro",
    items: [
      { title: "BI Inteligente", desc: "Indicadores e lucro.", href: "/crm/dashboard/bi", emoji: "📊", feature: "bi" },
      { title: "ERP Financeiro", desc: "Contas, custos e compras.", href: "/crm/dashboard/bi/costs", emoji: "💰", feature: "erp" },
      { title: "Ficha Técnica", desc: "Custo real por produto.", href: "/crm/dashboard/bi/ingredients", emoji: "🧾", feature: "ficha_tecnica_ia" },
      { title: "Estoque", desc: "Controle produtos e alertas.", href: "/crm/dashboard/estoque", emoji: "📦", feature: "estoque" },
    ],
  },
  {
    group: "CRM e WhatsApp",
    items: [
      { title: "CRM Food", desc: "Dashboard de clientes.", href: "/crm/dashboard", emoji: "📊", feature: "crm" },
      { title: "Disparo", desc: "Histórico e contatos.", href: "/crm/dashboard/contacts", emoji: "👥", feature: "disparo" },
      { title: "Radar Local", desc: "Buscar novos clientes.", href: "/crm/dashboard/radar", emoji: "📍", feature: "radar" },
      { title: "WhatsApp", desc: "QR Code e atendimento.", href: "/crm/whatsapp", emoji: "💬", feature: "whatsapp" },
      { title: "Mensagens IA", desc: "Disparos e respostas automáticas.", href: "/crm/dashboard/messages", emoji: "🤖", feature: "chatbot_ia" },
    ],
  },
];

function hasFeature(companyData: any, feature: FeatureKey) {
  if (feature === "always") return true;
  if (!companyData) return false;

  const fromPlan = companyData?.features?.some(
    (item: any) => item.feature === feature && item.enabled
  );

  const fromGrant = companyData?.grants?.some((item: any) => {
    if (item.feature !== feature || !item.active) return false;
    if (!item.expires_at) return true;
    return new Date(item.expires_at) > new Date();
  });

  return Boolean(fromPlan || fromGrant);
}

function canRoleAccess(role: string, feature: FeatureKey) {
  if (feature === "always") return true;

  const allowed = permissions[(role || "atendente") as RoleKey] || [];
  return allowed.includes("*") || allowed.includes(feature);
}

function canAccess(item: MenuItem, companyData: any, role: string) {
  return hasFeature(companyData, item.feature) && canRoleAccess(role, item.feature);
}

export default function PainelPage() {
  const [companyData, setCompanyData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const role = companyData?.currentUser?.role || "atendente";
  const companySlug = companyData?.company?.slug || "";

  const publicMenuPath = companySlug ? `/cardapio/${companySlug}` : "#";

  const publicMenuUrl = useMemo(() => {
    if (!companySlug) return "";

    if (typeof window === "undefined") {
      return `/cardapio/${companySlug}`;
    }

    return `${window.location.origin}/cardapio/${companySlug}`;
  }, [companySlug]);

  const sections = useMemo(() => {
    return baseSections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (item.feature === "cardapio") {
          return {
            ...item,
            href: publicMenuPath,
          };
        }

        return item;
      }),
    }));
  }, [publicMenuPath]);

  async function loadCompany() {
    try {
      const res = await fetch("/api/company/current", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json();

      if (data?.success) {
        setCompanyData(data);
      }
    } catch {}
  }

  useEffect(() => {
    loadCompany();
  }, []);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/company/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Erro ao enviar logo");
        return;
      }

      alert("Logo enviada com sucesso!");
      window.location.reload();
    } catch {
      alert("Erro ao enviar logo");
    } finally {
      setUploading(false);
    }
  }

  async function copyPublicMenuLink() {
    if (!publicMenuUrl) {
      alert("Empresa ainda não possui slug de cardápio.");
      return;
    }

    await navigator.clipboard.writeText(publicMenuUrl);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  function blockClick(e: React.MouseEvent, item: MenuItem) {
    if (canAccess(item, companyData, role)) {
      if (item.feature === "cardapio" && !companySlug) {
        e.preventDefault();
        alert("Slug da empresa não encontrado.");
      }

      return;
    }

    e.preventDefault();

    if (!hasFeature(companyData, item.feature)) {
      alert(`${item.title} está bloqueado no plano atual.`);
      return;
    }

    alert(`Seu cargo (${role}) não tem permissão para acessar ${item.title}.`);
  }

  return (
    <>
      <main className="min-h-screen bg-[#f5f5f7] text-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
          <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-700 p-5 text-white shadow-2xl md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-red-200">
              Zentra Food
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
              Painel de Controle
            </h1>

            <p className="mt-2 text-sm text-zinc-300">
              Plano: {companyData?.plan?.name || "Carregando..."} · Cargo: {role}
            </p>

            <div className="mt-5 rounded-3xl bg-white/10 p-4">
              <p className="mb-3 text-sm font-black">Logo da Empresa</p>

              <input
                type="file"
                accept="image/*"
                onChange={uploadLogo}
                disabled={uploading}
                className="block w-full text-sm"
              />

              <p className="mt-2 text-xs text-zinc-300">PNG, JPG ou WEBP</p>
            </div>

            <p className="mt-4 max-w-2xl text-sm text-zinc-200 md:text-base">
              Gerencie PDV, cardápio, pedidos, cupons, BI, ERP, CRM e WhatsApp.
            </p>

            {companySlug && (
              <div className="mt-5 rounded-3xl bg-white/10 p-4">
                <p className="text-sm font-black">Link público do cardápio</p>

                <p className="mt-1 text-xs text-zinc-300">
                  Compartilhe este link com os clientes finais da empresa.
                </p>

                <div className="mt-3 flex flex-col gap-2 md:flex-row">
                  <input
                    readOnly
                    value={publicMenuUrl}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                  />

                  <button
                    type="button"
                    onClick={copyPublicMenuLink}
                    className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700"
                  >
                    {copied ? "Copiado!" : "Copiar"}
                  </button>

                  <a
                    href={publicMenuPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-zinc-950 transition hover:bg-zinc-100"
                  >
                    Abrir
                  </a>
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {quickActions.map((item, index) => {
                const enabled = canAccess(item, companyData, role);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => blockClick(e, item)}
                    className={`shrink-0 rounded-full px-5 py-3 text-sm font-black transition ${
                      enabled
                        ? index === 0
                          ? "bg-red-600 text-white shadow-lg"
                          : "bg-white/10 text-white hover:bg-white/20"
                        : "bg-black/30 text-zinc-400"
                    }`}
                  >
                    {item.title} {!enabled && "🔒"}
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="mt-6 space-y-8">
            {sections.map((section) => (
              <section key={section.group}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-black md:text-2xl">
                    {section.group}
                  </h2>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-zinc-500 shadow-sm">
                    {section.items.length} módulos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {section.items.map((item) => {
                    const enabled = canAccess(item, companyData, role);

                    return (
                      <Link
                        key={`${section.group}-${item.title}`}
                        href={item.href}
                        target={item.external && enabled ? "_blank" : undefined}
                        rel={item.external && enabled ? "noopener noreferrer" : undefined}
                        onClick={(e) => blockClick(e, item)}
                        className={`group rounded-[1.7rem] border p-4 shadow-sm transition md:p-5 ${
                          enabled
                            ? "border-zinc-200 bg-white hover:-translate-y-1 hover:border-red-200 hover:shadow-xl"
                            : "border-zinc-200 bg-zinc-100 opacity-60"
                        }`}
                      >
                        <div
                          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition ${
                            enabled
                              ? "bg-red-50 group-hover:bg-red-600 group-hover:text-white"
                              : "bg-zinc-200 grayscale"
                          }`}
                        >
                          {item.emoji}
                        </div>

                        <h3 className="text-sm font-black text-zinc-950 md:text-base">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-xs leading-relaxed text-zinc-500 md:text-sm">
                          {item.desc}
                        </p>

                        <div
                          className={`mt-4 text-xs font-black ${
                            enabled ? "text-red-600" : "text-zinc-500"
                          }`}
                        >
                          {enabled
                            ? item.feature === "cardapio"
                              ? "Abrir cardápio →"
                              : "Acessar →"
                            : "Bloqueado 🔒"}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <SupportChat />
    </>
  );
}