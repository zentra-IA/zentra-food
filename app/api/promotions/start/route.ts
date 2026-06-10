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

    const { message, images, whatsappAccounts } = body;

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        message,
        images,
        whatsapp_accounts: whatsappAccounts,
        status: "running",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro interno",
      },
      { status: 500 }
    );
  }
}