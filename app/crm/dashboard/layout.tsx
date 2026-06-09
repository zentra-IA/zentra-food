"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SupportChat from "@/components/SupportChat";

type FeatureKey =
  | "always"
  | "crm"
  | "inbox"
  | "chatbot_ia"
  | "radar"
  | "disparo"
  | "campanhas_simples"
  | "bi"
  | "erp"
  | "estoque"
  | "email_marketing"
  | "criativos_ia"
  | "ficha_tecnica_ia"
  | "whatsapp";

const menuItems: { href: string; label: string; emoji: string; feature: FeatureKey }[] = [
  { href: "/crm/dashboard", label: "Painel", emoji: "📊", feature: "always" },
  { href: "/crm/dashboard/inbox", label: "Caixa de entrada", emoji: "📥", feature: "inbox" },
  { href: "/crm/dashboard/radar", label: "Clientes Perto", emoji: "📍", feature: "radar" },
  { href: "/crm/dashboard/contacts", label: "Contatos / Disparo", emoji: "👥", feature: "disparo" },
  { href: "/crm/dashboard/messages", label: "Mensagens / Chatbot", emoji: "🤖", feature: "chatbot_ia" },
  { href: "/crm/whatsapp", label: "Conectar WhatsApp", emoji: "💬", feature: "whatsapp" },
  { href: "/crm/dashboard/campaigns", label: "Campanhas", emoji: "🚀", feature: "campanhas_simples" },
  { href: "/crm/dashboard/email", label: "Marketing por e-mail", emoji: "📧", feature: "email_marketing" },
  { href: "/crm/dashboard/creative-generator", label: "Criativos", emoji: "🎨", feature: "criativos_ia" },
  { href: "/crm/dashboard/bi", label: "BI Inteligente", emoji: "📈", feature: "bi" },
  { href: "/crm/dashboard/bi/costs", label: "ERP Financeiro", emoji: "💰", feature: "erp" },
  { href: "/crm/dashboard/estoque", label: "Estoque", emoji: "📦", feature: "estoque" },
  { href: "/crm/dashboard/bi/ingredients", label: "Ficha Técnica", emoji: "🍕", feature: "ficha_tecnica_ia" },
];

const whatsappSessions = [1, 2, 3, 4, 5];

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {};

  if (typeof window === "undefined") {
    return headers;
  }

  const companyId = localStorage.getItem("active_company_id");

  if (companyId && companyId.trim()) {
    headers["x-company-id"] = companyId;
  }

  return headers;
}

