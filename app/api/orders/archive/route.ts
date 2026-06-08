import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await prisma.order.updateMany({
      where: {
        status: "ENTREGUE",
        archived: false,
        updatedAt: {
          lte: fiveMinutesAgo,
        },
      },
      data: {
        archived: true,
        archivedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      archived: result.count,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao arquivar pedidos",
      },
      { status: 500 }
    );
  }
}