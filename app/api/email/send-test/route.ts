import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { companyId } = requireCompany(req);
    const body = await req.json();

    const to = String(body.to || "").trim();
    const accountId = String(body.accountId || "").trim();

    if (!to) {
      return NextResponse.json({
        success: false,
        error: "Email de destino obrigatório",
      });
    }

    const query = supabase
      .from("email_accounts")
      .select("*")
      .eq("company_id", companyId)
      .eq("active", true);

    const { data: account, error } = accountId
      ? await query.eq("id", accountId).maybeSingle()
      : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (error || !account) {
      return NextResponse.json({
        success: false,
        error: "Conta de email ativa não encontrada",
      });
    }

    if (!account.api_key) {
      return NextResponse.json({
        success: false,
        error: "Conta sem API Key Resend",
      });
    }

    const resend = new Resend(account.api_key);

    const result = await resend.emails.send({
      from: account.from_name
        ? `${account.from_name} <${account.from_email}>`
        : account.from_email,
      to,
      subject: body.subject || "Email de teste",
      html: body.html || "<p>Email de teste enviado pelo Zentra.</p>",
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message || "Erro ao enviar teste",
    });
  }
}