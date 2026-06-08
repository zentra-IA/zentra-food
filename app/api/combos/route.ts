import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";

function resolveCompanyId(req: NextRequest) {
  return req.headers.get("x-company-id") || getCompanyId(req);
}

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function resolveBranchId(
  req: NextRequest,
  companyId: string
) {
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

  return branch?.id || null;
}

async function generateUniqueSlug(
  companyId: string,
  name: string
) {
  const baseSlug = makeSlug(name) || `combo-${Date.now()}`;

  let slug = baseSlug;
  let count = 1;

  while (true) {
    const exists = await prisma.combo.findFirst({
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

const comboInclude = {
  groups: {
    orderBy: {
      createdAt: "asc" as const,
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc" as const,
        },
        include: {
          product: true,
        },
      },
    },
  },
};

export async function GET(req: NextRequest) {
  try {
    const companyId = resolveCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        {
          error: "Empresa não identificada",
        },
        {
          status: 401,
        }
      );
    }

    const combos = await prisma.combo.findMany({
      where: {
        company_id: companyId,
        active: true,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      include: comboInclude,
    });

    return NextResponse.json(combos);
  } catch (error: any) {
    console.error("ERRO GET COMBOS:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar combos",
        details: error?.message || String(error),
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const companyId = resolveCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        {
          error: "Empresa não identificada",
        },
        {
          status: 401,
        }
      );
    }

    const branchId = await resolveBranchId(
      req,
      companyId
    );

    const body = await req.json();

    const name = String(body?.name || "").trim();

    const description = body?.description
      ? String(body.description).trim()
      : null;

    const price = Number(body?.price);

    const imageUrl = body?.imageUrl
      ? String(body.imageUrl).trim()
      : null;

    const active =
      body?.active === undefined
        ? true
        : Boolean(body.active);

    const sortOrder =
      body?.sortOrder === undefined
        ? 0
        : Number(body.sortOrder);

    if (!name) {
      return NextResponse.json(
        {
          error: "Nome é obrigatório",
        },
        {
          status: 400,
        }
      );
    }

    const slug = await generateUniqueSlug(
      companyId,
      name
    );

    const combo = await prisma.combo.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        name,
        slug,
        description,
        price,
        imageUrl,
        active,
        sortOrder,
      },
      include: comboInclude,
    });

    return NextResponse.json(combo, {
      status: 201,
    });
  } catch (error: any) {
    console.error("ERRO POST COMBO:", error);

    return NextResponse.json(
      {
        error: "Erro ao criar combo",
        details: error?.message || String(error),
      },
      {
        status: 500,
      }
    );
  }
}