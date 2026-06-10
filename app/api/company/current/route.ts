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
        { success: false, error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name,slug,logo_url,plan_id,active,blocked_reason")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) throw new Error(companyError.message);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Empresa não encontrada", companyId },
        { status: 404 }
      );
    }

    let currentUser: any = null;

    if (userId) {
      const { data: userData } = await supabase
        .from("company_users")
        .select("id,user_id,name,email,phone,role,active")
        .eq("company_id", company.id)
        .eq("user_id", userId)
        .maybeSingle();

      currentUser = userData || null;
    }

    let plan: any = null;
    let features: any[] = [];

    if (company.plan_id) {
      const { data: planData } = await supabase
        .from("plans")
        .select("id,name,active")
        .eq("id", company.plan_id)
        .maybeSingle();

      plan = planData || null;

      const { data: featuresData } = await supabase
        .from("plan_features")
        .select("feature,limit_value,enabled")
        .eq("plan_id", company.plan_id);

      features = featuresData || [];
    }

    const { data: grants } = await supabase
      .from("company_feature_grants")
      .select("*")
      .eq("company_id", company.id)
      .eq("active", true);

    const month = new Date().toISOString().slice(0, 7);

    const { data: radarGrants } = await supabase
      .from("company_radar_grants")
      .select("*")
      .eq("company_id", company.id)
      .eq("month", month)
      .eq("active", true);

    const radarBase =
      features.find((f: any) => f.feature === "radar")?.limit_value || 0;

    const radarExtra = (radarGrants || []).reduce(
      (acc: number, item: any) => acc + Number(item.contacts_extra || 0),
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
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao buscar empresa atual",
      },
      { status: 500 }
    );
  }
}