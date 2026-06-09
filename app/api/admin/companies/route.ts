import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase não configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("companies")
      .select(`
        id,
        name,
        slug,
        active,
        blocked_reason,
        monthly_value,
        due_day,
        payment_method,
        billing_notes,
        plan_id,
        created_at,
        plans (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao buscar empresas" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.plan_id !== undefined) updateData.plan_id = body.plan_id || null;
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    if (body.blocked_reason !== undefined) {
      updateData.blocked_reason =
        String(body.blocked_reason || "").trim() || null;
    }

    if (body.monthly_value !== undefined) {
      updateData.monthly_value = Number(body.monthly_value || 0);
    }

    if (body.due_day !== undefined) {
      const day = Number(body.due_day || 10);
      updateData.due_day = Math.min(31, Math.max(1, day));
    }

    if (body.payment_method !== undefined) {
      updateData.payment_method = String(body.payment_method || "PIX");
    }

    if (body.billing_notes !== undefined) {
      updateData.billing_notes =
        String(body.billing_notes || "").trim() || null;
    }

    const { data, error } = await supabaseAdmin
      .from("companies")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, company: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar empresa" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.rpc("admin_delete_company", {
      target_company: id,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir empresa" },
      { status: 500 }
    );
  }
}