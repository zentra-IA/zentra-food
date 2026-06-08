import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const productId = new URL(req.url).searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ success: false, error: "Produto obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("product_ingredients")
      .select("*")
      .eq("company_id", companyId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, ingredients: data || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const { data, error } = await supabase
      .from("product_ingredients")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        product_id: body.productId,
        ingredient_name: body.ingredient_name,
        quantity: Number(body.quantity || 0),
        unit: body.unit || "g",
        cost_per_unit: Number(body.cost_per_unit || 0),
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, ingredient: data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const id = new URL(req.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID obrigatório" }, { status: 400 });
    }

    const { error } = await supabase
      .from("product_ingredients")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}