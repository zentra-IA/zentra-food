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

function n(value: any) {
  return Number(value || 0);
}

function isToday(date: any) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();

  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function isThisMonth(date: any) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();

  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function getTable(supabase: any, table: string, companyId: string) {
  if (!companyId) return [];

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("company_id", companyId)
    .limit(10000);

  if (error) {
    console.error(`Erro ao buscar ${table}:`, error.message);
    return [];
  }

  return data || [];
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();

    let companyId = "";

    try {
      const company = requireCompany(req);
      companyId = company.companyId;
    } catch {}

    const month = currentMonth();

    const orders = await getTable(supabase, "Order", companyId);
    const orderItems = await getTable(supabase, "OrderItem", companyId);
    const products = await getTable(supabase, "Product", companyId);
    const leads = await getTable(supabase, "leads", companyId);
    const messages = await getTable(supabase, "messages", companyId);
    const emailCampaigns = await getTable(supabase, "email_campaigns", companyId);
    const emailRecipients = await getTable(supabase, "email_campaign_recipients", companyId);
    const purchases = await getTable(supabase, "purchase_items", companyId);
    const expenses = await getTable(supabase, "business_expenses", companyId);
    const employees = await getTable(supabase, "employees", companyId);

    const ordersToday = orders.filter((o: any) => isToday(o.createdAt || o.created_at));
    const ordersMonth = orders.filter((o: any) => isThisMonth(o.createdAt || o.created_at));

    const revenueToday = ordersToday.reduce((sum: number, order: any) => sum + n(order.total), 0);
    const revenueMonth = ordersMonth.reduce((sum: number, order: any) => sum + n(order.total), 0);
    const revenueTotal = orders.reduce((sum: number, order: any) => sum + n(order.total), 0);

    const ticketAverageMonth = ordersMonth.length ? revenueMonth / ordersMonth.length : 0;
    const orderIdsMonth = new Set(ordersMonth.map((o: any) => o.id));

    let itemsMonth = orderItems.filter((item: any) => {
      if (item.orderId && orderIdsMonth.has(item.orderId)) return true;
      if (item.createdAt && isThisMonth(item.createdAt)) return true;
      if (item.created_at && isThisMonth(item.created_at)) return true;
      return false;
    });

    if (itemsMonth.length === 0) itemsMonth = orderItems;

    const productCostMap: Record<string, number> = {};
    const productNameMap: Record<string, string> = {};

    for (const product of products as any[]) {
      productCostMap[product.id] = n(product.costPrice);
      productNameMap[product.id] = product.name;
    }

    let costProductsMonth = 0;
    let grossProfitMonth = 0;
    const productsMap: Record<string, any> = {};

    for (const item of itemsMonth as any[]) {
      const productId = item.productId || item.product_id;
      const name = item.name || item.product_name || productNameMap[productId] || "Produto sem nome";
      const quantity = n(item.quantity || item.qty || 1);
      const price = n(item.price);
      const revenue = price * quantity;
      const unitCost = productId ? n(productCostMap[productId]) : 0;
      const cost = unitCost * quantity;
      const profit = revenue - cost;

      costProductsMonth += cost;
      grossProfitMonth += profit;

      if (!productsMap[name]) {
        productsMap[name] = { name, quantity: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
      }

      productsMap[name].quantity += quantity;
      productsMap[name].revenue += revenue;
      productsMap[name].cost += cost;
      productsMap[name].profit += profit;
    }

    const topProducts = Object.values(productsMap)
      .map((p: any) => ({
        ...p,
        margin: p.revenue ? (p.profit / p.revenue) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 10);

    const mostProfitableProduct =
      [...topProducts].sort((a: any, b: any) => b.profit - a.profit)[0] || null;

    const lowMarginProduct =
      [...topProducts].filter((p: any) => p.revenue > 0).sort((a: any, b: any) => a.margin - b.margin)[0] || null;

    const grossMarginMonth = revenueMonth ? (grossProfitMonth / revenueMonth) * 100 : 0;

    const purchasesMonth = purchases.filter((p: any) =>
      isThisMonth(p.created_at || p.createdAt || p.due_date)
    );

    const expensesMonth = expenses.filter((e: any) => {
      if (e.reference_month) return e.reference_month === month;
      return isThisMonth(e.created_at || e.createdAt);
    });

    const purchasesCostMonth = purchasesMonth.reduce(
      (sum: number, item: any) => sum + n(item.total_amount),
      0
    );

    const expensesCostMonth = expensesMonth.reduce(
      (sum: number, item: any) => sum + n(item.amount),
      0
    );

    const payrollCostMonth = employees.reduce((sum: number, employee: any) => {
      if (employee.active === false) return sum;
      const salary = n(employee.salary);
      const advance = employee.has_advance ? n(employee.advance_amount) : 0;
      return sum + salary - advance;
    }, 0);

    const totalOperationalCostMonth =
      purchasesCostMonth + expensesCostMonth + payrollCostMonth;

    const netProfitMonth = revenueMonth - totalOperationalCostMonth;
    const netMarginMonth = revenueMonth ? (netProfitMonth / revenueMonth) * 100 : 0;

    const pendingPurchases = purchases.filter((p: any) => !p.paid).length;
    const pendingExpenses = expenses.filter((e: any) => !e.paid).length;

    return NextResponse.json({
      success: true,
      sales: {
        revenueToday,
        revenueMonth,
        revenueTotal,
        ordersToday: ordersToday.length,
        ordersMonth: ordersMonth.length,
        ticketAverageMonth,
        costMonth: costProductsMonth,
        grossProfitMonth,
        grossMarginMonth,
        purchasesCostMonth,
        expensesCostMonth,
        payrollCostMonth,
        totalOperationalCostMonth,
        netProfitMonth,
        netMarginMonth,
      },
      profit: {
        costMonth: costProductsMonth,
        grossProfitMonth,
        grossMarginMonth,
        purchasesCostMonth,
        expensesCostMonth,
        payrollCostMonth,
        totalOperationalCostMonth,
        netProfitMonth,
        netMarginMonth,
        mostProfitableProduct,
        lowMarginProduct,
      },
      finance: {
        month,
        revenueMonth,
        purchasesCostMonth,
        expensesCostMonth,
        payrollCostMonth,
        totalOperationalCostMonth,
        netProfitMonth,
        netMarginMonth,
        pendingPurchases,
        pendingExpenses,
        reminders: [],
      },
      crm: {
        leadTotal: leads.length,
        leadNovo: leads.filter((l: any) => l.status === "novo").length,
        leadRespondido: leads.filter((l: any) => l.status === "respondido").length,
        leadInteresse: leads.filter((l: any) => l.status === "interesse").length,
        leadPedido: leads.filter((l: any) => l.status === "pedido").length,
        conversionRate: leads.length
          ? (leads.filter((l: any) => l.status === "pedido").length / leads.length) * 100
          : 0,
        stoppedLeads: 0,
      },
      whatsapp: {
        sentMessages: messages.filter((m: any) => m.direction === "sent").length,
        receivedMessages: messages.filter((m: any) => m.direction === "received").length,
        conversations: new Set(messages.map((m: any) => m.lead_id)).size,
      },
      email: {
        campaigns: emailCampaigns.length,
        recipients: emailRecipients.length,
        sent: emailRecipients.filter((r: any) => r.status === "sent").length,
        errors: emailRecipients.filter((r: any) => r.status === "error").length,
      },
      topProducts,
    });
  } catch (error: any) {
    console.error("BI OVERVIEW ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao carregar BI",
      },
      { status: 500 }
    );
  }
}