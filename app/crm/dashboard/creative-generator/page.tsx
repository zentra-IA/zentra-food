"use client";

import { useState } from "react";

type Result = {
  imageUrl: string;
  statusText: string;
  instagramCaption: string;
  whatsappText: string;
  hashtags: string;
};

export default function CreativeGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("story");
  const [theme, setTheme] = useState("Pizza");
  const [style, setStyle] = useState("Chamativo");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function generateCreative() {
    if (!prompt.trim()) {
      alert("Descreva a campanha que você quer criar.");
      return;
    }

    setLoading(true);
    setResult(null);

    const res = await fetch("/api/creative-generator/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        format,
        theme,
        style,
      }),
    });

    const data = await res.json();

    setLoading(false);

    if (!res.ok || !data.success) {
      alert(data.error || "Erro ao gerar criativo.");
      return;
    }

    setResult(data);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    alert("Copiado!");
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold">Gerador de Criativos Food</h1>

        <p className="text-zinc-400 mt-2">
          Gere imagem, legenda, status e texto para campanhas de delivery.
        </p>

        <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="input"
            >
              <option value="story">Story / Status</option>
              <option value="feed">Feed Instagram</option>
              <option value="square">Quadrado Promocional</option>
            </select>

            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="input"
            >
              <option>Pizza</option>
              <option>Hambúrguer</option>
              <option>Combo</option>
              <option>Bebidas</option>
              <option>Açaí</option>
              <option>Delivery</option>
              <option>Promoção Food</option>
              <option>Personalizado</option>
            </select>

            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="input"
            >
              <option>Chamativo</option>
              <option>Premium</option>
              <option>Urgente</option>
              <option>Família</option>
              <option>Jovem</option>
              <option>Minimalista</option>
            </select>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Criar imagem de pizza grande com borda recheada, promoção de hoje, entrega rápida e CTA para pedir no WhatsApp."
            className="w-full h-40 bg-black border border-zinc-700 rounded-2xl p-4 outline-none"
          />

          <button
            onClick={generateCreative}
            disabled={loading}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-6 py-3 rounded-xl font-bold"
          >
            {loading ? "Gerando criativo..." : "Gerar Criativo"}
          </button>
        </section>

        {result && (
          <section className="mt-8 grid lg:grid-cols-2 gap-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-4">Imagem gerada</h2>

              <img
                src={result.imageUrl}
                alt="Criativo gerado"
                className="w-full rounded-2xl border border-zinc-800"
              />
            </div>

            <div className="space-y-4">
              <TextBox
                title="Status WhatsApp"
                text={result.statusText}
                onCopy={() => copy(result.statusText)}
              />

              <TextBox
                title="Legenda Instagram"
                text={result.instagramCaption}
                onCopy={() => copy(result.instagramCaption)}
              />

              <TextBox
                title="Mensagem WhatsApp"
                text={result.whatsappText}
                onCopy={() => copy(result.whatsappText)}
              />

              <TextBox
                title="Hashtags"
                text={result.hashtags}
                onCopy={() => copy(result.hashtags)}
              />
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .input {
          background: #000;
          border: 1px solid #3f3f46;
          border-radius: 14px;
          padding: 12px;
          color: white;
          width: 100%;
        }
      `}</style>
    </main>
  );
}

function TextBox({
  title,
  text,
  onCopy,
}: {
  title: string;
  text: string;
  onCopy: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex justify-between gap-3 mb-3">
        <h3 className="font-bold">{title}</h3>

        <button
          onClick={onCopy}
          className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-lg text-sm"
        >
          Copiar
        </button>
      </div>

      <p className="text-zinc-300 whitespace-pre-line">{text}</p>
    </div>
  );
}