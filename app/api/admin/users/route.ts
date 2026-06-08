import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ROLES = [
  "administrador",
  "gerente",
  "caixa",
  "atendente",
  "entregador",
  "estoque",
  "financeiro",
];

async function getUserLimit(companyId: string) {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("plan_id")
    .eq("id", companyId)
    .single();

  if (!company?.plan_id) return 1;

  const { data: feature } = await supabaseAdmin
    .from("plan_features")
    .select("limit_value")
    .eq("plan_id", company.plan_id)
    .eq("feature", "usuarios")
    .eq("enabled", true)
    .maybeSingle();

  return Number(feature?.limit_value || 1);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
    }

    const { data: users, error } = await supabaseAdmin
      .from("company_users")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();

    const formattedUsers = (users || []).map((user: any) => {
      const authUser = authUsers?.users?.find((u) => u.id === user.user_id);

      return {
        ...user,
        name: user.name || authUser?.user_metadata?.name || "",
        email: user.email || authUser?.email || "",
        phone: user.phone || authUser?.user_metadata?.phone || "",
        role: user.role || authUser?.user_metadata?.role || "atendente",
      };
    });

    const limit = await getUserLimit(companyId);

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      limit,
      used: formattedUsers.filter((u: any) => u.active !== false).length,
      roles: ROLES,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao buscar usuários" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const companyId = String(body.companyId || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "").trim();
    const role = String(body.role || "atendente").trim();

    if (!companyId || !name || !email) {
      return NextResponse.json(
        { error: "Empresa, nome e e-mail são obrigatórios." },
        { status: 400 }
      );
    }

    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    }

    const limit = await getUserLimit(companyId);

    const { count } = await supabaseAdmin
      .from("company_users")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("active", true);

    if ((count || 0) >= limit) {
      return NextResponse.json(
        { error: `Limite do plano atingido. Limite: ${limit} usuário(s).` },
        { status: 403 }
      );
    }

    const { data: alreadyLinked } = await supabaseAdmin
      .from("company_users")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", email)
      .maybeSingle();

    if (alreadyLinked?.id) {
      return NextResponse.json(
        { error: "Este e-mail já está vinculado a esta empresa." },
        { status: 400 }
      );
    }

    const { data: listedUsers, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) throw new Error(listError.message);

    const existingAuthUser = listedUsers.users.find(
      (user) => user.email?.toLowerCase() === email
    );

    let userId = existingAuthUser?.id || "";

    if (!userId) {
      if (!password) {
        return NextResponse.json(
          { error: "Senha é obrigatória para novo usuário." },
          { status: 400 }
        );
      }

      const { data: createdUser, error: userError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, phone, role },
        });

      if (userError) throw new Error(userError.message);

      userId = createdUser.user.id;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { name, phone, role },
      });
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from("company_users")
      .insert({
        company_id: companyId,
        user_id: userId,
        name,
        email,
        phone,
        role,
        active: true,
      })
      .select()
      .single();

    if (linkError) throw new Error(linkError.message);

    return NextResponse.json({ success: true, user: link });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao criar usuário" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const id = String(body.id || "").trim();
    const name = body.name !== undefined ? String(body.name || "").trim() : undefined;
    const email =
      body.email !== undefined
        ? String(body.email || "").trim().toLowerCase()
        : undefined;
    const phone =
      body.phone !== undefined ? String(body.phone || "").trim() : undefined;
    const role =
      body.role !== undefined ? String(body.role || "").trim() : undefined;
    const password =
      body.password !== undefined ? String(body.password || "").trim() : "";

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    if (role && !ROLES.includes(role)) {
      return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    }

    const { data: currentUser, error: findError } = await supabaseAdmin
      .from("company_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (!currentUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("company_users")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    const authUpdate: any = {
      user_metadata: {
        name: name ?? currentUser.name,
        phone: phone ?? currentUser.phone,
        role: role ?? currentUser.role,
      },
    };

    if (email) authUpdate.email = email;
    if (password) authUpdate.password = password;

    if (currentUser.user_id) {
      await supabaseAdmin.auth.admin.updateUserById(
        currentUser.user_id,
        authUpdate
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar usuário" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const { data: link, error: findError } = await supabaseAdmin
      .from("company_users")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (!link) {
      return NextResponse.json({ success: true });
    }

    const { error: deleteLinkError } = await supabaseAdmin
      .from("company_users")
      .delete()
      .eq("id", id);

    if (deleteLinkError) throw new Error(deleteLinkError.message);

    const { count } = await supabaseAdmin
      .from("company_users")
      .select("*", { count: "exact", head: true })
      .eq("user_id", link.user_id);

    if ((count || 0) === 0 && link.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(link.user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao excluir usuário" },
      { status: 500 }
    );
  }
}