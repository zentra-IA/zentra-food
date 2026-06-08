import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";
import { PaymentMethod, OrderStatus } from "@prisma/client";

function generateOrderCode() {
  return `PED-${Date.now()}`;
}

function normalizeBrazilPhone(phone: string) {
  let clean = String(phone || "").replace(/\D/g, "");

  if (!clean) return "";

  if (!clean.startsWith("55")) {
    clean = `55${clean}`;
  }

  return clean;
}

async function resolveBranchId(req: NextRequest, companyId: string) {
  const cookieBranchId = getBranchId(req);

  if (cookieBranchId) return cookieBranchId;

  const branch = await prisma.branches.findFirst({
    where: { company_id: companyId },
    select: { id: true },
  });

  if (!branch?.id) {
    throw new Error("Filial padrão não encontrada");
  }

  return branch.id;
}

function normalizePaymentMethod(value?: string | null): PaymentMethod {
  const payment = String(value || "PIX").trim().toUpperCase();

  if (payment === "PIX") return "PIX";
  if (payment === "DINHEIRO") return "DINHEIRO";
  if (payment === "DEBITO") return "DEBITO";
  if (payment === "CREDITO") return "CREDITO";

  return "PIX";
}

async function sendToCrm({
  companyId,
  branchId,
  name,
  phone,
  email,
  orderCode,
  total,
}: {
  companyId: string;
  branchId: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  orderCode: string;
  total: number;
}) {
  const cleanPhone = normalizeBrazilPhone(String(phone || ""));

  if (!cleanPhone) return null;

  const message = `Pedido ${orderCode} finalizado no valor de R$ ${Number(
    total || 0
  ).toFixed(2)}.`;

  const leadsFound = await prisma.leads.findMany({
    where: {
      company_id: companyId,
      phone: cleanPhone,
    },
    orderBy: {
      created_at: "desc",
    },
  });

  if (leadsFound.length > 0) {
    const mainLead = leadsFound[0];
    const duplicatedLeads = leadsFound.slice(1);

    if (duplicatedLeads.length > 0) {
      await prisma.leads.deleteMany({
        where: {
          id: {
            in: duplicatedLeads.map((lead) => lead.id),
          },
        },
      });
    }

    return prisma.leads.update({
      where: {
        id: mainLead.id,
      },
      data: {
        branch_id: branchId,
        name: name || mainLead.name,
        email: email || mainLead.email,
        phone: cleanPhone,
        status: "finalizado",
        conversation_stage: "finalizado",
        last_message: message,
        last_message_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  return prisma.leads.create({
    data: {
      company_id: companyId,
      branch_id: branchId,
      name: name || "Cliente",
      phone: cleanPhone,
      email: email || null,
      status: "finalizado",
      conversation_stage: "finalizado",
      last_message: message,
      last_message_at: new Date(),
      opening_sent: true,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const companyId =
      getCompanyId(req) ||
      process.env.DEFAULT_COMPANY_ID ||
      "b7336aa2-345d-4624-8141-0ea0de084c3d";

    const branchId = await resolveBranchId(req, companyId);

    const customer = body?.customer || {};
    const items = Array.isArray(body?.items) ? body.items : [];

    const customerName = String(customer?.name || "").trim();
    const customerWhatsapp = normalizeBrazilPhone(
      String(customer?.whatsapp || "")
    );
    const customerEmail = customer?.email ? String(customer.email).trim() : null;
    const customerCep = customer?.cep ? String(customer.cep).trim() : null;

    const fullAddress = [
      customer?.address,
      customer?.number ? `Nº ${customer.number}` : null,
      customer?.complement,
      customer?.neighborhood,
      customer?.city,
    ]
      .filter(Boolean)
      .map((item) => String(item).trim())
      .join(", ");

    if (!customerName) {
      return NextResponse.json(
        { error: "Nome do cliente é obrigatório" },
        { status: 400 }
      );
    }

    if (!customerWhatsapp) {
      return NextResponse.json(
        { error: "WhatsApp é obrigatório" },
        { status: 400 }
      );
    }

    if (!items.length) {
      return NextResponse.json({ error: "Pedido sem itens" }, { status: 400 });
    }

    const totalAmount = Number(body?.totalAmount || 0);
    const paymentMethod = normalizePaymentMethod(body?.paymentMethod);
    const code = generateOrderCode();

    let createdCustomer = await prisma.customer.findFirst({
      where: {
        company_id: companyId,
        whatsapp: customerWhatsapp,
      },
    });

    if (createdCustomer) {
      createdCustomer = await prisma.customer.update({
        where: { id: createdCustomer.id },
        data: {
          branch_id: branchId,
          name: customerName,
          email: customerEmail,
          cep: customerCep,
          address: fullAddress || null,
        },
      });
    } else {
      createdCustomer = await prisma.customer.create({
        data: {
          company_id: companyId,
          branch_id: branchId,
          name: customerName,
          whatsapp: customerWhatsapp,
          email: customerEmail,
          cep: customerCep,
          address: fullAddress || null,
        },
      });
    }

    const order = await prisma.order.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        code,
        customerId: createdCustomer.id,
        paymentMethod,
        total: totalAmount,
        status: "NOVO" as OrderStatus,

        items: {
          create: items.map((item: any) => {
            const rawProductId =
              item?.productId && String(item.productId).trim() !== ""
                ? String(item.productId).trim()
                : null;

            const isSyntheticProduct =
              !rawProductId ||
              rawProductId.startsWith("half-half-") ||
              rawProductId.startsWith("combo-");

            return {
              company_id: companyId,
              branch_id: branchId,
              productId: isSyntheticProduct ? null : rawProductId,
              name: String(item.name || "Produto"),
              price: Number(item.price || 0),
              quantity: Number(item.quantity || 1),
            };
          }),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    await sendToCrm({
      companyId,
      branchId,
      name: customerName,
      phone: customerWhatsapp,
      email: customerEmail,
      orderCode: order.code || code,
      total: order.total,
    });

      return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error("================================");
    console.error("ERRO CREATE ORDER");
    console.error(error);
    console.error("MESSAGE:", error?.message);
    console.error("CODE:", error?.code);
    console.error("META:", error?.meta);
    console.error("================================");

    return NextResponse.json(
      {
        error: "Erro ao criar pedido",
        details: error?.message || String(error),
        code: error?.code || null,
        meta: error?.meta || null,
      },
      { status: 500 }
    );
  }
}