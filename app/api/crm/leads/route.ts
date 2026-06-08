import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cleanPhone(value: string) {
  let phone = String(value || "").replace(/\D/g, "");

  if (!phone) return "";

  if (!phone.startsWith("55")) {
    phone = `55${phone}`;
  }

  return phone;
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao buscar leads" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = requireCompany(req);

    const body = await req.json();

    const name = String(body?.name || "Contato WhatsApp").trim();
    const phone = cleanPhone(body?.phone || "");
    const email = body?.email ? String(body.email).trim() : null;
    const sessionId = Number(body?.session_id || 1);

    if (!phone) {
      return NextResponse.json(
        { error: "Telefone é obrigatório" },
        { status: 400 }
      );
    }

    const payload = {
      company_id: companyId,
      branch_id: branchId || null,
      name,
      phone,
      email,
      session_id: sessionId,
      status: "novo",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("leads")
      .upsert(payload, {
        onConflict: "company_id,phone",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Erro ao salvar lead",
        code: error?.code || null,
        details: error?.details || null,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID obrigatório" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      deleted: id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir lead" },
      { status: 500 }
    );
  }
}