import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";

async function resolveBranchId(req: NextRequest, companyId: string) {
  const cookieBranchId = getBranchId(req);

  if (cookieBranchId) return cookieBranchId;

  const branch = await prisma.branches.findFirst({
    where: { company_id: companyId, active: true },
    select: { id: true },
  });

  if (!branch?.id) {
    throw new Error("Filial padrão não encontrada");
  }

  return branch.id;
}

export async function POST(req: NextRequest) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const branchId = await resolveBranchId(req, companyId);
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const whatsapp = String(body?.whatsapp || "").replace(/\D/g, "");
    const active = body?.active === undefined ? true : Boolean(body.active);

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    if (!whatsapp) {
      return NextResponse.json(
        { error: "WhatsApp é obrigatório" },
        { status: 400 }
      );
    }

    const driver = await prisma.driver.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        name,
        whatsapp,
        active,
      },
    });

    return NextResponse.json(driver, { status: 201 });
  } catch (error: any) {
    console.error("ERRO CREATE DRIVER:", error);

    return NextResponse.json(
      {
        error: "Erro ao criar motoqueiro",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}