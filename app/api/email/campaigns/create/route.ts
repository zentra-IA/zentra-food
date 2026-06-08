import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { data: campaign, error } = await supabase
      .from("email_campaigns")
      .insert({
        name: body.name,
        subject: body.subject,
        html: body.html,
        status: "draft",
        total: body.contacts.length,
        sent: 0,
      })
      .select("*")
      .single()

    if (error) throw error

    const recipients = body.contacts.map((c: any) => ({
      campaign_id: campaign.id,
      contact_id: c.id,
      email: c.email,
      name: c.nome || c.name || "Sem nome",
      status: "pending",
    }))

    const { error: recipientsError } = await supabase
      .from("email_campaign_recipients")
      .insert(recipients)

    if (recipientsError) throw recipientsError

    return NextResponse.json({
      success: true,
      campaign,
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
    })
  }
}