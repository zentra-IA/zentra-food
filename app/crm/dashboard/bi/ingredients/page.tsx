"use client";

import { useEffect, useState } from "react";

function money(value: any) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getCompanyId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("active_company_id") || "";
}

export default function IngredientsAIPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    try {
      const res = await fetch("/api/products", {
        cache: "no-store",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        console.error("ERRO AO CARREGAR PRODUTOS:", data);
        setProducts([]);
        return;
      }

      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setProducts([]);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const product = products.find((p) => p.id === productId);

  async function askAI() {
    if (!productId) return alert("Selecione um produto.");
    if (!message.trim()) return alert("Descreva a ficha técnica.");

    setLoading(true);
    setResult(null);

    const res = await fetch("/api/bi/ingredients-ai", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        product,
      }),
    });

    const data = await res.json();

    setLoading(false);

    if (!data.success) {
      alert(data.error || "Erro na IA");
      return;
    }

    setResult(data.result);
  }

  async function saveRecipe() {
    if (!productId) return alert("Selecione um produto.");
    if (!result?.ingredients?.length) {
      return alert("Nenhum ingrediente para salvar.");
    }

    setSaving(true);

    for (const item of result.ingredients) {
      await fetch("/api/bi/product-ingredients", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          ingredient_name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          cost_per_unit: item.cost_per_unit,
        }),
      });
    }

    setSaving(false);
    alert("Ficha técnica salva com sucesso.");
  }

  return (
    <main className="min-h-screen bg-black p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-emerald-950/30 p-5 md:p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
            Ficha Técnica com IA
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-5xl">
            🍕 Custo Real dos Produtos
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-zinc-400 md:text-base">
            Escolha um produto do cardápio e descreva os ingredientes. A IA
            calcula custo, lucro, margem e monta a ficha técnica.
          </p>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <label className="text-sm font-black text-zinc-300">
              Produto do cardápio
            </label>

            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setResult(null);
              }}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black p-4 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Selecione o produto</option>

              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — venda {money(p.price)}
                </option>
              ))}
            </select>

            {products.length === 0 && (
              <p className="mt-3 text-sm text-yellow-400">
                Nenhum produto encontrado. Verifique se existe produto criado no
                cardápio.
              </p>
            )}

            <div className="mt-5 rounded-3xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/20 via-black to-zinc-950 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-lg font-black">
                  IA
                </div>

                <div>
                  <h2 className="font-black">Assistente de Ficha Técnica</h2>
                  <p className="text-xs text-zinc-500">
                    Escreva como você faz o produto.
                  </p>
                </div>
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Exemplo:
Na pizza calabresa eu uso 300g de mussarela, 150g de calabresa, 80g de cebola e 100g de molho.
Pago R$30/kg na mussarela, R$40/kg na calabresa, R$6/kg na cebola e R$12/kg no molho.`}
                className="mt-4 h-64 w-full rounded-2xl border border-zinc-800 bg-black p-4 text-sm leading-relaxed text-white outline-none focus:border-emerald-500"
              />

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                <button
                  onClick={askAI}
                  disabled={loading}
                  className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? "Calculando..." : "Calcular com IA"}
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "Uso 300g de mussarela, 150g de calabresa, 80g de cebola e 100g de molho. Pago R$30/kg na mussarela, R$40/kg na calabresa, R$6/kg na cebola e R$12/kg no molho."
                    )
                  }
                  className="rounded-2xl border border-zinc-800 bg-black px-6 py-3 text-sm font-black text-zinc-300 hover:border-emerald-600"
                >
                  Usar exemplo
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-black">Resumo Financeiro</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Card title="Preço venda" value={money(product?.price || 0)} />
              <Card title="Custo total" value={money(result?.total_cost || 0)} />
              <Card title="Lucro" value={money(result?.profit || 0)} />
              <Card
                title="Margem"
                value={`${Number(result?.margin || 0).toFixed(1)}%`}
              />
            </div>

            {result?.suggested_price > 0 && (
              <div className="mt-4 rounded-2xl border border-yellow-800 bg-yellow-950/30 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-yellow-500">
                  Preço sugerido
                </p>

                <p className="mt-2 text-2xl font-black text-yellow-300">
                  {money(result.suggested_price)}
                </p>
              </div>
            )}

            {result?.analysis && (
              <div className="mt-4 whitespace-pre-line rounded-2xl border border-zinc-800 bg-black p-4 text-sm leading-relaxed text-zinc-300">
                {result.analysis}
              </div>
            )}
          </div>
        </section>

        {result?.ingredients?.length > 0 && (
          <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">Ingredientes calculados</h2>
                <p className="text-sm text-zinc-500">
                  Revise antes de salvar a ficha técnica.
                </p>
              </div>

              <button
                onClick={saveRecipe}
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar ficha técnica"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {result.ingredients.map((item: any, index: number) => (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-800 bg-black p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{item.name}</h3>

                      <p className="mt-1 text-sm text-zinc-500">
                        {item.quantity}
                        {item.unit} · custo unitário{" "}
                        {money(item.cost_per_unit)}
                      </p>
                    </div>

                    <p className="font-black text-emerald-400">
                      {money(item.total_cost)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}