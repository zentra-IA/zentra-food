import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos" },
        { status: 401 }
      );
    }

    const { data: companyUser, error: companyError } = await supabase
      .from("company_users")
      .select("company_id, role, active")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (companyError || !companyUser?.company_id) {
      return NextResponse.json(
        { error: "Usuário não está vinculado a nenhuma empresa" },
        { status: 403 }
      );
    }

    if (companyUser.active === false) {
      return NextResponse.json(
        { error: "Usuário pausado. Entre em contato com o administrador." },
        { status: 403 }
      );
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id, name, active, blocked_reason")
      .eq("id", companyUser.company_id)
      .single();

    if (!company?.active) {
      return NextResponse.json(
        {
          error:
            company?.blocked_reason ||
            "Empresa pausada. Entre em contato com o suporte.",
        },
        { status: 403 }
      );
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("company_id", companyUser.company_id)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const role = companyUser.role || "atendente";

    const response = NextResponse.json({
      success: true,
      user: data.user,
      company_id: companyUser.company_id,
      branch_id: branch?.id || null,
      role,
    });

    response.cookies.set("zentra_user_id", data.user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set("zentra_company_id", companyUser.company_id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set("zentra_user_role", role, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    if (branch?.id) {
      response.cookies.set("zentra_branch_id", branch.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (error: any) {
    console.error("ERRO LOGIN:", error);

    return NextResponse.json(
      { error: "Erro ao fazer login" },
      { status: 500 }
    );
  }
}