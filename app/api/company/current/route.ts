import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID || null;

function resolveCompanyId(req: NextRequest) {
  return (
    req.cookies.get("zentra_company_id")?.value ||
    req.headers.get("x-company-id") ||
    DEFAULT_COMPANY_ID
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const companyId = resolveCompanyId(req);
    const userId = req.cookies.get("zentra_user_id")?.value || null;

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          error: "Empresa não identificada",
        },
        { status: 401 }
      );
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name,slug,logo_url,plan_id,active,blocked_reason")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      throw new Error(companyError.message);
    }

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: "Empresa não encontrada",
          companyId,
        },
        { status: 404 }
      );
    }

    let currentUser: any = null;

    if (userId) {
      const { data: userData, error: userError } = await supabase
        .from("company_users")
        .select("id,user_id,name,email,phone,role,active")
        .eq("company_id", company.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (userError) {
        console.error("Erro ao buscar usuário atual:", userError.message);
      } else {
        currentUser = userData || null;
      }
    }

    let plan: any = null;
    let features: any[] = [];

    if (company.plan_id) {
      const { data: planData, error: planError } = await supabase
        .from("plans")
        .select("id,name,active")
        .eq("id", company.plan_id)
        .maybeSingle();

      if (planError) {
        console.error("Erro ao buscar plano:", planError.message);
      } else {
        plan = planData || null;
      }

      const { data: featuresData, error: featuresError } = await supabase
        .from("plan_features")
        .select("feature,limit_value,enabled")
        .eq("plan_id", company.plan_id);

      if (featuresError) {
        console.error(
          "Erro ao buscar funcionalidades do plano:",
          featuresError.message
        );
      } else {
        features = featuresData || [];
      }
    }

    const { data: grants, error: grantsError } = await supabase
      .from("company_feature_grants")
      .select("*")
      .eq("company_id", company.id)
      .eq("active", true);

    if (grantsError) {
      console.error("Erro ao buscar permissões extras:", grantsError.message);
    }

    const month = new Date().toISOString().slice(0, 7);

    const { data: radarGrants, error: radarError } = await supabase
      .from("company_radar_grants")
      .select("*")
      .eq("company_id", company.id)
      .eq("month", month)
      .eq("active", true);

    if (radarError) {
      console.error("Erro ao buscar créditos extras do radar:", radarError.message);
    }

    const radarBase =
      features.find((feature: any) => feature.feature === "radar")
        ?.limit_value || 0;

    const radarExtra = (radarGrants || []).reduce(
      (total: number, item: any) =>
        total + Number(item.contacts_extra || 0),
      0
    );

    return NextResponse.json({
      success: true,
      company,
      currentUser,
      plan,
      features,
      grants: grants || [],
      radar: {
        month,
        base: Number(radarBase || 0),
        extra: radarExtra,
        total: Number(radarBase || 0) + radarExtra,
      },
    });
  } catch (error: unknown) {
    console.error("Erro ao buscar empresa atual:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar empresa atual",
      },
      { status: 500 }
    );
  }
}
