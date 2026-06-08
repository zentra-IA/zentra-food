import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId } from "@/lib/server-company";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const comboInclude = {
  groups: {
    orderBy: { createdAt: "asc" as const },
    include: {
      items: {
        orderBy: { createdAt: "asc" as const },
        include: { product: true },
      },
    },
  },
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const companyId = getCompanyId(req);
    const { id } = await context.params;

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const combo = await prisma.combo.findFirst({
      where: {
        id,
        company_id: companyId,
      },
      include: comboInclude,
    });

    if (!combo) {
      return NextResponse.json(
        { error: "Combo não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(combo);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar combo", details: error?.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const companyId = getCompanyId(req);
    const { id } = await context.params;
    const body = await req.json();

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const existing = await prisma.combo.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Combo não encontrado" },
        { status: 404 }
      );
    }

    const name = String(body?.name || "").trim();
    const description =
      body?.description !== undefined && body?.description !== null
        ? String(body.description).trim()
        : null;

    const price = Number(body?.price ?? 0);
    const imageUrl =
      body?.imageUrl !== undefined && body?.imageUrl !== null
        ? String(body.imageUrl).trim() || null
        : null;

    const active = body?.active === undefined ? true : Boolean(body.active);
    const sortOrder =
      body?.sortOrder === undefined || body?.sortOrder === null
        ? 0
        : Number(body.sortOrder);

    if (!name) {
      return NextResponse.json(
        { error: "Nome do combo é obrigatório" },
        { status: 400 }
      );
    }

    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 });
    }

    let slug = makeSlug(name) || `combo-${Date.now()}`;

    const duplicatedSlug = await prisma.combo.findFirst({
      where: {
        company_id: companyId,
        slug,
        id: {
          not: id,
        },
      },
    });

    if (duplicatedSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const updated = await prisma.combo.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        price,
        imageUrl,
        active,
        sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      },
      include: comboInclude,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao editar combo", details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const companyId = getCompanyId(req);
    const { id } = await context.params;

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const existing = await prisma.combo.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Combo não encontrado" },
        { status: 404 }
      );
    }

    await prisma.combo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao excluir combo", details: error?.message },
      { status: 500 }
    );
  }
}