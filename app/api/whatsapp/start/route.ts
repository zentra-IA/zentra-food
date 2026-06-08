import { NextRequest, NextResponse } from "next/server";
import { getCompanyId } from "@/lib/server-company";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID || "41edd938-3eb4-420e-9675-2e53703ed70b";

function resolveCompanyId(req: NextRequest) {
  return (
    req.headers.get("x-company-id") ||
    getCompanyId(req) ||
    DEFAULT_COMPANY_ID
  );
}

function buildSession(companyId: string, sessionId: string) {
  return `${companyId}_${sessionId}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "1");

    const companyId = resolveCompanyId(req);
    const finalSessionId = buildSession(companyId, sessionId);

    const res = await fetch(
      `${WHATSAPP_SERVER}/start/${encodeURIComponent(finalSessionId)}`,
      { method: "POST" }
    );

    const data = await res.json().catch(() => ({}));

    return NextResponse.json({
      ...data,
      sessionId,
      companyId,
      finalSessionId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao iniciar WhatsApp",
      },
      { status: 500 }
    );
  }
}