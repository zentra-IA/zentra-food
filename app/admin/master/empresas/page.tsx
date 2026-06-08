"use client";

import { useEffect, useState } from "react";

const ROLES = [
  "administrador",
  "gerente",
  "caixa",
  "atendente",
  "entregador",
  "estoque",
  "financeiro",
];

const PAYMENT_METHODS = ["PIX", "CREDITO", "DEBITO", "BOLETO", "DINHEIRO"];

const FEATURE_LABELS: Record<string, string> = {
  cardapio: "Cardápio",
  produtos: "Produtos",
  categorias: "Categorias",
  adicionais: "Adicionais",
  combos: "Promoções",
  cupons: "Cupons",
  pdv: "PDV",
  pedidos: "Pedidos",
  crm: "CRM",
  inbox: "Caixa de entrada",
  chatbot_ia: "Mensagens IA",
  radar: "Radar Local",
  disparo: "Disparo",
  whatsapp: "WhatsApp",
  bi: "BI",
  erp: "ERP Financeiro",
  estoque: "Estoque",
  email_marketing: "E-mail Marketing",
  criativos_ia: "Criativos IA",
  campanhas_avancadas: "Campanhas Avançadas",
  ficha_tecnica_ia: "Ficha Técnica",
  relatorios_completos: "Relatórios Completos",
};

