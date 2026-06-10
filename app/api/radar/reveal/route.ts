import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type RadarLimit = {
  base: number;
  extra: number;
  total: number;
};

async function getRadarLimit(companyId: string): Promise<RadarLimit> {
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

function getProspectCep(p: any) {
  return onlyDigits(p.cep || p.zipCode || p.postalCode || p.zip || "");
}

function getPhone1(p: any) {
  return (
    p.phone1 ||
    p.phone ||
    p.whatsapp ||
    p.celular ||
    p.mobile ||
    p.telefone ||
    p.telefone1 ||
    ""
  );
}

function getPhone2(p: any) {
  return p.phone2 || p.telefone2 || p.secondaryPhone || "";
}

async function resolveBranchId(companyId: string, branchId?: string | null) {
  if (branchId) return branchId;

  const branch = await prisma.branches.findFirst({
    where: {
      company_id: companyId,
      active: true,
    },
    select: {
      id: true,
    },
  });

  if (!branch?.id) {
    throw new Error("Nenhuma filial encontrada para esta empresa");
  }

  return branch.id;
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireCompany(req);

    const companyId = auth.companyId;
    const branchId = await resolveBranchId(companyId, auth.branchId);
    const clientId = companyId;

    const radarLimit = await getRadarLimit(companyId);
    const planLimit = radarLimit.total;

    const body = await req.json();

    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids
          .map((id: unknown) => String(id).trim())
          .filter((id: string) => id.length > 0)
      : [];

    if (!ids.length) {
      return NextResponse.json(
        { success: false, error: "Nenhum contato selecionado" },
        { status: 400 }
      );
    }

    const alreadyExported = await prisma.prospectExport.findMany({
      where: {
        clientId,
        prospectId: {
          in: ids,
        },
      },
      select: {
        prospectId: true,
      },
    });

    const alreadyIds = new Set<string>(
      alreadyExported.map((item) => item.prospectId)
    );

    const newIds: string[] = ids.filter((id: string) => !alreadyIds.has(id));

    const usedBefore = await prisma.prospectExport.count({
      where: { clientId },
    });

    const remainingBefore = Math.max(0, planLimit - usedBefore);

    if (newIds.length > remainingBefore) {
      return NextResponse.json(
        {
          success: false,
          error: `Créditos insuficientes. Disponível: ${remainingBefore}`,
          credits: {
            used: usedBefore,
            remaining: remainingBefore,
            base: radarLimit.base,
            extra: radarLimit.extra,
            limit: planLimit,
          },
        },
        { status: 400 }
      );
    }

    for (const prospectId of newIds) {
      try {
        await prisma.prospectExport.create({
          data: {
            company_id: companyId,
            branch_id: branchId,
            clientId,
            prospectId,
            action: "REVEAL",
          },
        });
      } catch (error: any) {
        if (error?.code !== "P2002") {
          throw error;
        }
      }
    }

    const prospectsRaw = await prisma.prospect.findMany({
      where: {
        id: {
          in: ids,
        },
        active: true,
      },
    });

    const usedAfter = await prisma.prospectExport.count({
      where: { clientId },
    });

    const remainingAfter = Math.max(0, planLimit - usedAfter);

    const prospects = prospectsRaw.map((p: any) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      city: p.city || null,
      cep: getProspectCep(p) || null,
      revealed: true,
      email: p.email || null,
      phone1: getPhone1(p) || null,
      phone2: getPhone2(p) || null,
    }));

    return NextResponse.json({
      success: true,
      prospects,
      used: usedAfter,
      remaining: remainingAfter,
      credits: {
        used: usedAfter,
        remaining: remainingAfter,
        base: radarLimit.base,
        extra: radarLimit.extra,
        limit: planLimit,
      },
      newlyRevealed: newIds.length,
      alreadyRevealed: alreadyIds.size,
    });
  } catch (error: any) {
    console.error("ERRO RADAR REVEAL COMPLETO:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao visualizar contatos",
        code: error?.code || null,
        meta: error?.meta || null,
      },
      { status: 500 }
    );
  }
}