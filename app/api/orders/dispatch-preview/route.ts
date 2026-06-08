import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import {
  buildDriverWhatsappMessage,
  buildMapsRouteUrl,
  sortOrdersByRouteMode,
  getCleanWhatsapp,
  getMapsAddress,
  DEFAULT_STORE_ADDRESS,
} from "@/lib/delivery";

type RouteMode = "NEAR_TO_FAR" | "FAR_TO_NEAR";

function generateBatchCode() {
  return `LOTE-${Date.now()}`;
}

export async function POST(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const body = await req.json();

    const orderIds = Array.isArray(body?.orderIds)
      ? body.orderIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];

    const driverId = String(body?.driverId || "").trim();

    const routeMode: RouteMode =
      body?.routeMode === "FAR_TO_NEAR" ? "FAR_TO_NEAR" : "NEAR_TO_FAR";

    const storeAddress =
      String(body?.storeAddress || "").trim() || DEFAULT_STORE_ADDRESS;

    if (!orderIds.length) {
      return NextResponse.json(
        { error: "Selecione ao menos um pedido" },
        { status: 400 }
      );
    }

    if (!driverId) {
      return NextResponse.json(
        { error: "Selecione um motoqueiro" },
        { status: 400 }
      );
    }

    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        company_id: companyId,
        active: true,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Motoqueiro não encontrado nesta empresa" },
        { status: 404 }
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        company_id: companyId,
        id: {
          in: orderIds,
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!orders.length) {
      return NextResponse.json(
        { error: "Pedidos não encontrados nesta empresa" },
        { status: 404 }
      );
    }

    const validOrders = orders.filter((order) =>
      Boolean(getMapsAddress(order.customer))
    );

    if (!validOrders.length) {
      return NextResponse.json(
        { error: "Nenhum pedido possui endereço válido para rota" },
        { status: 400 }
      );
    }

    const sortedOrders = sortOrdersByRouteMode(validOrders, routeMode).map(
      (order, index) => ({
        ...order,
        routeOrder: index + 1,
      })
    );

    const mapsUrl = buildMapsRouteUrl({
      storeAddress,
      addresses: sortedOrders.map((order) => getMapsAddress(order.customer)),
    });

    const batchCode = generateBatchCode();

    const whatsappMessage = buildDriverWhatsappMessage({
      driverName: driver.name,
      batchCode,
      mapsUrl,
      orders: sortedOrders.map((order) => ({
        id: order.id,
        code: order.code,
        total: Number(order.total || 0),
        paymentMethod: order.paymentMethod,
        changeFor: null,
        observation: null,
        customer: order.customer,
      })),
    });

    const driverWhatsapp = getCleanWhatsapp(driver.whatsapp);

    const whatsappUrl = driverWhatsapp
      ? `https://wa.me/55${driverWhatsapp}?text=${encodeURIComponent(
          whatsappMessage
        )}`
      : "";

    return NextResponse.json({
      driver: {
        id: driver.id,
        name: driver.name,
        whatsapp: driver.whatsapp,
      },
      batchCode,
      routeMode,
      mapsUrl,
      whatsappMessage,
      whatsappUrl,
      orders: sortedOrders.map((order) => ({
        id: order.id,
        code: order.code || `PED-${String(order.id).slice(0, 8)}`,
        routeOrder: order.routeOrder,
        total: Number(order.total || 0),
        paymentMethod: order.paymentMethod,
        changeFor: null,
        observation: null,
        customer: order.customer,
      })),
    });
  } catch (error: any) {
    console.error("ERRO DISPATCH PREVIEW:", error);

    return NextResponse.json(
      {
        error: "Erro ao gerar preview do despacho",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}