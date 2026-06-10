import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function auditLog({
  req,
  companyId = null,
  userId = null,
  action,
  entity,
  entityId = null,
  description = null,
  metadata = {},
}: {
  req?: NextRequest;
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string | null;
  metadata?: any;
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const ip =
      req?.headers.get("x-forwarded-for") ||
      req?.headers.get("x-real-ip") ||
      null;

    await supabaseAdmin.from("audit_logs").insert({
      company_id: companyId,
      user_id: userId,
      action,
      entity,
      entity_id: entityId,
      description,
      metadata,
      ip,
    });
  } catch (error) {
    console.log("AUDIT LOG ERROR:", error);
  }
}