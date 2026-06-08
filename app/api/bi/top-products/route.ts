import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from("OrderItem")
    .select("*");

  const products: Record<
    string,
    {
      name: string;
      quantity: number;
      revenue: number;
    }
  > = {};

  for (const item of data || []) {
    if (!products[item.name]) {
      products[item.name] = {
        name: item.name,
        quantity: 0,
        revenue: 0,
      };
    }

    products[item.name].quantity +=
      Number(item.quantity || 0);

    products[item.name].revenue +=
      Number(item.price || 0) *
      Number(item.quantity || 0);
  }

  const ranking = Object.values(products)
    .sort(
      (a, b) =>
        b.quantity - a.quantity
    )
    .slice(0, 10);

  return NextResponse.json(ranking);
}