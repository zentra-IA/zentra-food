import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCompanyId, getBranchId } from "@/lib/server-company";
import { PaymentMethod, OrderStatus } from "@prisma/client";
import { z } from "zod";

const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    whatsapp: z.string().min(1),
    address: z.string().min(1),
    number: z.string().min(1),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    cep: z.string().optional().nullable(),
    complement: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
  }),

  paymentMethod: z.string().min(1),

  observation: z.string().optional().nullable(),

  changeFor: z
    .union([z.string(), z.number()])
    .optional()
    .nullable(),

  subtotalAmount: z.number().nonnegative(),
  deliveryFee: z.number().nonnegative().default(0),
  discountValue: z.number().nonnegative().default(0),
  totalAmount: z.number().positive(),

  couponCode: z.string().optional().nullable(),

  items: z
    .array(
      z.object({
        productId: z.string().optional().nullable(),
        name: z.string().min(1),
        price: z.number(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

function generateOrderCode() {
  return `KMCL-${Date.now()}`;
}

function normalizePaymentMethod(value: string): PaymentMethod {
  const paymentMethodRaw = String(value || "PIX").trim().toUpperCase();

  const allowedPaymentMethods: PaymentMethod[] = [
    "PIX",
    "DINHEIRO",
    "DEBITO",
    "CREDITO",
  ];

  return allowedPaymentMethods.includes(paymentMethodRaw as PaymentMethod)
    ? (paymentMethodRaw as PaymentMethod)
    : "PIX";
}

export async function POST(req: NextRequest) {
  try {
   const companyId = getCompanyId(req);
let branchId = getBranchId(req);

if (!companyId) {
  return NextResponse.json(
    { error: "Empresa não identificada" },
    { status: 401 }
  );
}

if (!branchId) {
  const branch = await db.branches.findFirst({
    where: {
      company_id: companyId,
      active: true,
    },
    select: {
      id: true,
    },
  });

  branchId = branch?.id || null;
}

if (!branchId) {
  return NextResponse.json(
    { error: "Nenhuma filial ativa encontrada para esta empresa." },
    { status: 400 }
  );
}


    const body = await req.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados do pedido inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
  customer,
  totalAmount,
  subtotalAmount,
  deliveryFee,
  discountValue,
  observation,
  changeFor,
  items,
} = parsed.data;

const paymentMethod = normalizePaymentMethod(
  parsed.data.paymentMethod
);

const normalizedObservation =
  String(observation || "").trim() || null;

const normalizedChangeFor =
  changeFor !== null &&
  changeFor !== undefined &&
  changeFor !== ""
    ? Number(String(changeFor).replace(",", "."))
    : null;
if (
  normalizedChangeFor !== null &&
  !Number.isFinite(normalizedChangeFor)
) {
  return NextResponse.json(
    { error: "Valor de troco inválido" },
    { status: 400 }
  );
}

    const fullAddress = [
      customer.address,
      customer.number ? `Nº ${customer.number}` : null,
      customer.complement,
      customer.neighborhood,
      customer.city,
    ]
      .filter(Boolean)
      .join(", ");

    const createdCustomer = await db.customer.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        name: customer.name,
        whatsapp: customer.whatsapp,
        email: customer.email || null,
        cep: customer.cep || null,
        address: fullAddress || null,
        neighborhood: customer.neighborhood,
        city: customer.city,
      },
    });

    const order = await db.order.create({
      data: {
        company_id: companyId,
       branch_id: branchId,
        code: generateOrderCode(),
        customerId: createdCustomer.id,
        paymentMethod,
        status: "NOVO" as OrderStatus,
        archived: false,

subtotal: subtotalAmount,
deliveryFee,
discount: discountValue,
total: totalAmount,

changeFor: normalizedChangeFor,
observation: normalizedObservation,
orderType: "DELIVERY",
        items: {
          create: items.map((item) => ({
            company_id: companyId,
            branch_id: branchId,
            productId: item.productId || null,
            name: item.name,
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
          })),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar pedido:", error);

    return NextResponse.json(
      {
        error: "Erro interno ao criar pedido",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}