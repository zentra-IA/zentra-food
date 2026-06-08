"use client";

import { useEffect, useMemo, useState } from "react";

function money(v: any) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyPurchase = {
  supplier_id: "",
  invoice_number: "",
  payment_method: "avista",
  due_date: "",
  total_amount: "",
  paid: false,
  notes: "",
};

const emptyNoteItem = {
  name: "",
  quantity: "1",
  unit: "un",
  unit_price: "",
};

const emptySupplier = {
  id: "",
  name: "",
  phone: "",
  document: "",
};

const emptyExpense = {
  id: "",
  name: "",
  type: "fixed",
  category: "Outros",
  amount: "",
  due_day: "",
  paid: false,
  recurring: true,
  payment_method: "boleto",
  notes: "",
};

const emptyEmployee = {
  id: "",
  name: "",
  role: "",
  salary: "",
  payment_day_1: "5",
  payment_day_2: "20",
  has_advance: false,
  advance_amount: "",
  active: true,
  notes: "",
};

const emptyAppRevenue = {
  id: "",
  app_name: "iFood",
  received_date: today(),
  gross_amount: "",
  fee_amount: "",
  net_amount: "",
  notes: "",
};

export default function CostsERPPage() {
  const [data, setData] = useState<any>({
    suppliers: [],
    invoices: [],
    purchases: [],
    employees: [],
    expenses: [],
    products: [],
    appRevenues: [],
    reminders: [],
  });

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  const [supplier, setSupplier] = useState<any>(emptySupplier);
  const [purchase, setPurchase] = useState<any>(emptyPurchase);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([{ ...emptyNoteItem }]);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);

  const [expense, setExpense] = useState<any>(emptyExpense);
  const [employee, setEmployee] = useState<any>(emptyEmployee);
  const [appRevenue, setAppRevenue] = useState<any>(emptyAppRevenue);

  async function load() {
    setLoading(true);

    const res = await fetch("/api/bi/erp-costs", {
      cache: "no-store",
      credentials: "include",
    });

    const json = await res.json();

    if (json.success) {
      setData({
        suppliers: json.suppliers || [],
        invoices: json.invoices || [],
        purchases: json.purchases || [],
        employees: json.employees || [],
        expenses: json.expenses || [],
        products: json.products || [],
        appRevenues: json.appRevenues || [],
        reminders: json.reminders || [],
      });
    } else {
      alert(json.error || "Erro ao carregar ERP financeiro");
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function request(method: "POST" | "PATCH", body: any) {
    const res = await fetch("/api/bi/erp-costs", {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!json.success) {
      alert(json.error || "Erro ao salvar");
      return null;
    }

    await load();
    return json;
  }

  async function post(body: any) {
    return request("POST", body);
  }

  async function patch(body: any) {
    return request("PATCH", body);
  }

  async function remove(table: string, id: string) {
    if (!confirm("Tem certeza que deseja excluir?")) return;

    const res = await fetch(`/api/bi/erp-costs?table=${table}&id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const json = await res.json();

    if (!json.success) return alert(json.error || "Erro ao excluir");

    await load();
  }

  function parseNumber(value: any) {
    const raw = String(value || "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/\s/g, "");

    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function noteItemsToPayload() {
    return purchaseItems
      .map((item) => {
        const quantity = parseNumber(item.quantity);
        const unitPrice = parseNumber(item.unit_price);
        const totalAmount = quantity * unitPrice;

        return {
          name: String(item.name || "").trim(),
          quantity,
          unit: item.unit || "un",
          unit_price: unitPrice,
          total_amount: totalAmount,
          payment_method: purchase.payment_method || "avista",
          due_date: purchase.due_date || null,
          supplier_id: purchase.supplier_id || null,
          paid: purchase.paid || false,
          invoice_number: purchase.invoice_number || null,
          notes: purchase.notes || null,
        };
      })
      .filter((item) => item.name && item.quantity > 0 && item.unit_price > 0);
  }

  const manualItemsTotal = useMemo(() => {
    return purchaseItems.reduce((sum, item) => {
      return sum + parseNumber(item.quantity) * parseNumber(item.unit_price);
    }, 0);
  }, [purchaseItems]);

  const noteTotalValue =
    parseNumber(purchase.total_amount) > 0
      ? parseNumber(purchase.total_amount)
      : manualItemsTotal;

  function updatePurchaseItem(index: number, field: string, value: string) {
    setPurchaseItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addPurchaseItem() {
    setPurchaseItems((prev) => [...prev, { ...emptyNoteItem }]);
  }

  function removePurchaseItem(index: number) {
    setPurchaseItems((prev) =>
      prev.length === 1 ? [{ ...emptyNoteItem }] : prev.filter((_, i) => i !== index)
    );
  }

  function generateManualPreview() {
    const items = noteItemsToPayload();

    if (!items.length) {
      setBulkPreview([]);
      alert("Nenhum produto adicionado. Você pode salvar apenas a nota fiscal.");
      return;
    }

    setBulkPreview(items);
  }

  function parseBulkText() {
    const lines = bulkText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!lines.length) {
      setBulkPreview([]);
      return alert("Cole pelo menos um item ou salve apenas a nota.");
    }

    const items = lines
      .map((line) => {
        const semicolonParts = line.split(";").map((x) => x.trim()).filter(Boolean);

        if (semicolonParts.length >= 4) {
          const quantity = parseNumber(semicolonParts[1]);
          const unitPrice = parseNumber(semicolonParts[3]);

          return {
            name: semicolonParts[0],
            quantity,
            unit: semicolonParts[2] || "un",
            unit_price: unitPrice,
            total_amount: quantity * unitPrice,
            payment_method: purchase.payment_method || "avista",
            due_date: purchase.due_date || null,
            supplier_id: purchase.supplier_id || null,
            paid: purchase.paid || false,
            invoice_number: purchase.invoice_number || null,
            notes: purchase.notes || null,
          };
        }

        const lower = line.toLowerCase();
        const moneyMatches = [...line.matchAll(/r\$\s?(\d+(?:[.,]\d{1,2})?)/gi)].map(
          (m) => parseNumber(m[1])
        );

        const totalAmount = moneyMatches.length ? moneyMatches[moneyMatches.length - 1] : 0;

        const match =
          lower.match(/(\d+(?:[,.]\d+)?)\s?(caixa|caixas|cx)/i) ||
          lower.match(/(\d+(?:[,.]\d+)?)\s?(kg|quilo|quilos)/i) ||
          lower.match(/(\d+(?:[,.]\d+)?)\s?(g|gramas)/i) ||
          lower.match(/(\d+(?:[,.]\d+)?)\s?(un|unidade|unidades)/i) ||
          lower.match(/(\d+(?:[,.]\d+)?)\s?(l|litro|litros)/i) ||
          lower.match(/(\d+(?:[,.]\d+)?)\s?(fardo|fardos)/i) ||
          lower.match(/(\d+(?:[,.]\d+)?)\s?(bisnaga|bisnagas)/i) ||
          lower.match(/(\d+(?:[,.]\d+)?)\s?(balde|baldes)/i);

        const quantity = match ? parseNumber(match[1]) : 1;
        const unitRaw = match ? String(match[2]).toLowerCase() : "un";

        const unit =
          unitRaw.includes("caixa") || unitRaw === "cx"
            ? "cx"
            : unitRaw.includes("quilo") || unitRaw === "kg"
            ? "kg"
            : unitRaw.includes("grama") || unitRaw === "g"
            ? "g"
            : unitRaw.includes("litro") || unitRaw === "l"
            ? "l"
            : unitRaw.includes("fardo")
            ? "fardo"
            : unitRaw.includes("bisnaga")
            ? "bisnaga"
            : unitRaw.includes("balde")
            ? "balde"
            : "un";

        const cleanName = line
          .replace(/r\$\s?\d+(?:[,.]\d{1,2})?/gi, "")
          .replace(/\d+(?:[,.]\d+)?\s?(caixa|caixas|cx|kg|quilo|quilos|g|gramas|un|unidade|unidades|l|litro|litros|fardo|fardos|bisnaga|bisnagas|balde|baldes)/gi, "")
          .replace(/valor total|total|preço|por kg/gi, "")
          .replace(/[-–]/g, "")
          .trim();

        return {
          name: cleanName || line,
          quantity,
          unit,
          unit_price: quantity ? totalAmount / quantity : totalAmount,
          total_amount: totalAmount,
          payment_method: purchase.payment_method || "avista",
          due_date: purchase.due_date || null,
          supplier_id: purchase.supplier_id || null,
          paid: purchase.paid || false,
          invoice_number: purchase.invoice_number || null,
          notes: purchase.notes || null,
        };
      })
      .filter((item) => item.name && item.quantity > 0 && item.total_amount >= 0);

    setBulkPreview(items);
  }

  async function saveBulk() {
    const manualItems = noteItemsToPayload();
    const itemsToSave = bulkPreview.length ? bulkPreview : manualItems;
    const total = parseNumber(purchase.total_amount) || manualItemsTotal;

    if (!total) {
      return alert("Informe o valor total da nota fiscal.");
    }

    let result = null;

    if (!itemsToSave.length) {
      result = await post({
        action: "purchase-invoice",
        supplier_id: purchase.supplier_id || null,
        payment_method: purchase.payment_method || "avista",
        due_date: purchase.due_date || null,
        paid: purchase.paid,
        invoice_number: purchase.invoice_number || null,
        total_amount: total,
        notes: purchase.notes || null,
      });
    } else {
      result = await post({
        action: "purchase-bulk",
        items: itemsToSave,
        supplier_id: purchase.supplier_id || null,
        payment_method: purchase.payment_method || "avista",
        due_date: purchase.due_date || null,
        paid: purchase.paid,
        invoice_number: purchase.invoice_number || null,
        total_amount: total,
        notes: purchase.notes || null,
      });
    }

    if (!result) return;

    alert("Nota fiscal salva com sucesso.");

    setBulkText("");
    setBulkPreview([]);
    setPurchase(emptyPurchase);
    setPurchaseItems([{ ...emptyNoteItem }]);
  }

  async function saveSupplier() {
    if (!supplier.name.trim()) return alert("Informe o fornecedor");

    if (supplier.id) {
      await patch({ action: "supplier", ...supplier });
    } else {
      await post({ action: "supplier", ...supplier });
    }

    setSupplier(emptySupplier);
  }

  async function saveExpense() {
    if (!expense.name.trim()) return alert("Informe o nome da conta");
    if (!expense.amount) return alert("Informe o valor");

    if (expense.id) {
      await patch({ action: "expense", ...expense });
    } else {
      await post({ action: "expense", ...expense });
    }

    setExpense(emptyExpense);
  }

  async function saveEmployee() {
    if (!employee.name.trim()) return alert("Informe o funcionário");

    if (employee.id) {
      await patch({ action: "employee", ...employee });
    } else {
      await post({ action: "employee", ...employee });
    }

    setEmployee(emptyEmployee);
  }

  async function saveAppRevenue() {
    if (!appRevenue.app_name) return alert("Informe o aplicativo");
    if (!appRevenue.received_date) return alert("Informe a data de recebimento");

    const gross = parseNumber(appRevenue.gross_amount);
    const fee = parseNumber(appRevenue.fee_amount);
    const net = parseNumber(appRevenue.net_amount) || Math.max(gross - fee, 0);

    if (!net) return alert("Informe o valor recebido.");

    if (appRevenue.id) {
      await patch({
        action: "app-revenue",
        ...appRevenue,
        gross_amount: gross,
        fee_amount: fee,
        net_amount: net,
      });
    } else {
      await post({
        action: "app-revenue",
        ...appRevenue,
        gross_amount: gross,
        fee_amount: fee,
        net_amount: net,
      });
    }

    setAppRevenue(emptyAppRevenue);
  }

  const invoiceTotal = (data.invoices || []).reduce(
    (s: number, x: any) => s + Number(x.total_amount || 0),
    0
  );

  const purchasesItemsTotal = (data.purchases || []).reduce(
    (s: number, x: any) => s + Number(x.total_amount || 0),
    0
  );

  const totals = useMemo(() => {
    const purchases = invoiceTotal || purchasesItemsTotal;

    const expenses = data.expenses.reduce(
      (s: number, x: any) => s + Number(x.amount || 0),
      0
    );

    const payroll = data.employees.reduce((s: number, e: any) => {
      if (e.active === false) return s;
      const salary = Number(e.salary || 0);
      const advance = e.has_advance ? Number(e.advance_amount || 0) : 0;
      return s + salary - advance;
    }, 0);

    const appRevenueTotal = data.appRevenues.reduce(
      (s: number, x: any) => s + Number(x.net_amount || 0),
      0
    );

    const pending = [
      ...(data.invoices?.length ? data.invoices : data.purchases),
      ...data.expenses,
    ].filter((x: any) => !x.paid).length;

    return { purchases, expenses, payroll, appRevenueTotal, pending };
  }, [data, invoiceTotal, purchasesItemsTotal]);

  if (loading) {
    return <div className="p-6 text-white">Carregando ERP financeiro...</div>;
  }

  return (
    <div className="min-h-screen bg-black p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-emerald-950/30 p-5 md:p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
            ERP Financeiro
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-5xl">
            💰 Gestão Financeira
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-zinc-400 md:text-base">
            Controle notas fiscais, compras, fornecedores, entradas por app,
            contas, funcionários e custos dos produtos.
          </p>
        </section>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card title="Notas / Compras" value={money(totals.purchases)} />
          <Card title="Entradas Apps" value={money(totals.appRevenueTotal)} />
          <Card title="Contas" value={money(totals.expenses)} />
          <Card title="Folha estimada" value={money(totals.payroll)} />
          <Card title="Pendências" value={totals.pending} />
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {[
            ["dashboard", "Resumo"],
            ["importar", "Compras / Nota Fiscal"],
            ["entradas", "Entradas Apps"],
            ["fornecedores", "Fornecedores"],
            ["contas", "Contas"],
            ["funcionarios", "Funcionários"],
            ["produtos", "Custos Produtos"],
            ["lembretes", "Lembretes"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black transition ${
                tab === key
                  ? "bg-emerald-600 text-white shadow-lg"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-emerald-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="Alertas de vencimento">
              <List>
                {data.reminders.length === 0 && (
                  <Empty text="Nenhum vencimento urgente." />
                )}

                {data.reminders.map((r: any, i: number) => (
                  <Row
                    key={i}
                    title={r.title}
                    desc={`${r.type} · ${
                      r.status === "overdue"
                        ? "Atrasado"
                        : r.status === "today"
                        ? "Vence hoje"
                        : "Vence amanhã"
                    } · ${r.due_date}`}
                    value={money(r.amount)}
                  />
                ))}
              </List>
            </Panel>

            <Panel title="Resumo inteligente">
              <div className="grid gap-3">
                <Insight text={`Notas/compras no período: ${money(totals.purchases)}.`} />
                <Insight text={`Entradas por apps: ${money(totals.appRevenueTotal)}.`} />
                <Insight text={`Contas cadastradas: ${money(totals.expenses)}.`} />
                <Insight text={`Folha estimada: ${money(totals.payroll)}.`} />
                <Insight text={`Existem ${totals.pending} pendência(s) em aberto.`} />
              </div>
            </Panel>
          </div>
        )}

        {tab === "importar" && (
          <Panel title="Compras / Nota Fiscal">
            <p className="mb-3 text-sm text-zinc-400">
              Salve apenas a nota para controle de pagamento. Os produtos são opcionais.
            </p>

            <div className="grid gap-3 md:grid-cols-5">
              <Select
                value={purchase.supplier_id}
                onChange={(v: string) =>
                  setPurchase({ ...purchase, supplier_id: v })
                }
              >
                <option value="">Fornecedor</option>
                {data.suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>

              <Input
                label="Nº nota fiscal"
                value={purchase.invoice_number}
                onChange={(v: string) =>
                  setPurchase({ ...purchase, invoice_number: v })
                }
              />

              <Select
                value={purchase.payment_method}
                onChange={(v: string) =>
                  setPurchase({ ...purchase, payment_method: v })
                }
              >
                <option value="avista">À vista</option>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="cartao_credito">Cartão de crédito</option>
              </Select>

              <Input
                type="date"
                label="Vencimento"
                value={purchase.due_date}
                onChange={(v: string) =>
                  setPurchase({ ...purchase, due_date: v })
                }
              />

              <Input
                label="Valor total da nota"
                value={purchase.total_amount}
                onChange={(v: string) =>
                  setPurchase({ ...purchase, total_amount: v })
                }
              />

              <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black p-3 text-sm">
                <input
                  type="checkbox"
                  checked={purchase.paid}
                  onChange={(e) =>
                    setPurchase({ ...purchase, paid: e.target.checked })
                  }
                />
                Pago
              </label>
            </div>

            <div className="mt-5 rounded-3xl border border-zinc-800 bg-black p-4">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-black">Produtos da nota</h3>
                  <p className="text-sm text-zinc-500">
                    Opcional. Use apenas se quiser controlar os itens da nota.
                  </p>
                </div>

                <button
                  onClick={addPurchaseItem}
                  className="rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-black hover:bg-zinc-700"
                >
                  + Adicionar produto
                </button>
              </div>

              <div className="space-y-3">
                {purchaseItems.map((item, index) => {
                  const itemTotal =
                    parseNumber(item.quantity) * parseNumber(item.unit_price);

                  return (
                    <div
                      key={index}
                      className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
                    >
                      <Input
                        label="Nome do produto"
                        value={item.name}
                        onChange={(v: string) =>
                          updatePurchaseItem(index, "name", v)
                        }
                      />

                      <Input
                        label="Quantidade"
                        value={item.quantity}
                        onChange={(v: string) =>
                          updatePurchaseItem(index, "quantity", v)
                        }
                      />

                      <Select
                        value={item.unit}
                        onChange={(v: string) =>
                          updatePurchaseItem(index, "unit", v)
                        }
                      >
                        <option value="un">Unidade</option>
                        <option value="kg">Kg</option>
                        <option value="g">Gramas</option>
                        <option value="cx">Caixa</option>
                        <option value="bisnaga">Bisnaga</option>
                        <option value="balde">Balde</option>
                        <option value="fardo">Fardo</option>
                        <option value="l">Litro</option>
                      </Select>

                      <Input
                        label="Valor unitário"
                        value={item.unit_price}
                        onChange={(v: string) =>
                          updatePurchaseItem(index, "unit_price", v)
                        }
                      />

                      <div className="rounded-2xl border border-zinc-800 bg-black p-3 text-sm">
                        <p className="text-xs text-zinc-500">Total item</p>
                        <p className="font-black text-emerald-400">
                          {money(itemTotal)}
                        </p>
                      </div>

                      <button
                        onClick={() => removePurchaseItem(index)}
                        className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black hover:bg-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Card title="Total calculado dos itens" value={money(manualItemsTotal)} />
                <Card title="Valor total da nota" value={money(noteTotalValue)} />
                <Card title="Diferença" value={money(noteTotalValue - manualItemsTotal)} />
              </div>
            </div>

            <textarea
              value={purchase.notes}
              onChange={(e) =>
                setPurchase({ ...purchase, notes: e.target.value })
              }
              placeholder="Observações da nota"
              className="mt-3 h-24 w-full rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={generateManualPreview}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black"
              >
                Gerar prévia dos produtos
              </button>

              <button
                onClick={saveBulk}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black"
              >
                Salvar Nota Fiscal
              </button>
            </div>

            <details className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
              <summary className="cursor-pointer text-sm font-black text-zinc-300">
                Importar produtos por texto colado
              </summary>

              <p className="mt-3 text-sm text-zinc-500">
                Formato seguro: produto;quantidade;unidade;valor unitário.
              </p>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`Mussarela;10;kg;42.90
Calabresa;5;kg;36
Requeijão;4;bisnaga;10.48
Caixa Pizza;100;un;0.65`}
                className="mt-3 h-44 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm outline-none focus:border-emerald-500"
              />

              <button
                onClick={parseBulkText}
                className="mt-3 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black"
              >
                Gerar prévia do texto
              </button>
            </details>

            {bulkPreview.length > 0 && (
              <List>
                {bulkPreview.map((p, i) => (
                  <Row
                    key={i}
                    title={p.name}
                    desc={`${p.quantity} ${p.unit} · unitário ${money(
                      p.unit_price
                    )} · nota ${p.invoice_number || purchase.invoice_number || "-"}`}
                    value={money(p.total_amount)}
                  />
                ))}
              </List>
            )}

            <Panel title="Notas fiscais registradas">
              <List>
                {(data.invoices || []).map((inv: any) => (
                  <Row
                    key={inv.id}
                    title={`NF ${inv.invoice_number || "sem número"}`}
                    desc={`${inv.suppliers?.name || "Sem fornecedor"} · ${
                      inv.payment_method || "-"
                    } · venc. ${inv.due_date || "-"} · ${
                      inv.paid ? "Pago" : "Pendente"
                    } · ${inv.items?.length || 0} item(ns)`}
                    value={money(inv.total_amount)}
                  >
                    <Actions>
                      <button
                        onClick={() =>
                          patch({
                            action: "purchase-invoice-paid",
                            id: inv.id,
                            paid: !inv.paid,
                          })
                        }
                      >
                        {inv.paid ? "Marcar pendente" : "Pagar"}
                      </button>

                      <button onClick={() => remove("purchase_invoices", inv.id)}>
                        Excluir
                      </button>
                    </Actions>

                    {inv.items?.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {inv.items.map((item: any) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300"
                          >
                            {item.name} · {item.quantity} {item.unit} ·{" "}
                            {money(item.total_amount)}
                          </div>
                        ))}
                      </div>
                    )}
                  </Row>
                ))}

                {(!data.invoices || data.invoices.length === 0) && (
                  <Empty text="Nenhuma nota fiscal registrada." />
                )}
              </List>
            </Panel>

            {data.purchases?.length > 0 && (
              <Panel title="Itens antigos / compras soltas">
                <List>
                  {data.purchases.map((p: any) => (
                    <Row
                      key={p.id}
                      title={p.name}
                      desc={`${p.suppliers?.name || "Sem fornecedor"} · nota ${
                        p.invoice_number || "-"
                      } · ${p.quantity || 0} ${p.unit || "un"} · ${
                        p.payment_method
                      } · venc. ${p.due_date || "-"} · ${
                        p.paid ? "Pago" : "Pendente"
                      }`}
                      value={money(p.total_amount)}
                    >
                      <Actions>
                        <button
                          onClick={() =>
                            patch({
                              action: "purchase-paid",
                              id: p.id,
                              paid: !p.paid,
                            })
                          }
                        >
                          {p.paid ? "Marcar pendente" : "Pagar"}
                        </button>

                        <button onClick={() => remove("purchase_items", p.id)}>
                          Excluir
                        </button>
                      </Actions>
                    </Row>
                  ))}
                </List>
              </Panel>
            )}
          </Panel>
        )}

        {tab === "entradas" && (
          <Panel title="Entradas Apps">
            <p className="mb-3 text-sm text-zinc-400">
              Registre os valores recebidos semanalmente por iFood, 99Food,
              Aiqfome, balcão ou outros canais.
            </p>

            <div className="grid gap-3 md:grid-cols-5">
              <Select
                value={appRevenue.app_name}
                onChange={(v: string) =>
                  setAppRevenue({ ...appRevenue, app_name: v })
                }
              >
                <option value="iFood">iFood</option>
<option value="99Food">99Food</option>
<option value="Shopee">Shopee</option>
<option value="Aiqfome">Aiqfome</option>
<option value="Balcão">Balcão</option>
<option value="Outros">Outros</option>
              </Select>

              <Input
                type="date"
                label="Data recebimento"
                value={appRevenue.received_date}
                onChange={(v: string) =>
                  setAppRevenue({ ...appRevenue, received_date: v })
                }
              />

              <Input
                label="Valor bruto"
                value={appRevenue.gross_amount}
                onChange={(v: string) =>
                  setAppRevenue({ ...appRevenue, gross_amount: v })
                }
              />

              <Input
                label="Taxa/desconto"
                value={appRevenue.fee_amount}
                onChange={(v: string) =>
                  setAppRevenue({ ...appRevenue, fee_amount: v })
                }
              />

              <Input
                label="Valor recebido"
                value={appRevenue.net_amount}
                onChange={(v: string) =>
                  setAppRevenue({ ...appRevenue, net_amount: v })
                }
              />
            </div>

            <textarea
              value={appRevenue.notes}
              onChange={(e) =>
                setAppRevenue({ ...appRevenue, notes: e.target.value })
              }
              placeholder="Observações"
              className="mt-3 h-24 w-full rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
            />

            <div className="mt-4">
              <button
                onClick={saveAppRevenue}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black"
              >
                Registrar entrada
              </button>
            </div>

            <List>
              {data.appRevenues.map((r: any) => (
                <Row
                  key={r.id}
                  title={r.app_name}
                  desc={`Recebido em ${r.received_date} · Bruto ${money(
                    r.gross_amount
                  )} · Taxas ${money(r.fee_amount)}`}
                  value={money(r.net_amount)}
                >
                  <Actions>
                    <button onClick={() => remove("app_revenues", r.id)}>
                      Excluir
                    </button>
                  </Actions>
                </Row>
              ))}

              {data.appRevenues.length === 0 && (
                <Empty text="Nenhuma entrada de app registrada." />
              )}
            </List>
          </Panel>
        )}

        {tab === "fornecedores" && (
          <Panel title={supplier.id ? "Editar fornecedor" : "Novo fornecedor"}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Nome do fornecedor"
                value={supplier.name}
                onChange={(v: string) => setSupplier({ ...supplier, name: v })}
              />

              <Input
                label="Telefone"
                value={supplier.phone}
                onChange={(v: string) => setSupplier({ ...supplier, phone: v })}
              />

              <Input
                label="CNPJ / CPF"
                value={supplier.document}
                onChange={(v: string) =>
                  setSupplier({ ...supplier, document: v })
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={saveSupplier}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black"
              >
                {supplier.id ? "Salvar edição" : "Adicionar fornecedor"}
              </button>

              {supplier.id && (
                <button
                  onClick={() => setSupplier(emptySupplier)}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-black text-zinc-400"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <List>
              {data.suppliers.map((s: any) => (
                <Row
                  key={s.id}
                  title={s.name}
                  desc={`${s.phone || "Sem telefone"} · ${
                    s.document || "Sem documento"
                  }`}
                  value=""
                >
                  <Actions>
                    <button onClick={() => setSupplier(s)}>Editar</button>
                    <button onClick={() => remove("suppliers", s.id)}>
                      Excluir
                    </button>
                  </Actions>
                </Row>
              ))}
            </List>
          </Panel>
        )}

        {tab === "contas" && (
          <Panel title={expense.id ? "Editar conta" : "Nova conta"}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Nome da conta"
                value={expense.name}
                onChange={(v: string) => setExpense({ ...expense, name: v })}
              />

              <Input
                label="Valor"
                value={expense.amount}
                onChange={(v: string) => setExpense({ ...expense, amount: v })}
              />

              <Input
                label="Dia vencimento"
                value={expense.due_day}
                onChange={(v: string) =>
                  setExpense({ ...expense, due_day: v })
                }
              />

              <Select
                value={expense.type}
                onChange={(v: string) => setExpense({ ...expense, type: v })}
              >
                <option value="fixed">Fixa</option>
                <option value="variable">Variável</option>
              </Select>

              <Select
                value={expense.category}
                onChange={(v: string) =>
                  setExpense({ ...expense, category: v })
                }
              >
                <option>Aluguel</option>
                <option>Funcionário</option>
                <option>Energia</option>
                <option>Gás</option>
                <option>Internet</option>
                <option>Marketing</option>
                <option>Embalagem</option>
                <option>Imposto</option>
                <option>Outros</option>
              </Select>

              <Select
                value={expense.payment_method}
                onChange={(v: string) =>
                  setExpense({ ...expense, payment_method: v })
                }
              >
                <option value="boleto">Boleto</option>
                <option value="pix">Pix</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="avista">À vista</option>
              </Select>

              <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black p-3 text-sm">
                <input
                  type="checkbox"
                  checked={expense.recurring}
                  onChange={(e) =>
                    setExpense({ ...expense, recurring: e.target.checked })
                  }
                />
                Recorrente mensal
              </label>

              <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black p-3 text-sm">
                <input
                  type="checkbox"
                  checked={expense.paid}
                  onChange={(e) =>
                    setExpense({ ...expense, paid: e.target.checked })
                  }
                />
                Pago
              </label>
            </div>

            <textarea
              value={expense.notes}
              onChange={(e) =>
                setExpense({ ...expense, notes: e.target.value })
              }
              placeholder="Observações"
              className="mt-3 h-24 w-full rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={saveExpense}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black"
              >
                {expense.id ? "Salvar edição" : "Adicionar conta"}
              </button>

              {expense.id && (
                <button
                  onClick={() => setExpense(emptyExpense)}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-black text-zinc-400"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <List>
              {data.expenses.map((e: any) => (
                <Row
                  key={e.id}
                  title={e.name}
                  desc={`${e.category} · ${
                    e.type === "fixed" ? "Fixa" : "Variável"
                  } · venc. dia ${e.due_day || "-"} · ${
                    e.recurring ? "Recorrente" : "Única"
                  } · ${e.paid ? "Pago" : "Pendente"}`}
                  value={money(e.amount)}
                >
                  <Actions>
                    <button onClick={() => setExpense(e)}>Editar</button>
                    <button
                      onClick={() =>
                        patch({
                          action: "expense-paid",
                          id: e.id,
                          paid: !e.paid,
                        })
                      }
                    >
                      {e.paid ? "Marcar pendente" : "Pagar"}
                    </button>
                    <button onClick={() => remove("business_expenses", e.id)}>
                      Excluir
                    </button>
                  </Actions>
                </Row>
              ))}
            </List>
          </Panel>
        )}

        {tab === "funcionarios" && (
          <Panel title={employee.id ? "Editar funcionário" : "Novo funcionário"}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Nome"
                value={employee.name}
                onChange={(v: string) => setEmployee({ ...employee, name: v })}
              />

              <Input
                label="Função"
                value={employee.role}
                onChange={(v: string) => setEmployee({ ...employee, role: v })}
              />

              <Input
                label="Salário"
                value={employee.salary}
                onChange={(v: string) =>
                  setEmployee({ ...employee, salary: v })
                }
              />

              <Input
                label="Pagamento 1"
                value={employee.payment_day_1}
                onChange={(v: string) =>
                  setEmployee({ ...employee, payment_day_1: v })
                }
              />

              <Input
                label="Pagamento 2"
                value={employee.payment_day_2}
                onChange={(v: string) =>
                  setEmployee({ ...employee, payment_day_2: v })
                }
              />

              <Input
                label="Valor do vale"
                value={employee.advance_amount}
                onChange={(v: string) =>
                  setEmployee({ ...employee, advance_amount: v })
                }
              />

              <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black p-3 text-sm">
                <input
                  type="checkbox"
                  checked={employee.has_advance}
                  onChange={(e) =>
                    setEmployee({ ...employee, has_advance: e.target.checked })
                  }
                />
                Pega vale
              </label>

              <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black p-3 text-sm">
                <input
                  type="checkbox"
                  checked={employee.active}
                  onChange={(e) =>
                    setEmployee({ ...employee, active: e.target.checked })
                  }
                />
                Ativo
              </label>
            </div>

            <textarea
              value={employee.notes}
              onChange={(e) =>
                setEmployee({ ...employee, notes: e.target.value })
              }
              placeholder="Observações"
              className="mt-3 h-24 w-full rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-emerald-500"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={saveEmployee}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black"
              >
                {employee.id ? "Salvar edição" : "Adicionar funcionário"}
              </button>

              {employee.id && (
                <button
                  onClick={() => setEmployee(emptyEmployee)}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-black text-zinc-400"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <List>
              {data.employees.map((e: any) => {
                const net =
                  Number(e.salary || 0) -
                  (e.has_advance ? Number(e.advance_amount || 0) : 0);

                return (
                  <Row
                    key={e.id}
                    title={e.name}
                    desc={`${e.role || "Sem função"} · paga dia ${
                      e.payment_day_1
                    } e ${e.payment_day_2} · ${
                      e.has_advance ? `vale ${money(e.advance_amount)}` : "sem vale"
                    } · ${e.active ? "Ativo" : "Inativo"}`}
                    value={money(net)}
                  >
                    <Actions>
                      <button onClick={() => setEmployee(e)}>Editar</button>
                      <button
                        onClick={() =>
                          patch({
                            action: "employee",
                            ...e,
                            active: !e.active,
                          })
                        }
                      >
                        {e.active ? "Desativar" : "Ativar"}
                      </button>
                      <button onClick={() => remove("employees", e.id)}>
                        Excluir
                      </button>
                    </Actions>
                  </Row>
                );
              })}
            </List>
          </Panel>
        )}

        {tab === "produtos" && (
          <Panel title="Custos dos Produtos Vendidos">
            <List>
              {data.products.map((p: any) => {
                const price = Number(p.price || 0);
                const cost = Number(p.costPrice || 0);
                const profit = price - cost;
                const margin = price ? (profit / price) * 100 : 0;

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-zinc-800 bg-black p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-black">{p.name}</h3>
                        <p className="text-sm text-zinc-500">
                          Venda {money(price)} · Custo {money(cost)} · Lucro{" "}
                          {money(profit)} · Margem {margin.toFixed(1)}%
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <input
                          id={`cost-${p.id}`}
                          defaultValue={cost}
                          type="number"
                          step="0.01"
                          className="w-32 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                          placeholder="Custo"
                        />

                        <button
                          onClick={() => {
                            const input = document.getElementById(
                              `cost-${p.id}`
                            ) as HTMLInputElement;

                            patch({
                              action: "product-cost",
                              productId: p.id,
                              costPrice: input.value,
                            });
                          }}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {data.products.length === 0 && (
                <Empty text="Nenhum produto encontrado." />
              )}
            </List>
          </Panel>
        )}

        {tab === "lembretes" && (
          <Panel title="Lembretes de vencimento">
            <List>
              {data.reminders.length === 0 && (
                <Empty text="Nenhum vencimento urgente." />
              )}

              {data.reminders.map((r: any, i: number) => (
                <Row
                  key={i}
                  title={r.title}
                  desc={`${r.type} · ${
                    r.status === "overdue"
                      ? "Atrasado"
                      : r.status === "today"
                      ? "Vence hoje"
                      : "Vence amanhã"
                  } · ${r.due_date}`}
                  value={money(r.amount)}
                />
              ))}
            </List>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
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
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function Insight({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">
      • {text}
    </div>
  );
}
