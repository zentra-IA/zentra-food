"use client";

import { useState } from "react";

type Prospect = {
  id: string;
  name: string;
  age: number | null;
  email?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  celular?: string | null;
  mobile?: string | null;
  cep?: string | null;
  city?: string | null;
  revealed?: boolean;
};

type Usage = {
  used: number;
  remaining: number;
};

function getPhone1(p: Prospect) {
  return p.phone1 || p.phone || p.whatsapp || p.celular || p.mobile || "";
}

function getPhone2(p: Prospect) {
  const data = p as any;
  return p.phone2 || data.telefone2 || data.secondaryPhone || "";
}

export default function RadarPage() {
  const [storeAddress, setStoreAddress] = useState("");
  const [city, setCity] = useState("São Paulo");
  const [name, setName] = useState("");
  const [cep, setCep] = useState("");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("65");
  const [radius, setRadius] = useState("5");
  const [limit, setLimit] = useState("100");
  const [viewMode, setViewMode] = useState<"NEW" | "REVEALED" | "ALL">("NEW");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [usage, setUsage] = useState<Usage>({ used: 0, remaining: 0 });

  const selectedCount = selected.length;
  const revealedCount = revealedIds.length;
  const allSelected = prospects.length > 0 && selected.length === prospects.length;

  async function searchProspects(nextPage = page) {
    try {
      setLoading(true);
      setProspects([]);
      setSelected([]);
      setRevealedIds([]);

      const params = new URLSearchParams({
        storeAddress,
        city,
        name,
        cep,
        minAge,
        maxAge,
        radius,
        limit,
        page: String(nextPage),
        view: viewMode,
      });

      const res = await fetch(`/api/radar/search?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Erro ao buscar contatos.");
        return;
      }

      const list = Array.isArray(data.prospects) ? data.prospects : [];

      setProspects(list);
      setRevealedIds(
        list.filter((p: Prospect) => p.revealed).map((p: Prospect) => p.id)
      );

      setUsage({
        used: Number(data.credits?.used || 0),
        remaining: Number(data.credits?.remaining || 2000),
      });

      setTotal(Number(data.total || list.length));
      setPage(Number(data.page || nextPage));
    } catch (error: any) {
      alert(error?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelected((prev) =>
      prev.length === prospects.length ? [] : prospects.map((p) => p.id)
    );
  }

  function clearSelection() {
    setSelected([]);
  }

  async function revealContacts() {
    if (!selected.length) {
      alert("Selecione pelo menos um contato.");
      return;
    }

    const confirmReveal = confirm(
      `Visualizar ${selected.length} contato(s)?\n\nIsso consumirá apenas contatos ainda não visualizados.`
    );

    if (!confirmReveal) return;

    try {
      setRevealing(true);

      const res = await fetch("/api/radar/reveal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok || !data.success) {
        alert(data.error || "Erro ao visualizar contatos.");
        return;
      }

      setProspects((prev) =>
        prev.map((item) => {
          const revealed = Array.isArray(data.prospects)
            ? data.prospects.find((p: Prospect) => p.id === item.id)
            : null;

          return revealed ? { ...item, ...revealed, revealed: true } : item;
        })
      );

      setRevealedIds((prev) => [...new Set([...prev, ...selected])]);

      setUsage({
        used: Number(data.credits?.used || data.used || 0),
        remaining: Number(data.credits?.remaining || data.remaining || 2000),
      });

      alert("Contatos liberados com sucesso.");
    } catch (error: any) {
      alert(error?.message || "Erro inesperado.");
    } finally {
      setRevealing(false);
    }
  }

  function getRevealedProspects() {
    return prospects.filter((p) => revealedIds.includes(p.id) || p.revealed);
  }

  function copyPhones() {
    const text = getRevealedProspects()
      .flatMap((p) => {
        const rows = [];
        const phone1 = getPhone1(p);
        const phone2 = getPhone2(p);

        if (phone1) rows.push(`${p.name},${phone1}`);
        if (phone2) rows.push(`${p.name},${phone2}`);

        return rows;
      })
      .join("\n");

    if (!text) {
      alert("Nenhum telefone liberado para copiar.");
      return;
    }

    navigator.clipboard.writeText(text);
    alert("Nome + telefone copiados.");
  }

  function copyEmails() {
    const text = getRevealedProspects()
      .filter((p) => p.email)
      .map((p) => `${p.name},${p.email}`)
      .join("\n");

    if (!text) {
      alert("Nenhum e-mail liberado para copiar.");
      return;
    }

    navigator.clipboard.writeText(text);
    alert("Nome + e-mail copiados.");
  }

  function copyAll() {
    const text = getRevealedProspects()
      .map((p) =>
        [p.name, p.age, getPhone1(p), getPhone2(p), p.email]
          .filter(Boolean)
          .join(",")
      )
      .join("\n");

    if (!text) {
      alert("Nenhum contato liberado para copiar.");
      return;
    }

    navigator.clipboard.writeText(text);
    alert("Contatos copiados.");
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-red-950 p-5 shadow-2xl md:p-8">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-red-300">
            Radar Local Pro
          </span>

          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
            Encontrar clientes próximos
          </h1>

          <p className="mt-3 max-w-2xl text-sm text-zinc-400 md:text-base">
            Busque contatos próximos da loja, navegue por páginas e revele apenas quando quiser.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-3xl bg-white/5 p-2 backdrop-blur md:max-w-2xl">
            <Metric title="Usados" value={usage.used} />
            <Metric title="Disponíveis" value={usage.remaining} />
            <Metric title="Encontrados" value={total || prospects.length} />
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-4 shadow-sm md:p-5">
          <div className="mb-4">
            <h2 className="text-xl font-black">Buscar contatos</h2>
            <p className="text-sm text-zinc-500">
              Ordenado por proximidade do CEP/endereço, não por nome.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <Field label="Endereço da loja" className="lg:col-span-2">
              <input
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Rua, número, bairro"
                className="input"
              />
            </Field>

            <Field label="Cidade">
              <input value={city} onChange={(e) => setCity(e.target.value)} className="input" />
            </Field>

            <Field label="CEP">
              <input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="Ex: 03263050"
                className="input"
              />
            </Field>

            <Field label="Nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Opcional"
                className="input"
              />
            </Field>

            <Field label="Visualização">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as "NEW" | "REVEALED" | "ALL")}
                className="input"
              >
                <option value="NEW">Novos contatos</option>
                <option value="REVEALED">Já visualizados</option>
                <option value="ALL">Todos</option>
              </select>
            </Field>

            <Field label="Idade mín.">
              <input value={minAge} onChange={(e) => setMinAge(e.target.value)} className="input" />
            </Field>

            <Field label="Idade máx.">
              <input value={maxAge} onChange={(e) => setMaxAge(e.target.value)} className="input" />
            </Field>

            <Field label="Raio">
              <select value={radius} onChange={(e) => setRadius(e.target.value)} className="input">
                <option value="1">1 km</option>
                <option value="2">2 km</option>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="20">20 km</option>
              </select>
            </Field>

            <Field label="Quantidade">
              <select value={limit} onChange={(e) => setLimit(e.target.value)} className="input">
                <option value="50">50</option>
<option value="100">100</option>
<option value="250">250</option>
<option value="500">500</option>
<option value="1000">1000</option>
<option value="1500">1500</option>
<option value="3000">3000</option>
              </select>
            </Field>
          </div>

          <button
            onClick={() => {
              setPage(1);
              searchProspects(1);
            }}
            disabled={loading}
            className="mt-5 w-full rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:bg-red-700 disabled:opacity-50 md:w-auto"
          >
            {loading ? "Buscando..." : "Encontrar clientes"}
          </button>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-4 shadow-sm md:p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">Resultados</h2>
              <p className="text-sm text-zinc-500">
                Página {page} • {prospects.length} nesta página • {selectedCount} selecionados • {revealedCount} liberados
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
              <button onClick={selectAll} className="btn">
                {allSelected ? "Desmarcar todos" : "Selecionar todos"}
              </button>
              <button onClick={clearSelection} className="btn">Limpar</button>
              <button onClick={revealContacts} className="btn-primary">
                {revealing ? "Liberando..." : "Visualizar"}
              </button>
              <button onClick={copyPhones} className="btn">Telefones</button>
              <button onClick={copyEmails} className="btn">E-mails</button>
              <button onClick={copyAll} className="btn">Tudo</button>
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-3xl border border-zinc-800 md:block">
            <table className="w-full text-sm">
              <thead className="bg-black text-white">
                <tr>
                  <th className="p-4 text-left">
                    <input type="checkbox" checked={allSelected} onChange={selectAll} className="h-5 w-5 accent-red-600" />
                  </th>
                  <th className="p-4 text-left">Nome</th>
                  <th className="p-4 text-left">Idade</th>
                  <th className="p-4 text-left">CEP</th>
                  <th className="p-4 text-left">Telefone 1</th>
                  <th className="p-4 text-left">Telefone 2</th>
                  <th className="p-4 text-left">E-mail</th>
                </tr>
              </thead>

              <tbody>
                {prospects.map((p) => {
                  const revealed = revealedIds.includes(p.id) || p.revealed;

                  return (
                    <tr key={p.id} className="border-t border-zinc-800 hover:bg-white/5">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="h-5 w-5 accent-red-600"
                        />
                      </td>

                      <td className="p-4 font-bold text-white">{p.name}</td>
                      <td className="p-4 text-zinc-300">{p.age || "-"}</td>
                      <td className="p-4 text-zinc-300">{p.cep || "-"}</td>
                      <td className="p-4 font-bold text-emerald-400">
                        {revealed ? getPhone1(p) || "-" : "************"}
                      </td>
                      <td className="p-4 font-bold text-emerald-400">
                        {revealed ? getPhone2(p) || "-" : "************"}
                      </td>
                      <td className="p-4 text-zinc-300">
                        {revealed ? p.email || "-" : "************"}
                      </td>
                    </tr>
                  );
                })}

                {!prospects.length && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              disabled={page <= 1 || loading}
              onClick={() => searchProspects(Math.max(1, page - 1))}
              className="btn disabled:opacity-40"
            >
              ← Página anterior
            </button>

            <span className="text-center text-sm font-bold text-zinc-400">
              Página {page}
              {total ? ` • ${total} encontrados` : ""}
            </span>

            <button
              disabled={loading || prospects.length < Number(limit)}
              onClick={() => searchProspects(page + 1)}
              className="btn disabled:opacity-40"
            >
              Próxima página →
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #27272a;
          background: #09090b;
          padding: 12px 14px;
          color: white;
          outline: none;
          font-size: 14px;
        }

        .input:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.18);
        }

        .btn {
          border-radius: 16px;
          border: 1px solid #27272a;
          background: #09090b;
          padding: 11px 14px;
          font-weight: 900;
          font-size: 13px;
          color: white;
        }

        .btn-primary {
          border-radius: 16px;
          background: #dc2626;
          padding: 11px 14px;
          font-weight: 900;
          font-size: 13px;
          color: white;
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      {children}
    </label>
  );
}

function Metric({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 text-center">
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-8 text-center text-sm font-semibold text-zinc-500">
      Nenhum contato pesquisado ainda.
    </div>
  );
}