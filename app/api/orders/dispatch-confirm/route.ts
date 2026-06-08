import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";
import { RouteMode } from "@prisma/client";

function generateBatchCode() {
  return `LOTE-${Date.now()}`;
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

  return branch?.id || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const companyId =
      getCompanyId(req) ||
      process.env.DEFAULT_COMPANY_ID ||
      "b7336aa2-345d-4624-8141-0ea0de084c3d";

    const branchId = await resolveBranchId(req, companyId);

    const orderIds = Array.isArray(body?.orderIds)
      ? body.orderIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];

    const driverId = String(body?.driverId || "").trim();

    const routeMode: RouteMode =
      body?.routeMode === "FAR_TO_NEAR" ? "FAR_TO_NEAR" : "NEAR_TO_FAR";

    if (!orderIds.length) {
      return NextResponse.json(
        { error: "Selecione ao menos um pedido" },
        { status: 400 }
      );
    }

    if (!driverId) {
      return NextResponse.json(
        { error: "Motoqueiro é obrigatório" },
        { status: 400 }
      );
    }

    const driver = await prisma.driver.findUnique({
      where: {
        id: driverId,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Motoqueiro não encontrado" },
        { status: 404 }
      );
    }

    const finalCompanyId = driver.company_id || companyId;
    const finalBranchId = driver.branch_id || branchId;

    const orders = await prisma.order.findMany({
      where: {
        id: {
          in: orderIds,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!orders.length) {
      return NextResponse.json(
        { error: "Pedidos não encontrados" },
        { status: 404 }
      );
    }

    const batch = await prisma.deliveryBatch.create({
      data: {
        company_id: finalCompanyId,
        branch_id: finalBranchId,
        code: generateBatchCode(),
        routeMode,
        status: "ENVIADO",
        driverId: driver.id,
      },
    });

    await Promise.all(
      orders.map((order) =>
        prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            status: "SAIU_PARA_ENTREGA",
            driverId: driver.id,
            deliveryBatchId: batch.id,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      batchCode: batch.code,
    });
  } catch (error: any) {
    console.error("ERRO DISPATCH CONFIRM:", error);

    return NextResponse.json(
      {
        error: "Erro ao confirmar despacho",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}