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

    const drivers = await prisma.driver.findMany({
      where: {
        company_id: companyId,
        active: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(drivers, { status: 200 });
  } catch (error: any) {
    console.error("ERRO LIST DRIVERS:", error);

    return NextResponse.json(
      {
        error: "Erro ao listar motoqueiros",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}