import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId } from "@/lib/server-company";

export async function GET(req: NextRequest) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return NextResponse.json({ error: "Empresa não identificada" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();
    const digits = q.replace(/\D/g, "");

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const customers = await prisma.customer.findMany({
      where: {
        company_id: companyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          ...(digits ? [{ whatsapp: { contains: digits } }, { cpf: { contains: digits } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(customers);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar clientes", details: error?.message },
      { status: 500 }
    );
  }
}