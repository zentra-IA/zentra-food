"use client";

import { useEffect, useState } from "react";

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [domain, setDomain] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAccounts() {
    const res = await fetch("/api/email/accounts", {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || "Erro ao carregar contas");
      return;
    }

    setAccounts(data.accounts || []);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function saveAccount() {
    if (!domain.trim() || !fromEmail.trim()) {
      alert("Domínio e e-mail remetente são obrigatórios.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/email/accounts", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain,
        from_email: fromEmail,
        from_name: fromName,
        api_key: apiKey,
      }),
    });

    const data = await res.json();

    setLoading(false);

    if (!res.ok || !data.success) {
      alert(data.error || "Erro ao salvar conta");
      return;
    }

    setDomain("");
    setFromEmail("");
    setFromName("");
    setApiKey("");

    await loadAccounts();

    alert("Conta de envio salva.");
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 to-cyan-950 p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            Email Marketing
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-5xl">
            Contas de envio
          </h1>

          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Configure o domínio, remetente e chave Resend de cada empresa.
          </p>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Nova conta</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Domínio. Ex: pizzariadojoao.com.br"
              className="input"
            />

            <input
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="E-mail remetente. Ex: contato@dominio.com.br"
              className="input"
            />

            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Nome remetente. Ex: Pizzaria do João"
              className="input"
            />

            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Resend API Key"
              type="password"
              className="input"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            Na V1, o cliente informa o domínio e o e-mail. Você valida o domínio
            no Resend e cola a API Key aqui.
          </div>

          <button
            onClick={saveAccount}
            disabled={loading}
            className="mt-4 rounded-2xl bg-cyan-600 px-5 py-4 text-sm font-black text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar conta"}
          </button>
        </section>

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Contas cadastradas</h2>

          <div className="mt-4 grid gap-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-zinc-800 bg-black p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-black">
                      {account.from_name || account.from_email}
                    </div>

                    <div className="text-sm text-zinc-400">
                      {account.from_email}
                    </div>

                    <div className="text-sm text-zinc-500">
                      {account.domain}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-300">
                      {account.provider}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 ${
                        account.active
                          ? "bg-green-950 text-green-400"
                          : "bg-yellow-950 text-yellow-400"
                      }`}
                    >
                      {account.active ? "Ativa" : "Pendente"}
                    </span>

                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-400">
                      {account.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {!accounts.length && (
              <div className="rounded-2xl border border-zinc-800 bg-black p-6 text-center text-zinc-500">
                Nenhuma conta cadastrada ainda.
              </div>
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
          padding: 13px 14px;
          color: white;
          outline: none;
          font-size: 14px;
        }

        .input:focus {
          border-color: #06b6d4;
          box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.14);
        }
      `}</style>
    </main>
  );
}