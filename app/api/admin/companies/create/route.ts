import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("id,name")
    .eq("active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const restaurantName = String(body.restaurantName || "").trim();
    const ownerName = String(body.ownerName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const whatsapp = String(body.whatsapp || "").trim();
    const phone = String(body.phone || "").trim();
    const extraContact = String(body.extraContact || "").trim();
    const document = String(body.document || "").trim();
    const planId = String(body.planId || "").trim();

    if (!restaurantName || !ownerName || !email || !password || !planId) {
      return NextResponse.json(
        { error: "Preencha empresa, responsável, e-mail, senha e plano." },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: ownerName,
          restaurant_name: restaurantName,
        },
      });

    if (userError) throw new Error(userError.message);

    const userId = userData.user.id;
    const baseSlug = slugify(restaurantName) || `empresa-${Date.now()}`;

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: restaurantName,
        slug: `${baseSlug}-${Date.now()}`,
        plan_id: planId,
        active: true,
      })
      .select()
      .single();

    if (companyError) throw new Error(companyError.message);

    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .insert({
        company_id: company.id,
        name: "Matriz",
        slug: "matriz",
        active: true,
      })
      .select()
      .single();

    if (branchError) throw new Error(branchError.message);

    const { error: companyUserError } = await supabaseAdmin
      .from("company_users")
      .insert({
        company_id: company.id,
        user_id: userId,
        role: "administrador",
      });

    if (companyUserError) throw new Error(companyUserError.message);

    const { error: contactError } = await supabaseAdmin
      .from("company_contacts")
      .insert({
        company_id: company.id,
        restaurant_name: restaurantName,
        document,
        owner_name: ownerName,
        phone,
        whatsapp,
        email,
        extra_contact: extraContact,
      });

    if (contactError) throw new Error(contactError.message);

    return NextResponse.json({
      success: true,
      company,
      branch,
      user: {
        id: userId,
        email,
      },
    });
const defaultTemplates = [
  {
    type: "campaign",
    intent: "OPENING",
    name: "Abertura padrão",
    base_message:
      "Olá {nome}, tudo bem? 😊\n\nPassando para te mostrar uma novidade especial de hoje.\n\nPosso te enviar nosso cardápio?",
  },
  {
    type: "campaign",
    intent: "REATIVACAO",
    name: "Reativação padrão",
    base_message:
      "Oi {nome}, tudo bem?\n\nFaz um tempinho que você não pede com a gente.\n\nHoje temos opções especiais. Quer ver?",
  },
  {
    type: "campaign",
    intent: "POS_VENDA",
    name: "Pós-venda padrão",
    base_message:
      "Oi {nome}, tudo certo? 😊\n\nSeu pedido chegou certinho?\n\nSua opinião ajuda muito a gente melhorar.",
  },
  {
    type: "campaign",
    intent: "RECUPERACAO",
    name: "Recuperação padrão",
    base_message:
      "Oi {nome}, vi que você começou um pedido.\n\nPosso te ajudar a finalizar?",
  },
];

for (const template of defaultTemplates) {
  const { data: createdTemplate, error: templateError } = await supabaseAdmin
    .from("message_templates")
    .insert({
      company_id: company.id,
      branch_id: branch.id,
      type: template.type,
      intent: template.intent,
      name: template.name,
      base_message: template.base_message,
      active: true,
    })
    .select()
    .single();

  if (templateError) {
  throw new Error(templateError.message || "Erro ao criar mensagens padrão");
}

  await supabaseAdmin.from("message_variations").insert({
    company_id: company.id,
    branch_id: branch.id,
    template_id: createdTemplate.id,
    content: template.base_message,
    active: true,
  });
}
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Erro ao criar empresa",
      },
      { status: 500 }
    );
  }
}