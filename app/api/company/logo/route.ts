import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);

    const { data, error } = await supabase
      .from("companies")
      .select("id, logo_url")
      .eq("id", companyId)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logoUrl: data?.logo_url || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao buscar logo" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);
    const formData = await req.formData();

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Arquivo obrigatório" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "png";
    const path = `logos/${companyId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const logoUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        logo_url: logoUrl,
      })
      .eq("id", companyId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      logoUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao enviar logo" },
      { status: 500 }
    );
  }
}