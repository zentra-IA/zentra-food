"use client";

import { useState } from "react";

export default function Page() {
  const [batchName, setBatchName] = useState("");
  const [contacts, setContacts] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!contacts.trim()) {
      alert("Cole pelo menos um contato.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/email/import-manual", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchName,
        contacts,
      }),
    });

    const data = await res.json();

    setResult(data);
    setLoading(false);

    if (data.success) {
      alert(`Lote criado com ${data.imported} contatos`);
      setBatchName("");
      setContacts("");
    } else {
      alert(data.error || "Erro ao importar");
    }
  }

  return (
    <div className="p-6 text-white">
      <h1 className="mb-2 text-3xl font-bold">Importar Emails</h1>

      <p className="mb-6 text-zinc-400">
        Cole vários contatos e salve tudo em um lote.
      </p>

      <label className="mb-2 block font-bold">Nome do lote</label>

      <input
        value={batchName}
        onChange={(e) => setBatchName(e.target.value)}
        placeholder="Ex: Clientes FGTS Maio"
        className="mb-4 w-full rounded-xl border border-zinc-700 bg-black p-3"
      />

      <label className="mb-2 block font-bold">Contatos</label>

      <textarea
        className="h-72 w-full rounded-xl border border-zinc-700 bg-black p-3"
        value={contacts}
        onChange={(e) => setContacts(e.target.value)}
        placeholder={`gregory@gmail.com
Gregory, gregory@gmail.com,11999999999
Maria, maria@gmail.com,11988888888`}
      />

      <button
        onClick={send}
        disabled={loading}
        className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-bold disabled:opacity-50"
      >
        {loading ? "Importando..." : "Criar lote"}
      </button>

      {result && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}