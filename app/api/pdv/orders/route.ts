import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId, getBranchId } from "@/lib/server-company";
import { PaymentMethod, OrderStatus } from "@prisma/client";

type IncomingItem = {
  productId?: string | null;
  comboId?: string | null;
  type?: "PRODUCT" | "COMBO" | "HALF_HALF";
  name: string;
  unitPrice: number;
  quantity: number;
};

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBrazilPhone(phone: string) {
  let clean = String(phone || "").replace(/\D/g, "");

  if (!clean) return "";

  if (!clean.startsWith("55")) {
    clean = `55${clean}`;
  }

  return clean;
}

function normalizePaymentMethod(value?: string | null): PaymentMethod {
  const payment = String(value || "").toUpperCase();

  if (payment === "PIX") return "PIX";
  if (payment === "DINHEIRO") return "DINHEIRO";
  if (payment === "DEBITO") return "DEBITO";
  if (payment === "CREDITO") return "CREDITO";

  return "PIX";
}

function generateOrderCode() {
  return `PDV-${Date.now()}`;
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
      name: name || "Cliente PDV",
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

    const items: IncomingItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json({ error: "Pedido sem itens" }, { status: 400 });
    }

    const subtotal = items.reduce(
      (acc, item) =>
        acc + num(item.unitPrice) * Math.max(1, num(item.quantity, 1)),
      0
    );

    const deliveryFee = num(body?.deliveryFee);
    const discount = num(body?.discount);
    const total = Math.max(0, subtotal + deliveryFee - discount);

    const customerBody = body?.customer || {};

    const customerName = String(
      customerBody?.name || body?.customerName || ""
    ).trim();

    const customerPhone = normalizeBrazilPhone(
      String(
        customerBody?.whatsapp ||
          customerBody?.phone ||
          body?.customerPhone ||
          ""
      )
    );

    const customerEmail = customerBody?.email
      ? String(customerBody.email).trim()
      : null;

    let customerId: string | null = body?.customerId
      ? String(body.customerId)
      : null;

    if (!customerId && customerPhone) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          company_id: companyId,
          whatsapp: customerPhone,
        },
      });

      if (existingCustomer) {
        const updatedCustomer = await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            branch_id: branchId,
            name: customerName || existingCustomer.name,
            email: customerEmail || existingCustomer.email,
          },
        });

        customerId = updatedCustomer.id;
      } else {
        const createdCustomer = await prisma.customer.create({
          data: {
            company_id: companyId,
            branch_id: branchId,
            name: customerName || "Cliente PDV",
            whatsapp: customerPhone,
            email: customerEmail,
          },
        });

        customerId = createdCustomer.id;
      }
    }

    const code = generateOrderCode();

    const order = await prisma.order.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        code,
        status: "NOVO" as OrderStatus,
        paymentMethod: normalizePaymentMethod(body?.paymentMethod),
        total,
        customerId,

        items: {
          create: items.map((item) => {
            const rawProductId =
              item?.productId && String(item.productId).trim() !== ""
                ? String(item.productId).trim()
                : null;

            const isSyntheticProduct =
              !rawProductId ||
              rawProductId.startsWith("half-half-") ||
              rawProductId.startsWith("combo-") ||
              item.type === "COMBO" ||
              item.type === "HALF_HALF";

            return {
              company_id: companyId,
              branch_id: branchId,
              productId: isSyntheticProduct ? null : rawProductId,
              name: String(item.name || "Item"),
              price: num(item.unitPrice),
              quantity: Math.max(1, parseInt(String(item.quantity || 1), 10)),
            };
          }),
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    await sendToCrm({
      companyId,
      branchId,
      name: customerName || order.customer?.name,
      phone: customerPhone || order.customer?.whatsapp,
      email: customerEmail || order.customer?.email,
      orderCode: order.code || code,
      total: order.total,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error("ERRO AO CRIAR PEDIDO PDV:", error);

    return NextResponse.json(
      {
        error: "Erro ao salvar pedido",
        details: String(error?.message || "Erro desconhecido"),
      },
      { status: 500 }
    );
  }
}