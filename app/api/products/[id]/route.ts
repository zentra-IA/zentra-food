import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId } from "@/lib/server-company";

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const companyId =
      getCompanyId(req) || "41edd938-3eb4-420e-9675-2e53703ed70b";

    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.product.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const name = String(body?.name ?? "").trim();
    const description = body?.description
      ? String(body.description).trim()
      : null;

    const price = Number(body?.price);

    const rawImageUrl = body?.imageUrl
      ? String(body.imageUrl).trim()
      : "";

    const imageUrl =
      rawImageUrl && !rawImageUrl.startsWith("data:image")
        ? rawImageUrl
        : existing.imageUrl || null;

    const active =
      body?.active === undefined ? true : Boolean(body.active);

    const inStock =
      body?.inStock === undefined ? true : Boolean(body.inStock);

    const sortOrder =
      body?.sortOrder === undefined ? 0 : Number(body.sortOrder);

    if (!name) {
      return NextResponse.json(
        { error: "Nome obrigatório" },
        { status: 400 }
      );
    }

    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: "Preço inválido" },
        { status: 400 }
      );
    }

    let slug = makeSlug(name) || `produto-${Date.now()}`;

    const duplicate = await prisma.product.findFirst({
      where: {
        slug,
        company_id: companyId,
        id: {
          not: id,
        },
      },
    });

    if (duplicate) {
      slug = `${slug}-${Date.now()}`;
    }

    const updated = await prisma.product.update({
      where: {
        id,
      },
      data: {
        name,
        slug,
        description,
        price,
        imageUrl,
        active,
        inStock,
        sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("ERRO PUT PRODUCT:", error);

    return NextResponse.json(
      {
        error: "Erro ao atualizar produto",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const companyId =
      getCompanyId(req) || "41edd938-3eb4-420e-9675-2e53703ed70b";

    const { id } = await context.params;

    const existing = await prisma.product.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    await prisma.product.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("ERRO DELETE PRODUCT:", error);

    return NextResponse.json(
      {
        error: "Erro ao excluir produto",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}