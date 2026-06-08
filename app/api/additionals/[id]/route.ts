import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function resolveBranchId(req: NextRequest, companyId: string) {
  const cookieBranchId = getBranchId(req);

  if (cookieBranchId) return cookieBranchId;

  const branch = await prisma.branches.findFirst({
    where: { company_id: companyId },
    select: { id: true },
  });

  return branch?.id || null;
}

function normalizeAdditional(additional: any) {
  const categories = (additional.categoryLinks || [])
    .map((link: any) => link.category)
    .filter(Boolean);

  return {
    id: additional.id,
    name: additional.name,
    slug: additional.slug,
    description: additional.description,
    price: Number(additional.price || 0),
    required: Boolean(additional.required),
    active: Boolean(additional.active),
    sortOrder: Number(additional.sortOrder || 0),
    categories,
    categoryLinks: additional.categoryLinks || [],
    categoryIds: categories.map((category: any) => String(category.id)),
    category: categories[0] || null,
    categoryId: categories[0]?.id || "",
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const branchId = await resolveBranchId(req, companyId);
    const { id } = await context.params;
    const body = await req.json();

    const name = String(body?.name ?? "").trim();

    const description =
      body?.description !== undefined && body?.description !== null
        ? String(body.description).trim()
        : null;

    const price = Number(body?.price);
    const required =
      body?.required === undefined ? false : Boolean(body.required);
    const active = body?.active === undefined ? true : Boolean(body.active);

    const sortOrder =
      body?.sortOrder === undefined || body?.sortOrder === null
        ? 0
        : Number(body.sortOrder);

    const categoryIdsRaw: unknown[] = Array.isArray(body?.categoryIds)
      ? body.categoryIds
      : body?.categoryId
      ? [body.categoryId]
      : [];

    const categoryIds = [
      ...new Set(
        categoryIdsRaw
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      ),
    ];

    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json(
        { error: "Nome do adicional é obrigatório" },
        { status: 400 }
      );
    }

    if (!categoryIds.length) {
      return NextResponse.json(
        { error: "Selecione pelo menos uma categoria" },
        { status: 400 }
      );
    }

    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 });
    }

    const existing = await prisma.additional.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Adicional não encontrado" },
        { status: 404 }
      );
    }

    const categories = await prisma.category.findMany({
      where: {
        id: {
          in: categoryIds,
        },
        company_id: companyId,
      },
      select: {
        id: true,
      },
    });

    if (categories.length !== categoryIds.length) {
      return NextResponse.json(
        { error: "Uma ou mais categorias não foram encontradas" },
        { status: 404 }
      );
    }

    let slug = makeSlug(name) || `additional-${Date.now()}`;

    const duplicate = await prisma.additional.findFirst({
      where: {
        id: {
          not: id,
        },
        company_id: companyId,
        slug,
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      slug = `${slug}-${Date.now()}`;
    }

    const updated = await prisma.additional.update({
      where: {
        id,
      },
      data: {
        name,
        slug,
        description,
        price,
        required,
        active,
        sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,

        categoryLinks: {
          deleteMany: {},
          create: categoryIds.map((categoryId) => ({
            company_id: companyId,
            branch_id: branchId,
            categoryId,
          })),
        },
      },
      include: {
        categoryLinks: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json(normalizeAdditional(updated), { status: 200 });
  } catch (error) {
    console.error("ERRO PUT ADDITIONAL:", error);

    return NextResponse.json(
      {
        error: "Erro ao editar adicional",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.additional.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Adicional não encontrado" },
        { status: 404 }
      );
    }

    await prisma.additional.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("ERRO DELETE ADDITIONAL:", error);

    return NextResponse.json(
      {
        error: "Erro ao excluir adicional",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}