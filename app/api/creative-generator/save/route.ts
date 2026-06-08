import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      prompt,
      image_url,
      status_text,
      instagram_caption,
      hashtags,
      whatsapp_cta,
      theme,
      format,
      style,
      user_id,
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt obrigatório" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("creative_campaigns")
      .insert({
        user_id: user_id || null,
        prompt,
        image_url,
        status_text,
        instagram_caption,
        hashtags,
        whatsapp_cta,
        theme,
        format,
        style,
      })
      .select()
      .single()

    if (error) {
      console.error(error)

      return NextResponse.json(
        { error: "Erro ao salvar campanha" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign: data,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Erro interno ao salvar campanha" },
      { status: 500 }
    )
  }
}