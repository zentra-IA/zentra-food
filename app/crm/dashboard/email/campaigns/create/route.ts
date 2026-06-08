import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = requireCompany(req);
    const body = await req.json();

    const name = String(body.name || "").trim();
    const subject = String(body.subject || "").trim();
    const html = String(body.html || "").trim();
    const emailAccountId = String(body.emailAccountId || "").trim();
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];

    if (!name || !subject || !html || !emailAccountId) {
      return NextResponse.json({
        success: false,
        error: "Nome, assunto, mensagem e conta de envio são obrigatórios",
      });
    }

    if (!contacts.length) {
      return NextResponse.json({
        success: false,
        error: "Selecione pelo menos um contato",
      });
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
        total: contacts.length,
        sent: 0,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;

    const recipients = contacts
      .filter((c: any) => c.email)
      .map((c: any) => ({
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
    return NextResponse.json({
      success: false,
      error: e.message || "Erro ao criar campanha",
    });
  }
}