function money(value: any) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function readJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function formatDate(value: string | null) {
  if (!value) return "Sem vencimento";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function MasterCompaniesPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [usersData, setUsersData] = useState<any>(null);
  const [grantsData, setGrantsData] = useState<any>(null);
  const [radarGrants, setRadarGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    restaurantName: "",
    document: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
    whatsapp: "",
    extraContact: "",
    planId: "",
  });

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "atendente",
  });

  const [grantForm, setGrantForm] = useState({
    feature: "bi",
    days: "7",
    notes: "",
  });

  const [radarForm, setRadarForm] = useState({
    contactsExtra: "200",
    days: "30",
  });

  async function loadPlans() {
    const res = await fetch("/api/admin/companies/create", {
      cache: "no-store",
    });

    const data = await readJsonSafe(res);
    setPlans(Array.isArray(data) ? data : []);
  }

  async function loadCompanies() {
    const res = await fetch("/api/admin/companies", {
      cache: "no-store",
    });

    const data = await readJsonSafe(res);
    setCompanies(Array.isArray(data) ? data : []);
  }

  async function loadUsers(companyId: string) {
    const res = await fetch(`/api/admin/users?companyId=${companyId}`, {
      cache: "no-store",
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao buscar usuários");
      return;
    }

    setUsersData({
      ...data,
      users: (data.users || []).map((user: any) => ({
        ...user,
        password: "",
      })),
    });
  }

  async function loadGrants(companyId: string) {
    const res = await fetch(`/api/admin/feature-grants?companyId=${companyId}`, {
      cache: "no-store",
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao buscar liberações");
      return;
    }

    setGrantsData(data);
  }

  async function loadRadarGrants(companyId: string) {
    const res = await fetch(`/api/admin/radar-grants?companyId=${companyId}`, {
      cache: "no-store",
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao buscar créditos do Radar");
      return;
    }

    setRadarGrants(data.grants || []);
  }

  useEffect(() => {
    loadPlans();
    loadCompanies();
  }, []);

  async function createCompany() {
    if (
      !form.restaurantName ||
      !form.ownerName ||
      !form.email ||
      !form.password ||
      !form.planId
    ) {
      alert("Preencha empresa, responsável, e-mail, senha e plano.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/companies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data: any = await readJsonSafe(res);

      if (!res.ok) {
        alert(data.error || "Erro ao criar empresa");
        return;
      }

      alert("Empresa criada com sucesso.");

      setForm({
        restaurantName: "",
        document: "",
        ownerName: "",
        email: "",
        password: "",
        phone: "",
        whatsapp: "",
        extraContact: "",
        planId: "",
      });

      await loadCompanies();
    } finally {
      setLoading(false);
    }
  }

  async function updateCompany(companyId: string, payload: any) {
    const res = await fetch("/api/admin/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: companyId,
        ...payload,
      }),
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar empresa");
      return;
    }

    await loadCompanies();

    if (selectedCompany?.id === companyId) {
      setSelectedCompany((prev: any) => ({
        ...prev,
        ...payload,
        ...data.company,
      }));
    }
  }

  async function deleteCompany(companyId: string) {
    if (
      !confirm(
        "Excluir empresa definitivamente?\n\nIsso apagará empresa, usuários, pedidos, produtos, clientes, CRM e dados relacionados.\n\nEssa ação não pode ser desfeita."
      )
    ) {
      return;
    }

    const res = await fetch(`/api/admin/companies?id=${companyId}`, {
      method: "DELETE",
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao excluir empresa");
      return;
    }

    setSelectedCompany(null);
    setUsersData(null);
    setGrantsData(null);
    setRadarGrants([]);
    await loadCompanies();
  }

  async function createUser() {
    if (!selectedCompany?.id) {
      alert("Selecione uma empresa.");
      return;
    }

    if (!userForm.name || !userForm.email || !userForm.password) {
      alert("Preencha nome, e-mail e senha.");
      return;
    }

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selectedCompany.id,
        ...userForm,
      }),
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao criar usuário");
      return;
    }

    setUserForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "atendente",
    });

    await loadUsers(selectedCompany.id);
  }

  async function updateUser(userId: string, payload: any) {
    const cleanPayload = { ...payload };

    if (!cleanPayload.password) {
      delete cleanPayload.password;
    }

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: userId,
        ...cleanPayload,
      }),
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar usuário");
      return;
    }

    alert("Usuário atualizado com sucesso.");

    if (selectedCompany?.id) {
      await loadUsers(selectedCompany.id);
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm("Excluir usuário definitivamente?")) return;

    const res = await fetch(`/api/admin/users?id=${userId}`, {
      method: "DELETE",
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao excluir usuário");
      return;
    }

    if (selectedCompany?.id) {
      await loadUsers(selectedCompany.id);
    }
  }

  async function createGrant() {
    if (!selectedCompany?.id) {
      alert("Selecione uma empresa.");
      return;
    }

    if (!grantForm.feature) {
      alert("Selecione uma funcionalidade.");
      return;
    }

    const res = await fetch("/api/admin/feature-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selectedCompany.id,
        feature: grantForm.feature,
        days: Number(grantForm.days || 0),
        notes: grantForm.notes,
      }),
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao liberar funcionalidade");
      return;
    }

    setGrantForm({
      feature: "bi",
      days: "7",
      notes: "",
    });

    await loadGrants(selectedCompany.id);
    alert("Funcionalidade liberada com sucesso.");
  }

  async function toggleGrant(grant: any) {
    const res = await fetch("/api/admin/feature-grants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: grant.id,
        active: !grant.active,
      }),
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar liberação");
      return;
    }

    if (selectedCompany?.id) {
      await loadGrants(selectedCompany.id);
    }
  }

  async function deleteGrant(id: string) {
    if (!confirm("Remover esta liberação?")) return;

    const res = await fetch(`/api/admin/feature-grants?id=${id}`, {
      method: "DELETE",
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao remover liberação");
      return;
    }

    if (selectedCompany?.id) {
      await loadGrants(selectedCompany.id);
    }
  }

  async function createRadarGrant() {
    if (!selectedCompany?.id) {
      alert("Selecione uma empresa.");
      return;
    }

    const contactsExtra = Number(radarForm.contactsExtra || 0);
    const days = Number(radarForm.days || 0);

    if (contactsExtra <= 0) {
      alert("Informe uma quantidade válida de créditos.");
      return;
    }

    const res = await fetch("/api/admin/radar-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selectedCompany.id,
        contactsExtra,
        days,
      }),
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao adicionar créditos");
      return;
    }

    setRadarForm({
      contactsExtra: "200",
      days: "30",
    });

    await loadRadarGrants(selectedCompany.id);
    alert("Créditos extras adicionados ao Radar.");
  }

  async function deleteRadarGrant(id: string) {
    if (!confirm("Remover estes créditos extras do Radar?")) return;

    const res = await fetch(`/api/admin/radar-grants?id=${id}`, {
      method: "DELETE",
    });

    const data: any = await readJsonSafe(res);

    if (!res.ok) {
      alert(data.error || "Erro ao remover créditos");
      return;
    }

    if (selectedCompany?.id) {
      await loadRadarGrants(selectedCompany.id);
    }
  }

  function selectCompany(company: any) {
    setSelectedCompany(company);
    loadUsers(company.id);
    loadGrants(company.id);
    loadRadarGrants(company.id);
  }
  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 to-emerald-950 p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
            Zentra Master
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-5xl">
            Empresas e Usuários
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Crie empresas, edite planos, controle cobrança, pause acessos,
            gerencie usuários, libere funções e adicione créditos extras no Radar.
          </p>
        </section>

        <section className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Criar nova empresa</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Nome da pizzaria / empresa" value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })} />
            <input className="input" placeholder="CNPJ" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            <input className="input" placeholder="Nome do responsável" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            <input className="input" placeholder="E-mail do administrador" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Senha inicial" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

            <select className="input" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              <option value="">Selecione o plano</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>

            <input className="input" placeholder="Celular" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            <input className="input md:col-span-2" placeholder="Contato extra" value={form.extraContact} onChange={(e) => setForm({ ...form, extraContact: e.target.value })} />
          </div>

          <button
            onClick={createCompany}
            disabled={loading}
            className="mt-5 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar empresa"}
          </button>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.42fr_0.58fr]">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-black">Empresas cadastradas</h2>

            <div className="mt-4 space-y-3">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => selectCompany(company)}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    selectedCompany?.id === company.id
                      ? "border-emerald-500 bg-emerald-950/30"
                      : "border-zinc-800 bg-black hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{company.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{company.id}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Plano: {company.plans?.name || "Sem plano"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Valor: {money(company.monthly_value)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Vence dia: {company.due_day || "-"} ·{" "}
                        {company.payment_method || "PIX"}
                      </p>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs font-black ${company.active ? "bg-emerald-600" : "bg-red-600"}`}>
                      {company.active ? "Ativa" : "Pausada"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            {!selectedCompany ? (
              <div className="rounded-3xl border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
                Selecione uma empresa para gerenciar.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-black">{selectedCompany.name}</h2>
                    <p className="text-xs text-zinc-500">{selectedCompany.id}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        updateCompany(selectedCompany.id, {
                          active: !selectedCompany.active,
                          blocked_reason: selectedCompany.active
                            ? "Empresa pausada pelo admin"
                            : null,
                        })
                      }
                      className={`rounded-2xl px-4 py-3 text-sm font-black ${
                        selectedCompany.active ? "bg-red-600" : "bg-emerald-600"
                      }`}
                    >
                      {selectedCompany.active ? "Pausar" : "Reativar"}
                    </button>

                    <button
                      onClick={() => deleteCompany(selectedCompany.id)}
                      className="rounded-2xl bg-red-900 px-4 py-3 text-sm font-black"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-zinc-800 bg-black p-4">
                  <h3 className="text-lg font-black">Editar empresa</h3>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input className="input" placeholder="Nome da empresa" value={selectedCompany.name || ""} onChange={(e) => setSelectedCompany({ ...selectedCompany, name: e.target.value })} />

                    <select className="input" value={selectedCompany.plan_id || ""} onChange={(e) => setSelectedCompany({ ...selectedCompany, plan_id: e.target.value })}>
                      <option value="">Sem plano</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>

                    <input className="input" placeholder="Valor mensal" type="number" value={selectedCompany.monthly_value || ""} onChange={(e) => setSelectedCompany({ ...selectedCompany, monthly_value: e.target.value })} />
                    <input className="input" placeholder="Dia do vencimento" type="number" min={1} max={31} value={selectedCompany.due_day || ""} onChange={(e) => setSelectedCompany({ ...selectedCompany, due_day: e.target.value })} />

                    <select className="input" value={selectedCompany.payment_method || "PIX"} onChange={(e) => setSelectedCompany({ ...selectedCompany, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>

                    <input className="input" placeholder="Observação de cobrança" value={selectedCompany.billing_notes || ""} onChange={(e) => setSelectedCompany({ ...selectedCompany, billing_notes: e.target.value })} />
                  </div>

                  <button
                    onClick={() =>
                      updateCompany(selectedCompany.id, {
                        name: selectedCompany.name,
                        plan_id: selectedCompany.plan_id,
                        monthly_value: selectedCompany.monthly_value,
                        due_day: selectedCompany.due_day,
                        payment_method: selectedCompany.payment_method,
                        billing_notes: selectedCompany.billing_notes,
                      })
                    }
                    className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black"
                  >
                    Salvar empresa e cobrança
                  </button>
                </div>

                <div className="mt-6 rounded-3xl border border-zinc-800 bg-black p-4">
                  <h3 className="text-lg font-black">Usuários</h3>

                  <p className="text-sm text-zinc-500">
                    {usersData?.used || 0} de {usersData?.limit || 0} usuário(s) ativos
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input className="input" placeholder="Nome do usuário" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
                    <input className="input" placeholder="E-mail" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                    <input className="input" placeholder="Telefone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
                    <input className="input" placeholder="Senha inicial" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />

                    <select className="input md:col-span-2" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={createUser} className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black">
                    Criar usuário
                  </button>

                  <div className="mt-5 space-y-3">
                    {(usersData?.users || []).map((user: any) => (
                      <div key={user.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-black">{user.name || "Sem nome"}</p>
                            <p className="text-xs text-zinc-500">{user.email || "Sem e-mail"}</p>
                          </div>

                          <span className={`rounded-full px-3 py-1 text-xs font-black ${user.active !== false ? "bg-emerald-600" : "bg-red-600"}`}>
                            {user.active !== false ? "Ativo" : "Pausado"}
                          </span>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <input className="input" value={user.name || ""} placeholder="Nome" onChange={(e) => setUsersData((prev: any) => ({ ...prev, users: prev.users.map((u: any) => u.id === user.id ? { ...u, name: e.target.value } : u) }))} />
                          <input className="input" value={user.email || ""} placeholder="E-mail" onChange={(e) => setUsersData((prev: any) => ({ ...prev, users: prev.users.map((u: any) => u.id === user.id ? { ...u, email: e.target.value } : u) }))} />
                          <input className="input" value={user.phone || ""} placeholder="Telefone" onChange={(e) => setUsersData((prev: any) => ({ ...prev, users: prev.users.map((u: any) => u.id === user.id ? { ...u, phone: e.target.value } : u) }))} />
                          <input className="input" type="password" value={user.password || ""} placeholder="Nova senha opcional" onChange={(e) => setUsersData((prev: any) => ({ ...prev, users: prev.users.map((u: any) => u.id === user.id ? { ...u, password: e.target.value } : u) }))} />

                          <select className="input md:col-span-2" value={user.role || "atendente"} onChange={(e) => setUsersData((prev: any) => ({ ...prev, users: prev.users.map((u: any) => u.id === user.id ? { ...u, role: e.target.value } : u) }))}>
                            {ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              updateUser(user.id, {
                                name: user.name,
                                email: user.email,
                                phone: user.phone,
                                role: user.role,
                                password: user.password,
                              })
                            }
                            className="rounded-2xl bg-zinc-800 px-4 py-2 text-sm font-black"
                          >
                            Salvar
                          </button>

                          <button
                            onClick={() =>
                              updateUser(user.id, {
                                active: user.active === false ? true : false,
                              })
                            }
                            className={`rounded-2xl px-4 py-2 text-sm font-black ${user.active !== false ? "bg-red-600" : "bg-emerald-600"}`}
                          >
                            {user.active !== false ? "Pausar" : "Reativar"}
                          </button>

                          <button onClick={() => deleteUser(user.id)} className="rounded-2xl bg-red-900 px-4 py-2 text-sm font-black">
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-zinc-800 bg-black p-4">
                  <h3 className="text-lg font-black">Liberações temporárias</h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Libere recursos fora do plano por alguns dias para teste ou demonstração.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <select className="input" value={grantForm.feature} onChange={(e) => setGrantForm({ ...grantForm, feature: e.target.value })}>
                      {Object.keys(FEATURE_LABELS).map((feature) => (
                        <option key={feature} value={feature}>{FEATURE_LABELS[feature]}</option>
                      ))}
                    </select>

                    <input className="input" type="number" min={0} placeholder="Dias de liberação" value={grantForm.days} onChange={(e) => setGrantForm({ ...grantForm, days: e.target.value })} />
                    <input className="input" placeholder="Observação" value={grantForm.notes} onChange={(e) => setGrantForm({ ...grantForm, notes: e.target.value })} />
                  </div>

                  <button onClick={createGrant} className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black">
                    Liberar funcionalidade
                  </button>

                  <div className="mt-5 space-y-3">
                    {(grantsData?.grants || []).length === 0 && (
                      <div className="rounded-3xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">
                        Nenhuma funcionalidade liberada temporariamente.
                      </div>
                    )}

                    {(grantsData?.grants || []).map((grant: any) => {
                      const expired = grant.expires_at && new Date(grant.expires_at) < new Date();

                      return (
                        <div key={grant.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="font-black">{FEATURE_LABELS[grant.feature] || grant.feature}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Vencimento: {formatDate(grant.expires_at)}
                              </p>
                              {grant.notes && (
                                <p className="mt-1 text-xs text-zinc-400">{grant.notes}</p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-black ${expired ? "bg-orange-600" : grant.active ? "bg-emerald-600" : "bg-red-600"}`}>
                                {expired ? "Expirada" : grant.active ? "Ativa" : "Pausada"}
                              </span>

                              <button onClick={() => toggleGrant(grant)} className="rounded-2xl bg-zinc-800 px-4 py-2 text-sm font-black">
                                {grant.active ? "Pausar" : "Reativar"}
                              </button>

                              <button onClick={() => deleteGrant(grant.id)} className="rounded-2xl bg-red-900 px-4 py-2 text-sm font-black">
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-zinc-800 bg-black p-4">
                  <h3 className="text-lg font-black">Créditos extras do Radar</h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Adicione visualizações extras no Radar sem trocar o plano da empresa.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      placeholder="Quantidade de créditos. Ex: 200"
                      value={radarForm.contactsExtra}
                      onChange={(e) =>
                        setRadarForm({
                          ...radarForm,
                          contactsExtra: e.target.value,
                        })
                      }
                    />

                    <input
                      className="input"
                      type="number"
                      min={0}
                      placeholder="Dias de validade. 0 = sem vencimento"
                      value={radarForm.days}
                      onChange={(e) =>
                        setRadarForm({
                          ...radarForm,
                          days: e.target.value,
                        })
                      }
                    />
                  </div>

                  <button
                    onClick={createRadarGrant}
                    className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black"
                  >
                    Adicionar créditos ao Radar
                  </button>

                  <div className="mt-5 space-y-3">
                    {radarGrants.length === 0 && (
                      <div className="rounded-3xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">
                        Nenhum crédito extra de Radar liberado.
                      </div>
                    )}

                    {radarGrants.map((grant: any) => {
                      const expired =
                        grant.expires_at && new Date(grant.expires_at) < new Date();

                      return (
                        <div key={grant.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="font-black">+{grant.contacts_extra} visualizações</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Vencimento: {formatDate(grant.expires_at)}
                              </p>
                              <p className="mt-1 text-xs text-zinc-600">
                                ID: {grant.id}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-black ${expired ? "bg-orange-600" : grant.active ? "bg-emerald-600" : "bg-red-600"}`}>
                                {expired ? "Expirado" : grant.active ? "Ativo" : "Pausado"}
                              </span>

                              <button onClick={() => deleteRadarGrant(grant.id)} className="rounded-2xl bg-red-900 px-4 py-2 text-sm font-black">
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
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
          padding: 14px;
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