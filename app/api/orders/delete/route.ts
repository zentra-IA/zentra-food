import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const orderId = body?.orderId ? String(body.orderId).trim() : "";

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId é obrigatório" },
        { status: 400 }
      );
    }

    await prisma.orderItem.deleteMany({
      where: {
        orderId,
      },
    });

    await prisma.order.delete({
      where: {
        id: orderId,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("ERRO AO EXCLUIR PEDIDO:", error);

    return NextResponse.json(
      {
        error: "Erro ao excluir pedido",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}