import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase não configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);

    const month = new URL(req.url).searchParams.get("month") || currentMonth();

    const { data, error } = await supabase
      .from("business_expenses")
      .select("*")
      .eq("company_id", companyId)
      .eq("reference_month", month)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, expenses: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao buscar custos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const { data, error } = await supabase
      .from("business_expenses")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        name: body.name,
        type: body.type || "fixed",
        category: body.category || "Outros",
        amount: Number(body.amount || 0),
        due_day: body.due_day ? Number(body.due_day) : null,
        paid: Boolean(body.paid),
        reference_month: body.reference_month || currentMonth(),
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, expense: data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao criar custo" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID obrigatório" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("business_expenses")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao excluir custo" },
      { status: 500 }
    );
  }
}