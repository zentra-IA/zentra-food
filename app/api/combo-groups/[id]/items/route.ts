import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeItems(items: any[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const group = await prisma.comboGroup.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: { product: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Grupo não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(normalizeItems(group.items));
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar itens", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const group = await prisma.comboGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Grupo não encontrado" },
        { status: 404 }
      );
    }

    const items = Array.isArray(body?.items) ? body.items : [];

    const productIds: string[] = Array.from(
      new Set(
        items
          .map((item: any) => String(item?.productId || "").trim())
          .filter((productId: string) => productId.length > 0)
      )
    );

    if (!productIds.length) {
      await prisma.comboGroupItem.deleteMany({
        where: { comboGroupId: id },
      });

      return NextResponse.json([]);
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        company_id: group.company_id,
      },
      select: {
        id: true,
      },
    });

    const validProductIds: string[] = products.map((product) => product.id);

    if (!validProductIds.length) {
      return NextResponse.json(
        { error: "Nenhum produto válido encontrado" },
        { status: 400 }
      );
    }

    await prisma.comboGroupItem.deleteMany({
      where: {
        comboGroupId: id,
      },
    });

    await prisma.comboGroupItem.createMany({
      data: validProductIds.map((productId) => ({
        company_id: group.company_id,
        branch_id: group.branch_id || null,
        comboGroupId: id,
        productId,
      })),
      skipDuplicates: true,
    });

    const updated = await prisma.comboGroup.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: { product: true },
        },
      },
    });

    return NextResponse.json(updated ? normalizeItems(updated.items) : []);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao salvar itens", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}