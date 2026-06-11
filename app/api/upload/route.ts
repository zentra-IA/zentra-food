import { NextRequest, NextResponse } from "next/server";
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

function safeExtension(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";

  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return ext;
  }

  return "jpg";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Envie apenas arquivos de imagem" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "A imagem deve ter no máximo 5MB." },
        { status: 400 }
      );
    }

    const ext = safeExtension(file.name);
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = `products/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("products")
      .getPublicUrl(filePath);

    return NextResponse.json(
      {
        url: data.publicUrl,
        imageUrl: data.publicUrl,
        path: filePath,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Erro ao fazer upload da imagem",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}