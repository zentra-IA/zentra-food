import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function getRadarLimit(companyId: string) {
  const supabase = getSupabaseAdmin();

  const { data: company } = await supabase
    .from("companies")
    .select("plan_id")
    .eq("id", companyId)
    .maybeSingle();

  const { data: feature } = await supabase
    .from("plan_features")
    .select("limit_value")
    .eq("plan_id", company?.plan_id)
    .eq("feature", "radar")
    .eq("enabled", true)
    .maybeSingle();

  const baseLimit = Number(feature?.limit_value || 0);
  const now = new Date().toISOString();

  const { data: extras } = await supabase
    .from("company_radar_grants")
    .select("contacts_extra")
    .eq("company_id", companyId)
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  const extraLimit = (extras || []).reduce(
    (acc: number, item: any) => acc + Number(item.contacts_extra || 0),
    0
  );

  return {
    base: baseLimit,
    extra: extraLimit,
    total: baseLimit + extraLimit,
  };
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function getProspectCep(prospect: any) {
  return onlyDigits(
    prospect.cep ||
      prospect.zipCode ||
      prospect.postalCode ||
      prospect.zip ||
      ""
  );
}

function getPhone1(prospect: any) {
  return (
    prospect.phone1 ||
    prospect.phone ||
    prospect.whatsapp ||
    prospect.celular ||
    prospect.mobile ||
    prospect.telefone ||
    prospect.telefone1 ||
    ""
  );
}

function getPhone2(prospect: any) {
  return prospect.phone2 || prospect.telefone2 || prospect.secondaryPhone || "";
}

function sortByCepDistance(prospects: any[], cep: string) {
  if (!cep) return prospects;

  const target = Number(cep);

  return [...prospects].sort((a, b) => {
    const cepA = getProspectCep(a);
    const cepB = getProspectCep(b);

    const distA = cepA
      ? Math.abs(Number(cepA) - target)
      : Number.MAX_SAFE_INTEGER;

    const distB = cepB
      ? Math.abs(Number(cepB) - target)
      : Number.MAX_SAFE_INTEGER;

    return distA - distB;
  });
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const { searchParams } = new URL(req.url);

    const city = searchParams.get("city") || "";
    const name = searchParams.get("name") || "";
    const cep = onlyDigits(searchParams.get("cep") || "");
    const minAge = Number(searchParams.get("minAge") || 18);
    const maxAge = Number(searchParams.get("maxAge") || 100);
    const requestedLimit = Number(searchParams.get("limit") || 100);
    const view = searchParams.get("view") || "NEW";

    const radarLimit = await getRadarLimit(companyId);
    const planLimit = radarLimit.total;
    const clientId = companyId;

    const exports = await prisma.prospectExport.findMany({
      where: { clientId },
      select: { prospectId: true },
    });

    const exportedIds = exports.map((item) => item.prospectId);

    const used = await prisma.prospectExport.count({
      where: { clientId },
    });

    const remaining = Math.max(0, planLimit - used);

    const finalLimit =
      view === "NEW"
        ? Math.max(0, Math.min(requestedLimit, remaining))
        : Math.max(0, Math.min(requestedLimit, planLimit));

    const prospectsRaw = await prisma.prospect.findMany({
      where: {
        active: true,
        age: { gte: minAge, lte: maxAge },
        city: city ? { contains: city, mode: "insensitive" } : undefined,
        name: name ? { contains: name, mode: "insensitive" } : undefined,
        id:
          view === "NEW"
            ? { notIn: exportedIds }
            : view === "REVEALED"
            ? { in: exportedIds }
            : undefined,
      },
      take: Math.max(finalLimit, 1),
    });

    const filteredByCep = cep
      ? prospectsRaw.filter((p: any) =>
          getProspectCep(p).startsWith(cep.slice(0, 5))
        )
      : prospectsRaw;

    const ordered = sortByCepDistance(filteredByCep, cep);

    const prospects = ordered.slice(0, finalLimit).map((p: any) => {
      const revealed = exportedIds.includes(p.id);

      return {
        id: p.id,
        name: p.name,
        age: p.age,
        city: p.city || null,
        cep: getProspectCep(p) || null,
        revealed,
        email: revealed ? p.email || null : null,
        phone1: revealed ? getPhone1(p) || null : null,
        phone2: revealed ? getPhone2(p) || null : null,
      };
    });

    return NextResponse.json({
      success: true,
      prospects,
      available: prospects.length,
      total: prospects.length,
      credits: {
        used,
        remaining,
        base: radarLimit.base,
        extra: radarLimit.extra,
        limit: planLimit,
      },
    });
  } catch (error: any) {
    console.error("ERRO RADAR SEARCH:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao buscar contatos",
      },
      { status: 500 }
    );
  }
}