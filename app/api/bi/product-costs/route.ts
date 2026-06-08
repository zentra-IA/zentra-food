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

    const { data, error } = await supabase
      .from("Product")
      .select("id,name,price,costPrice,active")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, products: data || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const body = await req.json();

    const { error } = await supabase
      .from("Product")
      .update({
        costPrice: Number(body.costPrice || 0),
      })
      .eq("id", body.productId)
      .eq("company_id", companyId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}