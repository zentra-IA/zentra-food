import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID || "41edd938-3eb4-420e-9675-2e53703ed70b";

function resolveCompanyId(req: NextRequest) {
  return req.headers.get("x-company-id") || getCompanyId(req) || DEFAULT_COMPANY_ID;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = await context.params;

    const combo = await prisma.combo.findFirst({
      where: {
        id,
        company_id: companyId,
      },
      include: {
        groups: {
          orderBy: { createdAt: "asc" },
          include: {
            items: {
              orderBy: { createdAt: "asc" },
              include: { product: true },
            },
          },
        },
      },
    });

    if (!combo) {
      return NextResponse.json({ error: "Combo não encontrado" }, { status: 404 });
    }

    return NextResponse.json(combo.groups);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar grupos", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const companyId = resolveCompanyId(req);
    const branchId = getBranchId(req);
    const { id } = await context.params;
    const body = await req.json();

    const combo = await prisma.combo.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!combo) {
      return NextResponse.json({ error: "Combo não encontrado" }, { status: 404 });
    }

    const name = String(body?.name || "").trim();
    const minSelect = Number(body?.minSelect ?? 1);
    const maxSelect = Number(body?.maxSelect ?? 1);
    const required = body?.required === undefined ? true : Boolean(body.required);

    if (!name) {
      return NextResponse.json({ error: "Nome do grupo é obrigatório" }, { status: 400 });
    }

    if (minSelect > maxSelect) {
      return NextResponse.json(
        { error: "O mínimo não pode ser maior que o máximo" },
        { status: 400 }
      );
    }

    const group = await prisma.comboGroup.create({
      data: {
        company_id: companyId,
        branch_id: branchId || combo.branch_id || null,
        comboId: combo.id,
        name,
        required,
        minSelect,
        maxSelect,
      },
    });

    return NextResponse.json({ ...group, items: [] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao criar grupo", details: error.message },
      { status: 500 }
    );
  }
}