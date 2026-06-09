import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function onlyDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(req: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    const name = String(body?.name || "").trim();
    const cpf = onlyDigits(body?.cpf);
    const whatsapp = onlyDigits(body?.whatsapp);
    const email = body?.email ? String(body.email).trim() : null;
    const cep = onlyDigits(body?.cep);

    const addressText = String(body?.address || "").trim();
    const numberText = body?.number ? `Nº ${String(body.number).trim()}` : "";
    const complementText = body?.complement
      ? String(body.complement).trim()
      : "";

    const address = [addressText, numberText, complementText]
      .filter(Boolean)
      .join(", ");

    const neighborhood = body?.neighborhood
      ? String(body.neighborhood).trim()
      : null;

    const city = body?.city ? String(body.city).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    if (!whatsapp) {
      return NextResponse.json(
        { error: "WhatsApp é obrigatório" },
        { status: 400 }
      );
    }

    const customerWithSameWhatsapp = await prisma.customer.findFirst({
      where: {
        company_id: existing.company_id,
        whatsapp,
        NOT: { id },
      },
    });

    if (customerWithSameWhatsapp) {
      return NextResponse.json(
        { error: "Já existe outro cliente com esse WhatsApp" },
        { status: 409 }
      );
    }

    if (cpf) {
      const existingCpf = await prisma.customer.findFirst({
        where: {
          company_id: existing.company_id,
          cpf,
          NOT: { id },
        },
      });

      if (existingCpf) {
        return NextResponse.json(
          { error: "Já existe outro cliente com esse CPF" },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        cpf: cpf || null,
        whatsapp,
        email,
        cep: cep || null,
        address: address || null,
        neighborhood,
        city,
      },
    });

    return NextResponse.json(customer, { status: 200 });
  } catch (error: any) {
    console.error("ERRO AO ATUALIZAR CLIENTE:", error);

    return NextResponse.json(
      {
        error: "Erro ao atualizar cliente",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}