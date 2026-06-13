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

function normalizeTriggers(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function autoVariations(text: string, type: string, intent: string) {
  const clean = String(text || "").trim();

  if (!clean) return [];

  if (intent === "PERSONALIDADE" || intent === "FAQ_CUSTOM") {
    return [clean];
  }

  if (type === "ai") {
    return [
      clean,
      clean.replace("Oi", "Olá").replace("tudo bem?", "tudo certo?"),
      clean.replace("Oi", "Opa").replace("posso", "consigo"),
    ]
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index);
  }

  return [
    clean,
    clean.replace("Oi", "Olá").replace("tudo bem?", "tudo certo?"),
    clean.replace("Oi", "Opa").replace("Quer", "Posso"),
    clean.replace("Temos", "Hoje temos").replace("Quer", "Gostaria que eu"),
  ]
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
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

    const triggerKeywords = normalizeTriggers(body.trigger_keywords);
    const matchType = String(body.match_type || "contains");
    const mediaUrl = body.media_url ? String(body.media_url).trim() : null;
    const mediaType = String(body.media_type || "text");
    const kanbanStatus = body.kanban_status
      ? String(body.kanban_status).trim()
      : null;

    if (!name || !baseMessage) {
      return NextResponse.json(
        { error: "Nome e mensagem são obrigatórios" },
        { status: 400 }
      );
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
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const variations = autoVariations(baseMessage, type, intent).map(
      (content) => ({
        company_id: companyId,
        branch_id: branchId || null,
        template_id: template.id,
        content,
        active: true,
      })
    );

    if (variations.length) {
      const { error: variationError } = await supabase
        .from("message_variations")
        .insert(variations);

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
    const { companyId } = requireCompany(req);
    const body = await req.json();

    const id = String(body.id || "");

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.active === "boolean") {
      updatePayload.active = body.active;
    }

    if (body.name !== undefined) {
      updatePayload.name = String(body.name || "").trim();
    }

    if (body.intent !== undefined) {
      updatePayload.intent = String(body.intent || "OPENING");
    }

    if (body.base_message !== undefined) {
      updatePayload.base_message = String(body.base_message || "").trim();
    }

    if (body.trigger_keywords !== undefined) {
      updatePayload.trigger_keywords = normalizeTriggers(body.trigger_keywords);
    }

    if (body.match_type !== undefined) {
      updatePayload.match_type = String(body.match_type || "contains");
    }

    if (body.media_url !== undefined) {
      updatePayload.media_url = body.media_url
        ? String(body.media_url).trim()
        : null;
    }

    if (body.media_type !== undefined) {
      updatePayload.media_type = String(body.media_type || "text");
    }

    if (body.kanban_status !== undefined) {
      updatePayload.kanban_status = body.kanban_status
        ? String(body.kanban_status).trim()
        : null;
    }

    const { error } = await supabase
      .from("message_templates")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

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

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

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