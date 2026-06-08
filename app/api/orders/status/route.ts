import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

const allowedStatuses: OrderStatus[] = [
  "NOVO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
];

function normalizeStatus(value: unknown): OrderStatus | null {
  const normalized = String(value ?? "").trim().toUpperCase();

  return allowedStatuses.includes(normalized as OrderStatus)
    ? (normalized as OrderStatus)
    : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const orderId = body?.orderId ? String(body.orderId).trim() : "";
    const status = normalizeStatus(body?.status);

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId é obrigatório" },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: "Status inválido" },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status,
      },
      include: {
        items: true,
        customer: true,
      },
    });

    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error: any) {
    console.error("ERRO AO ATUALIZAR STATUS:", error);

    return NextResponse.json(
      {
        error: "Erro ao atualizar status",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}