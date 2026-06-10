import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

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
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt obrigatório" },
        { status: 400 }
      );
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
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno ao salvar campanha" },
      { status: 500 }
    );
  }
}