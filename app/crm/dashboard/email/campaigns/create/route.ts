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

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const name = String(body.name || "").trim();
    const subject = String(body.subject || "").trim();
    const html = String(body.html || "").trim();
    const emailAccountId = String(body.emailAccountId || "").trim();
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];

    if (!name || !subject || !html || !emailAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: "Nome, assunto, mensagem e conta de envio são obrigatórios",
        },
        { status: 400 }
      );
    }

    if (!contacts.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Selecione pelo menos um contato",
        },
        { status: 400 }
      );
    }

    const validContacts = contacts.filter((c: any) => c?.email);

    if (!validContacts.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Nenhum contato com e-mail válido",
        },
        { status: 400 }
      );
    }

    const { data: campaign, error } = await supabase
      .from("email_campaigns")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        email_account_id: emailAccountId,
        name,
        subject,
        html,
        status: "draft",
        total: validContacts.length,
        sent: 0,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;

    const recipients = validContacts.map((c: any) => ({
      campaign_id: campaign.id,
      contact_id: c.id || null,
      email: c.email,
      name: c.nome || c.name || "Sem nome",
      status: "pending",
    }));

    const { error: recipientsError } = await supabase
      .from("email_campaign_recipients")
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    return NextResponse.json({
      success: true,
      campaign,
      recipients: recipients.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: e?.message || "Erro ao criar campanha",
      },
      { status: 500 }
    );
  }
}