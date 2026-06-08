import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CategoryType } from "@prisma/client";
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

async function generateUniqueCategorySlug(name: string) {
  const baseSlug = makeSlug(name) || `categoria-${Date.now()}`;

  let slug = baseSlug;
  let count = 1;

  while (true) {
    const exists = await prisma.category.findFirst({
      where: {
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

    const categories = await prisma.category.findMany({
      where: {
        company_id: companyId,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    console.error("ERRO AO BUSCAR CATEGORIAS:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar categorias",
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

    const type: CategoryType =
      body?.type === "PIZZA_HALF_HALF" ? "PIZZA_HALF_HALF" : "NORMAL";

    const selectionRequired =
      body?.selectionRequired === undefined
        ? false
        : Boolean(body.selectionRequired);

    const active = body?.active === undefined ? true : Boolean(body.active);

    const sortOrder =
      body?.sortOrder === undefined || body?.sortOrder === null
        ? 0
        : Number(body.sortOrder);

    if (!name) {
      return NextResponse.json(
        { error: "Nome da categoria é obrigatório" },
        { status: 400 }
      );
    }

    if (Number.isNaN(sortOrder)) {
      return NextResponse.json(
        { error: "Ordem inválida" },
        { status: 400 }
      );
    }

    const slug = await generateUniqueCategorySlug(name);

    const category = await prisma.category.create({
      data: {
        company_id: companyId,
        branch_id: branchId,

        name,
        slug,
        description,
        type,
        selectionRequired,
        active,
        sortOrder,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("ERRO AO CRIAR CATEGORIA:", error);

    return NextResponse.json(
      {
        error: "Erro ao criar categoria",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}