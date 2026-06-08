import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";

const ALLOWED_INTENTS = [
  "OPENING",
  "REATIVACAO",
  "POS_VENDA",
  "RECUPERACAO",
  "CARDAPIO",
  "PROMOCAO",
  "PEDIDO",
  "ENTREGA",
  "PAGAMENTO",
  "HORARIO",
  "ENDERECO",
];

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const leadId = String(body?.lead_id || "");
    const intent = String(body?.intent || "OPENING");
    const sessionId = Number(body?.session_id || 1);

    if (!leadId) {
      return NextResponse.json(
        { error: "lead_id é obrigatório" },
        { status: 400 }
      );
    }

    if (!ALLOWED_INTENTS.includes(intent)) {
      return NextResponse.json({ error: "Intent inválida" }, { status: 400 });
    }

    const lead = await prisma.leads.findFirst({
      where: {
        id: leadId,
        company_id: companyId,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado nesta empresa" },
        { status: 404 }
      );
    }

    if (!lead.phone) {
      return NextResponse.json(
        { error: "Lead sem telefone" },
        { status: 400 }
      );
    }

    const item = await prisma.automation_queue.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        lead_id: lead.id,
        phone: lead.phone,
        session_id: sessionId,
        type: "campaign",
        status: "pending",
        scheduled_at: new Date(),
        created_at: new Date(),
        attempts: 0,
      },
    });

    await prisma.leads.updateMany({
      where: {
        id: lead.id,
        company_id: companyId,
      },
      data: {
        status: intent === "OPENING" ? "enviado" : "campanha",
        conversation_stage: intent,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error("CRM QUEUE POST:", error);

    return NextResponse.json(
      { error: error.message || "Erro ao adicionar na fila" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const body = await req.json();

    const action = String(body?.action || "");

    if (!["pause", "resume"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const newStatus = action === "pause" ? "paused" : "pending";

    const result = await prisma.automation_queue.updateMany({
      where: {
        company_id: companyId,
        status: action === "pause" ? "pending" : "paused",
      },
      data: {
        status: newStatus,
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error: any) {
    console.error("CRM QUEUE PATCH:", error);

    return NextResponse.json(
      { error: error.message || "Erro ao atualizar fila" },
      { status: 500 }
    );
  }
}