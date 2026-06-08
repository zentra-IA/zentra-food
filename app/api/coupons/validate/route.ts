import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCompanyId } from "@/lib/server-company";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const companyId =
      getCompanyId(req) ||
      process.env.DEFAULT_COMPANY_ID ||
      "b7336aa2-345d-4624-8141-0ea0de084c3d";

    const body = await req.json();

    const code = String(body?.code || "").trim().toUpperCase();
    const subtotal = Number(body?.subtotal || 0);

    if (!code) {
      return NextResponse.json(
        { error: "Informe um cupom" },
        { status: 400 }
      );
    }

    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("company_id", companyId)
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!coupon) {
      return NextResponse.json(
        { error: "Cupom inválido" },
        { status: 404 }
      );
    }

    if (coupon.expires_at) {
      const today = new Date();
      const expiresAt = new Date(coupon.expires_at);

      if (expiresAt < today) {
        return NextResponse.json(
          { error: "Cupom expirado" },
          { status: 400 }
        );
      }
    }

    if (Number(coupon.min_order || 0) > subtotal) {
      return NextResponse.json(
        {
          error: `Pedido mínimo de R$ ${Number(
            coupon.min_order || 0
          ).toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    if (
      coupon.max_uses &&
      Number(coupon.used_count || 0) >= Number(coupon.max_uses)
    ) {
      return NextResponse.json(
        { error: "Cupom atingiu o limite de usos" },
        { status: 400 }
      );
    }

    let discount = 0;

    if (coupon.type === "PERCENT") {
      discount = subtotal * (Number(coupon.value || 0) / 100);
    }

    if (coupon.type === "FIXED") {
      discount = Number(coupon.value || 0);
    }

    discount = Math.min(discount, subtotal);

    return NextResponse.json({
      success: true,
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: Number(coupon.value || 0),
      discount: Number(discount.toFixed(2)),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Erro ao validar cupom",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}