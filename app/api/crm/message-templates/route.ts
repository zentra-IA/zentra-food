import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function normalizeList(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanPhone(value: any) {
  const phone = String(value || "").replace(/\D/g, "");
  if (!phone) return null;
  if (phone.startsWith("55")) return phone;
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;
  return phone;
}

function normalizeFlowMode(value: any) {
  return String(value || "global") === "sequence" ? "sequence" : "global";
}

function nullableNumber(value: any) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function autoVariations(text: string, intent: string) {
  const clean = String(text || "").trim();
  if (!clean) return [];
  if (intent === "PERSONALIDADE" || intent === "FAQ_CUSTOM") return [];

  const variations = [
    clean.replace(/^Oi/i, "Olá"),
    clean.replace(/^Oi/i, "Opa"),
    clean.replace(/^Oi/i, "E aí"),
    clean.replace(/^Olá/i, "Oi"),
    clean.replace(/^Olá/i, "Opa"),
  ];

  return [...new Set(variations.map((v) => v.trim()).filter(Boolean))].filter(
    (item) => item !== clean
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);

    const { data, error } = await supabase
      .from("message_templates")
      .select("*, message_variations(*)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar mensagens" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const type = String(body.type || "ai");
    const name = String(body.name || "").trim();
    const intent = String(body.intent || "OPENING");
    const baseMessage = String(body.base_message || "").trim();
    const triggerKeywords = normalizeList(body.trigger_keywords);
    const manualVariations = normalizeList(body.message_variations);
    const matchType = String(body.match_type || "contains");
    const mediaUrl = body.media_url ? String(body.media_url).trim() : null;
    const mediaType = String(body.media_type || "text");
    const kanbanStatus = body.kanban_status ? String(body.kanban_status).trim() : null;
    const notifyEnabled = Boolean(body.notify_enabled);
    const notifyNumber = cleanPhone(body.notify_number);
    const notifyMessage = String(body.notify_message || "").trim();
    const flowMode = normalizeFlowMode(body.flow_mode);
    const flowStep = flowMode === "sequence" ? nullableNumber(body.flow_step) : null;
    const nextStep = flowMode === "sequence" ? nullableNumber(body.next_step) : null;

    if (!name || !baseMessage) {
      return NextResponse.json({ error: "Nome e mensagem são obrigatórios" }, { status: 400 });
    }

    if (notifyEnabled && !notifyNumber) {
      return NextResponse.json({ error: "Informe o número que receberá a notificação interna." }, { status: 400 });
    }

    if (flowMode === "sequence" && !flowStep) {
      return NextResponse.json({ error: "Informe a etapa atual do fluxo." }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from("message_templates")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        type,
        name,
        intent,
        base_message: baseMessage,
        trigger_keywords: triggerKeywords,
        match_type: matchType,
        media_url: mediaUrl,
        media_type: mediaType,
        kanban_status: kanbanStatus,
        notify_enabled: notifyEnabled,
        notify_number: notifyNumber,
        notify_message: notifyMessage || null,
        flow_mode: flowMode,
        flow_step: flowStep,
        next_step: nextStep,
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const auto = autoVariations(baseMessage, intent);
    const allVariations = [...manualVariations, ...auto]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => item !== baseMessage)
      .filter((item, index, arr) => arr.indexOf(item) === index);

    if (allVariations.length) {
      const { error: variationError } = await supabase
        .from("message_variations")
        .insert(
          allVariations.map((content) => ({
            company_id: companyId,
            branch_id: branchId || null,
            template_id: template.id,
            content,
            active: true,
          }))
        );

      if (variationError) throw new Error(variationError.message);
    }

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao salvar mensagem" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.active === "boolean") updatePayload.active = body.active;
    if (body.name !== undefined) updatePayload.name = String(body.name || "").trim();
    if (body.intent !== undefined) updatePayload.intent = String(body.intent || "OPENING");
    if (body.base_message !== undefined) updatePayload.base_message = String(body.base_message || "").trim();
    if (body.trigger_keywords !== undefined) updatePayload.trigger_keywords = normalizeList(body.trigger_keywords);
    if (body.match_type !== undefined) updatePayload.match_type = String(body.match_type || "contains");
    if (body.media_url !== undefined) updatePayload.media_url = body.media_url ? String(body.media_url).trim() : null;
    if (body.media_type !== undefined) updatePayload.media_type = String(body.media_type || "text");
    if (body.kanban_status !== undefined) updatePayload.kanban_status = body.kanban_status ? String(body.kanban_status).trim() : null;
    if (body.notify_enabled !== undefined) updatePayload.notify_enabled = Boolean(body.notify_enabled);
    if (body.notify_number !== undefined) updatePayload.notify_number = cleanPhone(body.notify_number);
    if (body.notify_message !== undefined) updatePayload.notify_message = String(body.notify_message || "").trim() || null;

    if (body.flow_mode !== undefined) {
      const flowMode = normalizeFlowMode(body.flow_mode);
      updatePayload.flow_mode = flowMode;
      updatePayload.flow_step = flowMode === "sequence" ? nullableNumber(body.flow_step) : null;
      updatePayload.next_step = flowMode === "sequence" ? nullableNumber(body.next_step) : null;

      if (flowMode === "sequence" && !updatePayload.flow_step) {
        return NextResponse.json({ error: "Informe a etapa atual do fluxo." }, { status: 400 });
      }
    } else {
      if (body.flow_step !== undefined) updatePayload.flow_step = nullableNumber(body.flow_step);
      if (body.next_step !== undefined) updatePayload.next_step = nullableNumber(body.next_step);
    }

    const { error } = await supabase
      .from("message_templates")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

    if (body.message_variations !== undefined) {
      const manualVariations = normalizeList(body.message_variations);

      await supabase
        .from("message_variations")
        .delete()
        .eq("template_id", id)
        .eq("company_id", companyId);

      if (manualVariations.length) {
        const { error: variationError } = await supabase
          .from("message_variations")
          .insert(
            manualVariations.map((content) => ({
              company_id: companyId,
              branch_id: branchId || null,
              template_id: id,
              content,
              active: true,
            }))
          );

        if (variationError) throw new Error(variationError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar mensagem" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = requireCompany(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    await supabase
      .from("message_variations")
      .delete()
      .eq("template_id", id)
      .eq("company_id", companyId);

    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir mensagem" },
      { status: 500 }
    );
  }
}
