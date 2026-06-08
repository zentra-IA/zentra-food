import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";

const ALLOWED_STATUSES = [
  "novo",
  "enviado",
  "respondido",
  "interesse",
  "pedido",
  "campanha",
  "reativar_futuro",
  "finalizado",
  "sem_interesse",
];

export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);

    const body = await req.json();

    const id = String(body?.id || "");
    const status = String(body?.status || "");

    if (!id) {
      return NextResponse.json(
        { error: "ID do lead é obrigatório" },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Status inválido" },
        { status: 400 }
      );
    }

    const result = await prisma.leads.updateMany({
      where: {
        id,
        company_id: companyId,
      },
      data: {
        status,
        updated_at: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Lead não encontrado para esta empresa" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("CRM LEADS STATUS PATCH:", error);

    return NextResponse.json(
      { error: error.message || "Erro ao atualizar status" },
      { status: 500 }
    );
  }
}