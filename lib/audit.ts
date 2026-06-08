import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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