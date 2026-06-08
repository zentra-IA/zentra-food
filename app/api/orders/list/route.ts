import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId } from "@/lib/server-company";

export async function GET(req: NextRequest) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        company_id: companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        customer: true,
        items: true,
        driver: true,
        deliveryBatch: true,
      },
    });

    const normalizedOrders = orders.map((order) => {
      const isPDV = String(order.code || "").startsWith("PDV-");

      return {
        id: order.id,
        code: order.code || `PED-${String(order.id).slice(0, 8)}`,
        total: Number(order.total || 0),
        paymentMethod: order.paymentMethod || "PIX",
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.createdAt,

        driverId: order.driverId || null,
        driverName: order.driver?.name || null,

        deliveryBatchId: order.deliveryBatchId || null,
        deliveryBatchCode: order.deliveryBatch?.code || null,

        archived: false,
        archivedAt: null,
        observation: null,
        changeFor: null,

        channel: isPDV ? "LOJA" : "ONLINE",
        orderType: isPDV ? "LOCAL" : "DELIVERY",

        deliveryRouteOrder: null,
        dispatchedAt: null,

        customer: order.customer
          ? {
              id: order.customer.id,
              name: String(order.customer.name || "").trim(),
              whatsapp: String(order.customer.whatsapp || "").trim(),
              email: order.customer.email || null,
              cpf: order.customer.cpf || null,
              address: String(order.customer.address || "").trim(),
              number: "",
              complement: "",
              neighborhood: "",
              city: "",
              cep: String(order.customer.cep || "").trim(),
            }
          : null,

        items: Array.isArray(order.items)
          ? order.items.map((item) => ({
              id: item.id,
              name: String(item.name || "Produto").trim(),
              price: Number(item.price || 0),
              quantity: Number(item.quantity || 1),
            }))
          : [],
      };
    });

    return NextResponse.json(normalizedOrders, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar pedidos",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}