"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function BIPage() {
  const [data, setData] = useState<any>(null);
  const [salesChart, setSalesChart] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);

      const overviewRes = await fetch("/api/bi/overview", {
        cache: "no-store",
        credentials: "include",
      });

      const overview = await overviewRes.json();

      const chartRes = await fetch("/api/bi/sales-chart", {
        cache: "no-store",
        credentials: "include",
      });

      const chart = await chartRes.json();

      setData(overview);
      setSalesChart(Array.isArray(chart) ? chart : []);
      setTopProducts(overview?.topProducts || []);
    } catch (error) {
      console.error("ERRO BI:", error);

      setData({
        success: false,
        error: "Erro ao carregar BI",
      });
    } finally {
      setLoading(false);
    }
  }

  async function askBI() {
    if (!aiQuestion.trim()) return;

    setAiLoading(true);
    setAiAnswer("");

    try {
      const res = await fetch("/api/bi/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          question: aiQuestion,
          biData: data,
        }),
      });

      const json = await res.json();

      setAiAnswer(json.success ? json.answer : json.error || "Erro na IA");
    } catch {
      setAiAnswer("Erro ao consultar IA.");
    }

    setAiLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          Carregando BI...
        </div>
      </div>
    );
  }

  if (!data?.success) {
    return (
      <div className="p-4 text-white md:p-6">
        <div className="rounded-3xl border border-red-900 bg-red-950/30 p-6">
          Erro ao carregar BI: {data?.error || "erro desconhecido"}
        </div>
      </div>
    );
  }

  const insights = [
    `Faturamento do mês: ${money(data.sales.revenueMonth)}.`,
    `Custo estimado: ${money(data.profit.costMonth)}.`,
    `Lucro bruto: ${money(data.profit.grossProfitMonth)}.`,
    `Margem bruta: ${percent(data.profit.grossMarginMonth)}.`,
    data.profit.mostProfitableProduct
      ? `Produto mais lucrativo: ${data.profit.mostProfitableProduct.name}.`
      : "Ainda não há produto lucrativo calculado.",
    data.profit.lowMarginProduct
      ? `Menor margem: ${data.profit.lowMarginProduct.name}, com ${percent(
          data.profit.lowMarginProduct.margin
        )}.`
      : "Ainda não há produto com baixa margem identificado.",
    `${data.crm.stoppedLeads} lead(s) parados há 2 dias ou mais.`,
  ];

  return (
    <div className="min-h-screen bg-black px-3 py-4 text-white md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-emerald-950/30 p-5 shadow-2xl md:flex-row md:items-end md:justify-between md:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
              Zentra Analytics
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
              📊 BI Inteligente
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-zinc-400 md:text-base">
              Vendas, lucro, margem, produtos, CRM, WhatsApp e email marketing
              em uma visão executiva.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-emerald-700"
          >
            Atualizar BI
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card title="Faturamento hoje" value={money(data.sales.revenueToday)} />
          <Card title="Faturamento mês" value={money(data.sales.revenueMonth)} />
          <Card title="Pedidos hoje" value={data.sales.ordersToday} />
          <Card title="Pedidos mês" value={data.sales.ordersMonth} />
          <Card title="Ticket médio" value={money(data.sales.ticketAverageMonth)} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Custo mês" value={money(data.profit.costMonth)} />
          <Card title="Lucro bruto" value={money(data.profit.grossProfitMonth)} />
          <Card title="Margem bruta" value={percent(data.profit.grossMarginMonth)} />
          <Card
            title="Produto mais lucrativo"
            value={data.profit.mostProfitableProduct?.name || "-"}
          />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Panel title="Vendas por Dia">
            <div className="h-[320px] w-full min-w-0">
              {salesChart.length === 0 ? (
                <Empty text="Nenhuma venda encontrada para gerar gráfico." />
              ) : (
                <ResponsiveContainer width="99%" height={320}>
                  <LineChart data={salesChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => money(Number(value))} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#22c55e"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel title="Top Produtos por Quantidade">
            <div className="h-[320px] w-full min-w-0">
              {topProducts.length === 0 ? (
                <Empty text="Nenhum produto vendido encontrado." />
              ) : (
                <ResponsiveContainer width="99%" height={320}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel title="Lucratividade por Produto">
            {topProducts.length === 0 && (
              <Empty text="Nenhum item vendido encontrado ainda." />
            )}

            <div className="space-y-3">
              {topProducts.map((item: any, index: number) => (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-800 bg-black p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-black">
                        #{index + 1} {item.name}
                      </div>

                      <div className="text-sm text-zinc-500">
                        {item.quantity} unidade(s)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-emerald-400">
                        {money(item.profit)}
                      </div>

                      <div className="text-xs text-zinc-500">
                        margem {percent(item.margin)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Mini title="Receita" value={money(item.revenue)} />
                    <Mini title="Custo" value={money(item.cost)} />
                    <Mini title="Lucro" value={money(item.profit)} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="CRM">
            <div className="grid grid-cols-2 gap-3">
              <Mini title="Leads totais" value={data.crm.leadTotal} />
              <Mini title="Novos" value={data.crm.leadNovo} />
              <Mini title="Responderam" value={data.crm.leadRespondido} />
              <Mini title="Interesse" value={data.crm.leadInteresse} />
              <Mini title="Viraram pedido" value={data.crm.leadPedido} />
              <Mini title="Conversão" value={percent(data.crm.conversionRate)} />
            </div>

            <div className="mt-4 rounded-2xl border border-yellow-900 bg-yellow-950/30 p-4 text-sm text-yellow-300">
              {data.crm.stoppedLeads} lead(s) parados há 2 dias ou mais.
            </div>
          </Panel>

          <Panel title="WhatsApp">
            <div className="grid grid-cols-3 gap-3">
              <Mini title="Enviadas" value={data.whatsapp.sentMessages} />
              <Mini title="Recebidas" value={data.whatsapp.receivedMessages} />
              <Mini title="Conversas" value={data.whatsapp.conversations} />
            </div>
          </Panel>

          <Panel title="Email Marketing">
            <div className="grid grid-cols-2 gap-3">
              <Mini title="Campanhas" value={data.email.campaigns} />
              <Mini title="Destinatários" value={data.email.recipients} />
              <Mini title="Enviados" value={data.email.sent} />
              <Mini title="Erros" value={data.email.errors} />
            </div>
          </Panel>
        </div>

        <Panel title="Insights Inteligentes" className="mt-5">
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300"
              >
                • {item}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="🤖 Chat IA Financeiro" className="mt-5">
  <div className="rounded-3xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/30 via-black to-zinc-950 p-4">
    <p className="text-sm text-zinc-400">
      Pergunte sobre custo, lucro, margem, precificação e produtos.
    </p>

    <div className="mt-4 grid gap-3 md:grid-cols-4">
      {[
        "Qual meu lucro do mês?",
        "Qual produto dá mais margem?",
        "Qual produto devo aumentar preço?",
        "Meu custo está alto?",
      ].map((q) => (
        <button
          key={q}
          onClick={() => setAiQuestion(q)}
          className="rounded-2xl border border-zinc-800 bg-black/80 p-4 text-left text-sm font-bold text-zinc-300 transition hover:border-emerald-500 hover:bg-emerald-950/30 hover:text-emerald-300"
        >
          {q}
        </button>
      ))}
    </div>

    <textarea
      value={aiQuestion}
      onChange={(e) => setAiQuestion(e.target.value)}
      placeholder="Ex: Minha pizza custa R$ 22 para produzir e vendo por R$ 50. Qual meu lucro e margem?"
      className="mt-4 h-32 w-full rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-white outline-none transition focus:border-emerald-500"
    />

    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
      <button
        onClick={askBI}
        disabled={aiLoading}
        className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {aiLoading ? "Analisando..." : "Perguntar para IA"}
      </button>

      <span className="text-xs text-zinc-500">
        A IA usa seus dados do BI e também consegue calcular custos manuais.
      </span>
    </div>

    {aiAnswer && (
      <div className="mt-5 rounded-3xl border border-emerald-800 bg-emerald-950/20 p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-black">
            IA
          </div>

          <div>
            <p className="font-black text-emerald-300">Análise Financeira</p>
            <p className="text-xs text-zinc-500">Resposta baseada nos dados disponíveis</p>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto whitespace-pre-line rounded-2xl bg-black/60 p-4 text-sm leading-relaxed text-emerald-50">
          {aiAnswer}
        </div>
      </div>
    )}
  </div>
</Panel>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg md:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <h2 className="mt-3 truncate text-xl font-black md:text-2xl">{value}</h2>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl md:p-5 ${className}`}
    >
      <h2 className="mb-4 text-lg font-black md:text-xl">{title}</h2>
      {children}
    </div>
  );
}

function Mini({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-zinc-800 bg-black p-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}