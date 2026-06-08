"use client"

import { useEffect, useState } from "react"

export default function MyCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const res = await fetch("/api/email/campaigns/list")
    const data = await res.json()

    setCampaigns(data.campaigns || [])
    setLoading(false)
  }

  async function sendCampaign(campaignId: string) {
    setSendingId(campaignId)

    const res = await fetch("/api/email/campaigns/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    })

    const data = await res.json()

    setSendingId(null)

    alert(data.success ? `Enviados: ${data.sent}` : data.error)

    await load()
  }

  async function editCampaign(campaign: any) {
    const name = prompt("Nome da campanha", campaign.name || "")
    if (name === null) return

    const subject = prompt("Assunto", campaign.subject || "")
    if (subject === null) return

    const res = await fetch("/api/email/campaigns/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        name,
        subject,
        html: campaign.html || "",
      }),
    })

    const data = await res.json()

    alert(data.success ? "Campanha atualizada" : data.error)

    await load()
  }

  async function deleteCampaign(campaignId: string) {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return

    const res = await fetch("/api/email/campaigns/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    })

    const data = await res.json()

    alert(data.success ? "Campanha excluída" : data.error)

    await load()
  }

  if (loading) {
    return <div className="p-6 text-white">Carregando campanhas...</div>
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-4xl font-bold">Minhas Campanhas</h1>

      <p className="text-zinc-400 mt-2 mb-8">
        Campanhas salvas e prontas para envio
      </p>

      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
          >
            <div className="flex justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold">
                  {campaign.name || "Campanha sem nome"}
                </h2>

                <p className="text-zinc-400 mt-1">
                  {campaign.subject || "Sem assunto"}
                </p>

                <p className="text-sm text-zinc-500 mt-3">
                  Criada em:{" "}
                  {new Date(campaign.created_at).toLocaleString("pt-BR")}
                </p>
              </div>

              <div className="text-right space-y-2">
                <p>Total: {campaign.total || 0}</p>
                <p>Enviados: {campaign.sent || 0}</p>
                <p>Status: {campaign.status}</p>

                <button
                  onClick={() => sendCampaign(campaign.id)}
                  disabled={sendingId === campaign.id}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-40 rounded-xl px-5 py-3 font-semibold block w-full"
                >
                  {sendingId === campaign.id
                    ? "Enviando..."
                    : "Enviar campanha"}
                </button>

                <button
                  onClick={() => editCampaign(campaign)}
                  className="bg-yellow-600 hover:bg-yellow-700 rounded-xl px-5 py-3 font-semibold block w-full"
                >
                  Editar
                </button>

                <button
                  onClick={() => deleteCampaign(campaign.id)}
                  className="bg-red-600 hover:bg-red-700 rounded-xl px-5 py-3 font-semibold block w-full"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="text-zinc-500">
            Nenhuma campanha salva ainda.
          </div>
        )}
      </div>
    </div>
  )
}