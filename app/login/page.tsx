"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "Erro ao entrar");
        return;
      }

      router.push("/painel");
    } catch {
      alert("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7f3] px-4 py-6 text-zinc-950">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md items-center justify-center">
        <section className="w-full rounded-[2rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-100/70">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-600 text-3xl shadow-lg shadow-red-200">
              🍕
            </div>

            <p className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
              Zentra Food
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Entrar no painel
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Acesse pedidos, cardápio, PDV e clientes.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">
                E-mail
              </span>

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@email.com"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">
                Senha
              </span>

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <a
              href="/cadastro"
              className="text-sm font-black text-red-600"
            >
              Ainda não tenho conta
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}