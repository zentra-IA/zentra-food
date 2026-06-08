import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toCsv(rows: any[]) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value: any) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(",")),
  ].join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "companies";

    let table = "";
    let filename = "";

    if (type === "companies") {
      table = "companies";
      filename = "empresas.csv";
    } else if (type === "customers") {
      table = "Customer";
      filename = "clientes.csv";
    } else if (type === "orders") {
      table = "Order";
      filename = "pedidos.csv";
    } else if (type === "products") {
      table = "Product";
      filename = "produtos.csv";
    } else {
      return NextResponse.json(
        { error: "Tipo de backup inválido" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .limit(10000);

    if (error) throw new Error(error.message);

    await auditLog({
      req,
      action: "exportou_backup",
      entity: "backup",
      entityId: type,
      description: `Exportou backup de ${type}`,
      metadata: { type, total: data?.length || 0 },
    });

    const csv = toCsv(data || []);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao exportar backup" },
      { status: 500 }
    );
  }
}