function hasFeature(companyData: any, feature: FeatureKey) {
  if (feature === "always") return true;
  if (!companyData) return true;

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<Record<number, string>>({});
  const [companyData, setCompanyData] = useState<any>(null);
  const [billingAlert, setBillingAlert] = useState<any>(null);

  async function loadCompany() {
    try {
      const res = await fetch("/api/company/current", {
        cache: "no-store",
        headers: buildHeaders() as HeadersInit,
      });

      const data = await res.json();

      if (data?.success) {
        setCompanyData(data);
      }
    } catch {}
  }

  async function loadBillingAlert() {
    try {
      const res = await fetch("/api/company/billing-alert", {
        cache: "no-store",
        headers: buildHeaders(),
      });

      const data = await res.json();
      setBillingAlert(data?.show ? data : null);
    } catch {
      setBillingAlert(null);
    }
  }

  async function loadWhatsappStatus() {
    try {
      const results = await Promise.all(
        whatsappSessions.map(async (session) => {
          try {
            const res = await fetch(`/api/whatsapp/qr?sessionId=${session}`, {
              cache: "no-store",
              headers: buildHeaders(),
            });

            const data = await res.json();

            return {
              session,
              status: data?.status || "offline",
            };
          } catch {
            return {
              session,
              status: "offline",
            };
          }
        })
      );

      const nextStatus: Record<number, string> = {};

      results.forEach((item) => {
        nextStatus[item.session] = item.status;
      });

      setSessionStatus(nextStatus);
    } catch {}
  }

  useEffect(() => {
    loadCompany();
    loadBillingAlert();
    loadWhatsappStatus();

    const interval = setInterval(() => {
      loadWhatsappStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  function getStatusLabel(status: string) {
    if (status === "online") return "Online";
    if (status === "qr_pending") return "QR";
    return "Offline";
  }

  function getStatusClass(status: string) {
    if (status === "online") return "bg-emerald-950 text-emerald-400";
    if (status === "qr_pending") return "bg-yellow-950 text-yellow-400";
    return "bg-zinc-900 text-red-400";
  }

  function handleBlockedClick(e: React.MouseEvent, label: string) {
    e.preventDefault();
    alert(`${label} está bloqueado no seu plano atual.`);
  }

  const companyBlocked = companyData?.company?.active === false;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black">Zentra CRM</h1>
            <p className="text-xs text-zinc-500">
              Plano: {companyData?.plan?.name || "Sem plano"}
            </p>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white"
          >
            Menu
          </button>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-50 border-r border-zinc-800 bg-zinc-950 shadow-2xl transition-all duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:shadow-none ${
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${collapsed ? "md:w-20" : "w-72 md:w-72"}`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3">
                {!collapsed && (
                  <div>
                    <h1 className="text-2xl font-black leading-tight">Zentra Food</h1>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      Plano: {companyData?.plan?.name || "Sem plano"}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="hidden rounded-xl bg-zinc-900 px-3 py-2 text-sm font-black text-zinc-300 hover:bg-zinc-800 md:block"
                >
                  {collapsed ? "→" : "←"}
                </button>

                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-black md:hidden"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <nav className="space-y-2">
                {menuItems.map((item) => {
                  const enabled = hasFeature(companyData, item.feature);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        if (!enabled || companyBlocked) {
                          handleBlockedClick(e, item.label);
                          return;
                        }

                        setOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black transition ${
                        enabled && !companyBlocked
                          ? "text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-400"
                          : "cursor-pointer text-zinc-600 hover:bg-yellow-500/10 hover:text-yellow-400"
                      } ${collapsed ? "justify-center" : ""}`}
                      title={enabled ? item.label : `${item.label} bloqueado`}
                    >
                      <span className="text-xl">{item.emoji}</span>

                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between gap-2">
                          <span>{item.label}</span>
                          {(!enabled || companyBlocked) && (
                            <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-400">
                              🔒
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-3xl border border-zinc-800 bg-black/40 p-4">
                {!collapsed && (
                  <p className="mb-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                    Sessões WhatsApp
                  </p>
                )}

                <div className={`grid gap-2 ${collapsed ? "grid-cols-1" : "grid-cols-2"}`}>
                  {whatsappSessions.map((session) => {
                    const status = sessionStatus[session] || "offline";

                    return (
                      <Link
                        key={session}
                        href="/crm/whatsapp"
                        onClick={(e) => {
                          if (!hasFeature(companyData, "whatsapp") || companyBlocked) {
                            handleBlockedClick(e, "WhatsApp");
                            return;
                          }

                          setOpen(false);
                        }}
                        className={`rounded-xl px-3 py-2 text-center text-xs font-black hover:brightness-125 ${getStatusClass(status)}`}
                      >
                        {collapsed ? session : `W${session} • ${getStatusLabel(status)}`}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {!collapsed && companyData?.radar && (
                <div className="mt-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-400">
                    Radar mensal
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {companyData.radar.total} contatos disponíveis
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Base {companyData.radar.base} + Extra {companyData.radar.extra}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {open && (
          <button
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
          />
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
          {billingAlert?.message && !companyBlocked && (
            <div className="mb-4 rounded-3xl border border-yellow-700 bg-yellow-950/40 p-4 text-sm font-black text-yellow-300">
              {billingAlert.message}
            </div>
          )}

          {companyBlocked ? (
            <div className="rounded-[2rem] border border-red-800 bg-red-950/30 p-8">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-red-400">
                Acesso bloqueado
              </p>

              <h1 className="mt-2 text-3xl font-black">Esta empresa está pausada</h1>

              <p className="mt-3 max-w-xl text-sm text-red-200">
                Entre em contato com o suporte para regularizar o acesso.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <SupportChat />
    </div>
  );
}