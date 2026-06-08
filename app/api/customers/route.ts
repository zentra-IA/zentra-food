import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";

async function resolveBranchId(req: NextRequest, companyId: string) {
  const cookieBranchId = getBranchId(req);

  if (cookieBranchId) return cookieBranchId;

  const branch = await prisma.branches.findFirst({
    where: { company_id: companyId },
    select: { id: true },
  });

  return branch?.id || null;
}
export async function GET(req: NextRequest) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();

    const customers = await prisma.customer.findMany({
      where: {
        company_id: companyId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { whatsapp: { contains: q.replace(/\D/g, "") } },
                { cpf: { contains: q.replace(/\D/g, "") } },
              ],
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return NextResponse.json(customers, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Erro ao buscar clientes",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
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
    const cpf = String(body?.cpf || "").trim();
    const whatsapp = String(body?.whatsapp || "").replace(/\D/g, "").trim();
    const email = body?.email ? String(body.email).trim() : null;
    const cep = body?.cep ? String(body.cep).trim() : null;

    const fullAddress = [
      body?.address,
      body?.number ? `Nº ${body.number}` : null,
      body?.complement,
      body?.neighborhood,
      body?.city,
    ]
      .filter(Boolean)
      .map((item) => String(item).trim())
      .join(", ");

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    if (!whatsapp) {
      return NextResponse.json(
        { error: "WhatsApp é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findFirst({
      where: {
        company_id: companyId,
        whatsapp,
      },
    });

    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          branch_id: branchId,
          name,
          cpf: cpf || null,
          email,
          cep,
          address: fullAddress || null,
        },
      });

      return NextResponse.json(updated, { status: 200 });
    }

    const customer = await prisma.customer.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        name,
        cpf: cpf || null,
        whatsapp,
        email,
        cep,
        address: fullAddress || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error("ERRO AO CRIAR CLIENTE:", error);

    return NextResponse.json(
      {
        error: "Erro ao criar cliente",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}