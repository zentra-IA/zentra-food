"use client";

import { useEffect, useMemo, useState } from "react";

function money(v: any) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const emptyItem = {
  id: "",
  name: "",
  category: "Geral",
  unit: "un",
  current_quantity: "",
  min_quantity: "",
  average_cost: "",
};

const emptyMovement = {
  stock_item_id: "",
  type: "entrada",
  quantity: "",
  unit_cost: "",
  reason: "",
};

export default function EstoquePage() {
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [item, setItem] = useState<any>(emptyItem);
  const [movement, setMovement] = useState<any>(emptyMovement);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/stock", { cache: "no-store", credentials: "include" });
    const json = await res.json();

    if (!json.success) {
      alert(json.error || "Erro ao carregar estoque");
      setLoading(false);
      return;
    }

    setItems(json.items || []);
    setMovements(json.movements || []);
    setAlerts(json.alerts || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveItem() {
    if (!item.name.trim()) return alert("Informe o nome do produto.");

    const res = await fetch("/api/stock", {
      method: item.id ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "item",
        ...item,
        current_quantity: Number(item.current_quantity || 0),
        min_quantity: Number(item.min_quantity || 0),
        average_cost: Number(item.average_cost || 0),
      }),
    });

    const json = await res.json();
    if (!json.success) return alert(json.error || "Erro ao salvar produto");

    setItem(emptyItem);
    await load();
  }

  async function saveMovement() {
    if (!movement.stock_item_id) return alert("Escolha um produto.");
    if (!movement.quantity) return alert("Informe a quantidade.");

    const res = await fetch("/api/stock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "movement",
        stock_item_id: movement.stock_item_id,
        type: movement.type,
        quantity: Number(movement.quantity || 0),
        unit_cost: Number(movement.unit_cost || 0),
        reason: movement.reason || null,
      }),
    });

    const json = await res.json();
    if (!json.success) return alert(json.error || "Erro ao registrar movimentação");

    setMovement(emptyMovement);
    await load();
  }

  async function removeItem(id: string) {
    if (!confirm("Deseja remover este item do estoque?")) return;

    const res = await fetch(`/api/stock?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const json = await res.json();
    if (!json.success) return alert(json.error || "Erro ao remover item");

    await load();
  }

  function editItem(current: any) {
    setItem({
      id: current.id,
      name: current.name || "",
      category: current.category || "Geral",
      unit: current.unit || "un",
      current_quantity: String(current.current_quantity || ""),
      min_quantity: String(current.min_quantity || ""),
      average_cost: String(current.average_cost || ""),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    return items.filter((i) => {
      if (!term) return true;
      return String(i.name || "").toLowerCase().includes(term) ||
        String(i.category || "").toLowerCase().includes(term);
    });
  }, [items, search]);

  const totalStockValue = useMemo(() => {
    return items.reduce(
      (sum, i) => sum + Number(i.current_quantity || 0) * Number(i.average_cost || 0),
      0
    );
  }, [items]);

  if (loading) return <div className="p-6 text-white">Carregando estoque...</div>;

  return (
    <div className="min-h-screen bg-black p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-emerald-950/30 p-5 md:p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
            Estoque Inteligente
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">📦 Controle de Estoque</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400 md:text-base">
            Controle insumos, entradas, saídas, perdas, ajustes e alertas de estoque mínimo.
          </p>
        </section>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Itens cadastrados" value={items.length} />
          <Card title="Alertas" value={alerts.length} />
          <Card title="Valor em estoque" value={money(totalStockValue)} />
          <Card title="Movimentos" value={movements.length} />
        </div>

        {alerts.length > 0 && (
          <Panel title="⚠️ Alertas de estoque baixo">
            <div className="grid gap-3 md:grid-cols-2">
              {alerts.map((a) => (
                <div key={a.id} className="rounded-2xl border border-red-900 bg-red-950/30 p-4">
                  <h3 className="font-black text-red-300">{a.name}</h3>
                  <p className="text-sm text-red-200">
                    Atual: {a.current_quantity} {a.unit} · Mínimo: {a.min_quantity} {a.unit}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel title={item.id ? "Editar produto do estoque" : "Novo produto no estoque"}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nome do produto" value={item.name} onChange={(v: string) => setItem({ ...item, name: v })} />
              <Select value={item.category} onChange={(v: string) => setItem({ ...item, category: v })}>
                <option value="Geral">Geral</option>
                <option value="Queijos">Queijos</option>
                <option value="Carnes">Carnes</option>
                <option value="Massas">Massas</option>
                <option value="Molhos">Molhos</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Embalagens">Embalagens</option>
                <option value="Hortifruti">Hortifruti</option>
                <option value="Limpeza">Limpeza</option>
              </Select>
              <Select value={item.unit} onChange={(v: string) => setItem({ ...item, unit: v })}>
                <option value="un">Unidade</option>
                <option value="kg">Kg</option>
                <option value="g">Gramas</option>
                <option value="cx">Caixa</option>
                <option value="fardo">Fardo</option>
                <option value="bisnaga">Bisnaga</option>
                <option value="balde">Balde</option>
                <option value="l">Litro</option>
              </Select>
              <Input label="Estoque atual" value={item.current_quantity} onChange={(v: string) => setItem({ ...item, current_quantity: v })} />
              <Input label="Estoque mínimo" value={item.min_quantity} onChange={(v: string) => setItem({ ...item, min_quantity: v })} />
              <Input label="Custo médio" value={item.average_cost} onChange={(v: string) => setItem({ ...item, average_cost: v })} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={saveItem} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black">
                {item.id ? "Salvar edição" : "Cadastrar produto"}
              </button>
              {item.id && (
                <button onClick={() => setItem(emptyItem)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-black text-zinc-400">
                  Cancelar
                </button>
              )}
            </div>
          </Panel>

          <Panel title="Registrar movimentação">
            <div className="grid gap-3 md:grid-cols-2">
              <Select value={movement.stock_item_id} onChange={(v: string) => setMovement({ ...movement, stock_item_id: v })}>
                <option value="">Produto</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.current_quantity} {i.unit}
                  </option>
                ))}
              </Select>
              <Select value={movement.type} onChange={(v: string) => setMovement({ ...movement, type: v })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="perda">Perda</option>
                <option value="ajuste">Ajuste</option>
              </Select>
              <Input label={movement.type === "ajuste" ? "Nova quantidade" : "Quantidade"} value={movement.quantity} onChange={(v: string) => setMovement({ ...movement, quantity: v })} />
              <Input label="Custo unitário" value={movement.unit_cost} onChange={(v: string) => setMovement({ ...movement, unit_cost: v })} />
            </div>

            <textarea
              value={movement.reason}
              onChange={(e) => setMovement({ ...movement, reason: e.target.value })}
              placeholder="Motivo / observação"
              className="mt-3 h-24 w-full rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
            />

            <button onClick={saveMovement} className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black">
              Registrar movimento
            </button>
          </Panel>
        </div>

        <Panel title="Itens do estoque">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto ou categoria..."
            className="mb-4 w-full rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
          />

          <List>
            {filteredItems.map((i) => {
              const low = Number(i.current_quantity || 0) <= Number(i.min_quantity || 0);
              return (
                <Row
                  key={i.id}
                  title={`${low ? "🔴" : "🟢"} ${i.name}`}
                  desc={`${i.category || "Geral"} · Atual: ${i.current_quantity || 0} ${i.unit || "un"} · Mínimo: ${i.min_quantity || 0} ${i.unit || "un"} · Custo médio ${money(i.average_cost)}`}
                  value={money(Number(i.current_quantity || 0) * Number(i.average_cost || 0))}
                >
                  <Actions>
                    <button onClick={() => editItem(i)}>Editar</button>
                    <button onClick={() => setMovement({ ...emptyMovement, stock_item_id: i.id, type: "entrada", unit_cost: String(i.average_cost || "") })}>Entrada</button>
                    <button onClick={() => setMovement({ ...emptyMovement, stock_item_id: i.id, type: "saida" })}>Saída</button>
                    <button onClick={() => removeItem(i.id)}>Remover</button>
                  </Actions>
                </Row>
              );
            })}

            {filteredItems.length === 0 && <Empty text="Nenhum item encontrado." />}
          </List>
        </Panel>

        <Panel title="Últimas movimentações">
          <List>
            {movements.map((m) => (
              <Row
                key={m.id}
                title={`${m.type?.toUpperCase()} · ${m.stock_items?.name || "Produto"}`}
                desc={`${m.quantity} ${m.stock_items?.unit || ""} · ${m.reason || "Sem observação"} · ${new Date(m.created_at).toLocaleString("pt-BR")}`}
                value={money(m.total_cost)}
              />
            ))}

            {movements.length === 0 && <Empty text="Nenhuma movimentação registrada." />}
          </List>
        </Panel>
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{title}</p>
      <h2 className="mt-3 text-2xl font-black">{value}</h2>
    </div>
  );
}

function Panel({ title, children }: any) {
  return (
    <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="mb-4 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, type = "text" }: any) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      className="rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
    />
  );
}

function Select({ value, onChange, children }: any) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
    >
      {children}
    </select>
  );
}

function List({ children }: any) {
  return <div className="mt-5 space-y-3">{children}</div>;
}

function Row({ title, desc, value, children }: any) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-black p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="font-black">{title}</h3>
        <p className="text-sm text-zinc-500">{desc}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
      <div className="font-black text-emerald-400">{value}</div>
    </div>
  );
}

function Actions({ children }: any) {
  return <div className="flex flex-wrap gap-2 text-xs font-black">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-zinc-800 bg-black p-6 text-center text-sm text-zinc-500">{text}</div>;
}
