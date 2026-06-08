import Link from "next/link";

export default function EmailDashboard() {
  const cards = [
    {
      title: "Contas de Envio",
      desc: "Domínio, remetente e Resend",
      href: "/crm/dashboard/email/accounts",
    },
    {
      title: "Importar Emails",
      desc: "Adicionar contatos em massa",
      href: "/crm/dashboard/email/import",
    },
    {
      title: "Contatos",
      desc: "Gerenciar lista",
      href: "/crm/dashboard/email/contacts",
    },
    {
      title: "Campanhas IA",
      desc: "Criar campanha com IA",
      href: "/crm/dashboard/email/campaigns",
    },
    {
      title: "Minhas Campanhas",
      desc: "Ver, enviar e editar campanhas",
      href: "/crm/dashboard/email/my-campaigns",
    },
    {
      title: "Relatórios",
      desc: "Métricas de envio",
      href: "/crm/dashboard/email/analytics",
    },
  ];

  return (
    <div className="p-6 text-white">
      <h1 className="text-4xl font-bold">📧 Email Marketing</h1>

      <p className="mt-2 text-zinc-400">
        Gerencie domínio, contatos, campanhas e relatórios.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-cyan-500 hover:bg-zinc-800"
          >
            <h2 className="font-bold">{card.title}</h2>
            <p className="mt-2 text-sm text-zinc-400">{card.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-lg font-bold">Fluxo correto</h3>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Status title="1. Conta de envio" status="Configurar domínio" />
          <Status title="2. Contatos" status="Importar lista" />
          <Status title="3. Campanha" status="Criar com IA" />
          <Status title="4. Envio" status="Enviar pelo domínio" />
        </div>
      </div>
    </div>
  );
}

function Status({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-4">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-1 font-bold text-cyan-400">{status}</p>
    </div>
  );
}