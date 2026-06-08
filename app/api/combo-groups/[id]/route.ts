import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const group = await prisma.comboGroup.findUnique({
      where: { id },
      include: {
        combo: true,
        items: {
          orderBy: { createdAt: "asc" },
          include: { product: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar grupo", details: error.message },
      { status: 500 }
    );
  }
}