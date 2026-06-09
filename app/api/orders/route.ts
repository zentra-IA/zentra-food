import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  observacao: z.string().optional().nullable(),
  totalAmount: z.number().positive(),
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
  const now = new Date();

  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
    now.getSeconds()
  ).padStart(2, "0")}`;

  return `KMCL-${stamp}`;
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
    const body = await req.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados do pedido inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { customer, observacao, totalAmount, items } = parsed.data;
    const paymentMethod = normalizePaymentMethod(parsed.data.paymentMethod);

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
        code: generateOrderCode(),
        customerId: createdCustomer.id,
        paymentMethod,
        status: "NOVO" as OrderStatus,
        archived: false,
        total: totalAmount,
        items: {
          create: items.map((item) => ({
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