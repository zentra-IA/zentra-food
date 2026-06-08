import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json()

  await supabase.from("email_events").insert({
    email: body?.data?.to?.[0] || body?.data?.email || null,
    event: body?.type || "unknown",
    resend_id: body?.data?.email_id || body?.data?.id || null,
  })

  return NextResponse.json({ ok: true })
}