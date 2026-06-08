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
    where: {
      company_id: companyId,
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

async function generateUniqueSlug(companyId: string, name: string) {
  const baseSlug = makeSlug(name) || `additional-${Date.now()}`;
  let slug = baseSlug;
  let count = 1;

  while (true) {
    const exists = await prisma.additional.findFirst({
      where: {
        company_id: companyId,
        slug,
      },
      select: {
        id: true,
      },
    });

    if (!exists) return slug;

    slug = `${baseSlug}-${count}`;
    count++;
  }
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

    const additionals = await prisma.additional.findMany({
      where: {
        company_id: companyId,
      },
      include: {
        categoryLinks: {
          where: {
            company_id: companyId,
          },
          orderBy: {
            createdAt: "asc",
          },
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json(additionals.map(normalizeAdditional), {
      status: 200,
    });
  } catch (error) {
    console.error("ERRO GET ADDITIONALS:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar adicionais",
        details: error instanceof Error ? error.message : String(error),
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
          .map((id) => String(id ?? "").trim())
          .filter(Boolean)
      ),
    ];

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
      return NextResponse.json(
        { error: "Preço inválido" },
        { status: 400 }
      );
    }

    if (Number.isNaN(sortOrder)) {
      return NextResponse.json(
        { error: "Ordem inválida" },
        { status: 400 }
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

    const slug = await generateUniqueSlug(companyId, name);

    const additional = await prisma.additional.create({
      data: {
        company_id: companyId,
        branch_id: branchId,

        name,
        slug,
        description,
        price,
        required,
        active,
        sortOrder,

        categoryLinks: {
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

    return NextResponse.json(normalizeAdditional(additional), {
      status: 201,
    });
  } catch (error) {
    console.error("ERRO POST ADDITIONAL:", error);

    return NextResponse.json(
      {
        error: "Erro ao criar adicional",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}