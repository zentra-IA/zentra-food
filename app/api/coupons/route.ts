import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCompanyId } from "@/lib/server-company";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const companyId = getCompanyId(req);

  if (!companyId) {
    return NextResponse.json({ error: "Empresa não identificada" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const companyId = getCompanyId(req);

  if (!companyId) {
    return NextResponse.json({ error: "Empresa não identificada" }, { status: 401 });
  }

  const body = await req.json();

  const code = String(body.code || "").trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      company_id: companyId,
      code,
      name: body.name || null,
      type: body.type || "PERCENT",
      value: Number(body.value || 0),
      min_order: Number(body.min_order || 0),
      max_uses: body.max_uses ? Number(body.max_uses) : null,
      active: body.active ?? true,
      expires_at: body.expires_at || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}