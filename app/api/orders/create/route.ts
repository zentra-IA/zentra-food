import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PriceRow = Record<string, any>;

type SearchIntent = {
  normalized: string;
  tokens: string[];
  strategy: "BEST_MATCH" | "CHEAPEST" | "EXPENSIVE";
  product?: "MUCARELA" | "CALABRESA" | "PRESUNTO" | "APRESUNTADO" | "REQUEIJAO" | "CHOCOLATE" | "FARINHA" | "FRANGO";
  brand?: string;
  wantsSpecialMucarela: boolean;
  wantsComAmido: boolean;
  wantsSemAmido: boolean;
};

function isValidUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function normalize(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s.,/%-]/g, " ")
    .replace(/\bmussarelas?\b/g, "mucarela")
    .replace(/\bmucarelas?\b/g, "mucarela")
    .replace(/\bmozarelas?\b/g, "mucarela")
    .replace(/\bmucarelas?\b/g, "mucarela")
    .replace(/\bmuccarelas?\b/g, "mucarela")
    .replace(/\brequeijaoes?\b/g, "requeijao")
    .replace(/\brequeijoes?\b/g, "requeijao")
    .replace(/\bpepperis?\b/g, "peperi")
    .replace(/\bpeperys?\b/g, "peperi")
    .replace(/\btiroles\b/g, "tiroles")
    .replace(/\s+/g, " ")
    .trim();
}

function moneyBR(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function firstValue(...values: any[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function getCatalog(row: PriceRow): Record<string, any> {
  if (row.catalog_product && typeof row.catalog_product === "object") {
    return row.catalog_product;
  }

  return {};
}

function getCode(row: PriceRow): string {
  return String(firstValue(row.code, row.codigo, row.product_code, row.sku, row.id));
}

function getName(row: PriceRow): string {
  const c = getCatalog(row);

  return String(
    firstValue(
      c.official_name,
      c.description_original,
      c.descricao_original,
      c.name,
      c.normalized_name,
      c.product,
      row.official_name,
      row.description_original,
      row.descricao_original,
      row.description,
      row.descricao,
      row.product_name_from_pdf,
      row.product_name,
      row.name,
      row.nome,
      row.normalized_name,
      row.product,
      row.produto,
      row.item,
      row.title,
      row.search_text,
      getCode(row)
    )
  );
}

function getBrand(row: PriceRow): string {
  const c = getCatalog(row);
  return String(firstValue(c.brand, c.marca, row.brand, row.marca));
}

function getCategory(row: PriceRow): string {
  const c = getCatalog(row);
  return String(firstValue(c.category, c.categoria, row.category, row.categoria));
}

function getUnit(row: PriceRow): string {
  const c = getCatalog(row);

  return String(
    firstValue(
      row.sell_unit,
      row.default_sell_unit,
      row.unit,
      row.unidade,
      row.sold_by,
      c.sell_unit,
      c.default_sell_unit,
      c.unit,
      c.unidade,
      c.sold_by,
      c.vende_por,
      "UN"
    )
  ).toUpperCase();
}

function getPrice(row: PriceRow): number {
  const raw = firstValue(
    row.price,
    row.current_price,
    row.preco,
    row.unit_price,
    row.valor,
    row.sale_price,
    row.price_unit,
    row.preco_unitario,
    0
  );

  if (typeof raw === "number") return raw;

  const cleaned = String(raw)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  return Number(cleaned || 0);
}

function getTableDate(rows: PriceRow[]) {
  const row = rows.find(Boolean);
  return String(firstValue(row?.table_date, row?.date, row?.created_at, "Dia atual"));
}

function getHaystack(row: PriceRow): string {
  const c = getCatalog(row);
  const allValues = [
    getCode(row),
    getName(row),
    getBrand(row),
    getCategory(row),
    row.search_text,
    row.normalized_name,
    row.product_name_from_pdf,
    row.product_name,
    row.description,
    row.descricao,
    row.unit,
    row.sell_unit,
    c.search_text,
    c.normalized_name,
    c.product,
    c.brand,
    c.category,
    c.family,
    c.subtype,
    c.line,
    c.flavor,
    c.package,
    c.sold_by,
    ...(Array.isArray(c.aliases) ? c.aliases : []),
    ...(Array.isArray(c.keywords) ? c.keywords : []),
  ];

  return normalize(allValues.filter(Boolean).join(" "));
}

function parseLine(raw: string) {
  const text = normalize(raw);

  const quantityMatch = text.match(/(^|\s)(\d+(?:[,.]\d+)?)/);
  const quantity = quantityMatch ? Number(quantityMatch[2].replace(",", ".")) : 1;

  const discountMatch = text.match(/desconto\s*(?:de)?\s*(\d+(?:[,.]\d+)?)\s*%?/);
  const discountPercent = discountMatch
    ? Number(discountMatch[1].replace(",", "."))
    : 0;

  let quantityUnit: string | null = null;

  const unitRules: Array<[RegExp, string]> = [
    [/\b(kg|quilo|quilos|kilo|kilos)\b/, "KG"],
    [/\b(fardo|fardos|fd)\b/, "FD"],
    [/\b(caixa|caixas|cx)\b/, "CX"],
    [/\b(peca|pecas|pc|pç)\b/, "PÇ"],
    [/\b(pacote|pacotes|pct)\b/, "PCT"],
    [/\b(balde|baldes|bd)\b/, "BD"],
    [/\b(bisnaga|bisnagas|bis)\b/, "BIS"],
    [/\b(lata|latas|lt)\b/, "LT"],
    [/\b(vidro|vidros|vd)\b/, "VD"],
    [/\b(unidade|unidades|un)\b/, "UN"],
  ];

  for (const [regex, unit] of unitRules) {
    if (regex.test(text)) {
      quantityUnit = unit;
      break;
    }
  }

  const searchText = text
    .replace(/desconto\s*(?:de)?\s*\d+(?:[,.]\d+)?\s*%?/g, " ")
    .replace(/^\s*\d+(?:[,.]\d+)?\s*/, " ")
    .replace(/\b(kg|quilo|quilos|kilo|kilos|fardo|fardos|fd|caixa|caixas|cx|peca|pecas|pc|pç|pacote|pacotes|pct|balde|baldes|bd|bisnaga|bisnagas|bis|unidade|unidades|un|lata|latas|lt|vidro|vidros|vd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    raw,
    quantity,
    quantityUnit,
    discountPercent,
    searchText,
  };
}

function tokensOf(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .filter(
      (token) =>
        ![
          "de",
          "da",
          "do",
          "das",
          "dos",
          "com",
          "sem",
          "ao",
          "a",
          "o",
          "e",
          "mais",
          "barato",
          "barata",
          "baratos",
          "baratas",
          "menor",
          "preco",
          "preço",
          "desconto",
        ].includes(token)
    );
}

function detectIntent(query: string): SearchIntent {
  const normalized = normalize(query);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const has = (token: string) => tokens.includes(token);

  const strategy =
    has("barato") ||
    has("barata") ||
    has("baratos") ||
    has("baratas") ||
    normalized.includes("menor preco") ||
    normalized.includes("menor preço")
      ? "CHEAPEST"
      : normalized.includes("mais caro") || normalized.includes("maior preco")
        ? "EXPENSIVE"
        : "BEST_MATCH";

  let product: SearchIntent["product"];

  if (has("mucarela")) product = "MUCARELA";
  else if (has("calabresa")) product = "CALABRESA";
  else if (has("presunto")) product = "PRESUNTO";
  else if (has("apresuntado")) product = "APRESUNTADO";
  else if (has("requeijao")) product = "REQUEIJAO";
  else if (has("chocolate")) product = "CHOCOLATE";
  else if (has("farinha")) product = "FARINHA";
  else if (has("frango")) product = "FRANGO";

  const brands = [
    "imperador",
    "anaconda",
    "coronata",
    "scala",
    "aurora",
    "peperi",
    "tiroles",
    "harald",
    "dalia",
    "frizzo",
    "fleury",
    "piloto",
  ];

  const brand = brands.find(has);

  const wantsSpecialMucarela =
    has("bufala") ||
    has("ralada") ||
    has("bolinha") ||
    has("cobertura") ||
    has("topping") ||
    has("mozzana");

  return {
    normalized,
    tokens,
    strategy,
    product,
    brand,
    wantsSpecialMucarela,
    wantsComAmido: has("com") && has("amido"),
    wantsSemAmido: has("sem") && has("amido"),
  };
}

function passesIntentFilter(intent: SearchIntent, row: PriceRow): boolean {
  const hay = getHaystack(row);

  if (intent.product === "MUCARELA") {
    if (!hay.match(/\bmucarela\b/)) return false;

    if (!intent.wantsSpecialMucarela) {
      if (hay.match(/\b(bufala|ralada|bolinha|cobertura|topping|mozzana)\b/)) {
        return false;
      }
    }
  }

  if (intent.product === "CALABRESA") {
    if (!hay.match(/\bcalabresa\b/)) return false;
    if (hay.match(/\b(pimenta|tempero|molho)\b/)) return false;
  }

  if (intent.product === "PRESUNTO") {
    if (intent.brand === "peperi") {
      if (!hay.match(/\bpeperi\b/)) return false;
      if (hay.match(/\b(parma|dalia)\b/)) return false;
    } else {
      if (!hay.match(/\bpresunto\b/)) return false;
      if (hay.match(/\b(apresuntado|parma)\b/)) return false;
    }
  }

  if (intent.product === "APRESUNTADO") {
    if (!hay.match(/\bapresuntado\b/)) return false;
    if (hay.match(/\bparma\b/)) return false;
  }

  if (intent.product === "REQUEIJAO") {
    if (!hay.match(/\brequeijao\b/)) return false;
    if (intent.wantsSemAmido && !hay.match(/\bsem\b/) && hay.match(/\bcom\b/)) return false;
    if (intent.wantsComAmido && !hay.match(/\bcom\b/)) return false;
  }

  if (intent.product === "CHOCOLATE") {
    if (!hay.match(/\bchocolate\b/)) return false;
  }

  if (intent.product === "FARINHA") {
    if (!hay.match(/\bfarinha\b/)) return false;
  }

  if (intent.product === "FRANGO") {
    if (!hay.match(/\bfrango\b/)) return false;
  }

  if (intent.brand && !hay.match(new RegExp(`\\b${intent.brand}\\b`))) {
    // Marca declarada pelo vendedor é obrigatória, exceto quando não há produto suficiente no catálogo.
    return false;
  }

  return true;
}

function tokenScore(haystack: string, token: string): number {
  const words = haystack.split(/\s+/);

  if (words.some((word) => word === token)) return 40;
  if (words.some((word) => word.length >= 4 && (word.indexOf(token) >= 0 || token.indexOf(word) >= 0))) {
    return 18;
  }

  if (token.length >= 5) {
    for (let i = 0; i < token.length; i++) {
      const reduced = token.slice(0, i) + token.slice(i + 1);
      if (words.some((word) => word.indexOf(reduced) >= 0)) return 10;
    }
  }

  return -8;
}

function scoreRow(query: string, row: PriceRow): { score: number; reasons: string[] } {
  const hay = getHaystack(row);
  const tokens = tokensOf(query);
  const intent = detectIntent(query);
  const reasons: string[] = [];
  let score = 0;

  for (const token of tokens) {
    const value = tokenScore(hay, token);
    score += value;
    if (value > 0) reasons.push(`termo ${token}: +${value}`);
  }

  const matched = reasons.length;
  if (tokens.length && matched === tokens.length) {
    score += 120;
    reasons.push("todos os termos relevantes encontrados");
  }

  if (intent.product === "MUCARELA" && hay.match(/\bmucarela\b/)) score += 160;
  if (intent.product === "CALABRESA" && hay.match(/\bcalabresa\b/)) score += 160;
  if (intent.product === "REQUEIJAO" && hay.match(/\brequeijao\b/)) score += 160;
  if (intent.product === "PRESUNTO" && hay.match(/\bpresunto\b/)) score += 120;
  if (intent.product === "APRESUNTADO" && hay.match(/\bapresuntado\b/)) score += 160;
  if (intent.product === "FARINHA" && hay.match(/\bfarinha\b/)) score += 160;
  if (intent.product === "CHOCOLATE" && hay.match(/\bchocolate\b/)) score += 160;
  if (intent.product === "FRANGO" && hay.match(/\bfrango\b/)) score += 160;

  if (intent.brand && hay.match(new RegExp(`\\b${intent.brand}\\b`))) {
    score += 130;
    reasons.push("marca encontrada");
  }

  const price = getPrice(row);
  if (price > 0) {
    score += 15;
    reasons.push("preço disponível");
  }

  return { score, reasons };
}

function toOption(row: PriceRow, score = 0, reasons: string[] = []) {
  const price = getPrice(row);
  const unit = getUnit(row);
  const name = getName(row);
  const brand = getBrand(row);
  const category = getCategory(row);

  return {
    id: String(firstValue(row.id, getCode(row))),
    code: getCode(row),
    official_name: name,
    product_name_from_pdf: name,
    normalized_name: normalize(name),
    brand: brand || null,
    category: category || null,
    subcategory: firstValue(row.subcategory, getCatalog(row).subcategory, null),
    package_type: firstValue(row.package_type, getCatalog(row).package, null),
    sell_unit: unit,
    default_sell_unit: unit,
    unit,
    price,
    unitPrice: price,
    labelPrice: price ? moneyBR(price) : "",
    labelKg: "",
    labelBox: "",
    score,
    reasons,
  };
}

function searchRows(rows: PriceRow[], query: string, limit = 20) {
  const intent = detectIntent(query);

  const filteredRows = rows.filter((row) => passesIntentFilter(intent, row));
  const baseRows = filteredRows.length > 0 ? filteredRows : rows;

  const scored = baseRows
    .map((row) => {
      const result = scoreRow(query, row);
      return {
        row,
        score: result.score,
        reasons: result.reasons,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (intent.strategy === "CHEAPEST") {
        const priceA = getPrice(a.row) || 999999999;
        const priceB = getPrice(b.row) || 999999999;
        if (priceA !== priceB) return priceA - priceB;
        return b.score - a.score;
      }

      if (intent.strategy === "EXPENSIVE") {
        const priceA = getPrice(a.row) || 0;
        const priceB = getPrice(b.row) || 0;
        if (priceA !== priceB) return priceB - priceA;
        return b.score - a.score;
      }

      return b.score - a.score;
    })
    .slice(0, limit);

  const base = scored.length
    ? scored
    : baseRows
        .filter((row) => getPrice(row) > 0)
        .slice(0, limit)
        .map((row) => ({ row, score: 1, reasons: ["fallback: catálogo disponível"] }));

  return base.map((item) => toOption(item.row, item.score, item.reasons));
}

function formatFinalQuote(params: {
  clientName?: string;
  items: any[];
  total: number;
}) {
  const lines: string[] = [];

  if (params.clientName) {
    lines.push(`Cliente: ${params.clientName}`);
    lines.push("");
  }

  lines.push("COTAÇÃO");
  lines.push("");

  params.items.forEach((item, index) => {
    const subtotalText = moneyBR(item.subtotal);
    const unitText = moneyBR(item.unitPrice);

    lines.push(
      `${index + 1}. ${item.productName} — ${item.quantity} ${item.unit} • Unitário: ${unitText} • Subtotal: ${subtotalText}`
    );
  });

  lines.push("");
  lines.push(`Total: ${moneyBR(params.total)}`);

  return lines.join("\n");
}

async function resolveCompanyId(incomingCompanyId: any) {
  if (isValidUuid(incomingCompanyId)) return String(incomingCompanyId);

  const company = await prisma.companies.findFirst({
    select: { id: true },
    orderBy: { created_at: "asc" },
  });

  return company?.id || null;
}

async function loadPriceRows(companyId: string) {
  return prisma.$queryRawUnsafe<PriceRow[]>(
    `
    select
      qdp.*,
      row_to_json(qcp) as catalog_product
    from quote_daily_prices qdp
    left join quote_catalog_products qcp
      on qcp.company_id = qdp.company_id
      and qcp.code = qdp.code
    where qdp.company_id = $1::uuid
    order by qdp.code asc
    `,
    companyId
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const companyId = await resolveCompanyId(
      body.companyId || body.company_id || body.company?.id || body.company
    );

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Nenhuma empresa encontrada." },
        { status: 400 }
      );
    }

    const rawText = String(
      body.rawText ||
        body.raw_text ||
        body.requestText ||
        body.text ||
        body.query ||
        body.orderText ||
        body.pedido ||
        body.message ||
        body.content ||
        ""
    ).trim();

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: "Informe o pedido para cotar." },
        { status: 400 }
      );
    }

    const rows = await loadPriceRows(companyId);

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Nenhuma tabela de preço carregada. Suba o PDF do dia antes de cotar.",
        },
        { status: 400 }
      );
    }

    const tableDate = getTableDate(rows);

    if (body.searchOnly) {
      const options = searchRows(rows, rawText, Number(body.limit || 80));

      return NextResponse.json({
        success: true,
        mode: "search",
        options,
      });
    }

    if (Array.isArray(body.confirmedItems)) {
      const byCode = new Map(rows.map((row) => [getCode(row), row]));

      const items = body.confirmedItems
        .filter((item: any) => !item.skipped && item.code)
        .map((item: any) => {
          const row = byCode.get(String(item.code));
          const option = row ? toOption(row) : null;
          const quantity = Number(item.quantity || 1);
          const discountPercent = Number(item.discountPercent || 0);
          const unitPrice = option?.price || 0;
          const subtotalRaw = quantity * unitPrice;
          const subtotal = subtotalRaw - subtotalRaw * (discountPercent / 100);

          return {
            raw: item.raw,
            code: item.code,
            productName: option?.official_name || item.raw,
            quantity,
            unit: String(item.quantityUnit || option?.sell_unit || "UN").toUpperCase(),
            unitPrice,
            subtotal,
            discountPercent,
            option,
          };
        });

      const total = items.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);
      const outputText = formatFinalQuote({
        clientName: body.clientName,
        items,
        total,
      });

      return NextResponse.json({
        success: true,
        mode: "final",
        outputText,
        tableDate,
        items,
        total,
        needsReview: false,
      });
    }

    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const candidateGroups = lines.map((line, index) => {
      const parsed = parseLine(line);
      const options = searchRows(rows, parsed.searchText || line, 20);

      return {
        index,
        raw: line,
        parsed,
        quantity: parsed.quantity,
        quantityUnit: parsed.quantityUnit,
        discountPercent: parsed.discountPercent,
        optionCount: options.length,
        discoveryMode: false,
        searchText: parsed.searchText || line,
        selectedCode: options[0]?.code || null,
        skipped: false,
        options,
      };
    });

    return NextResponse.json({
      success: true,
      mode: "confirm",
      tableDate,
      candidateGroups,
      autoItems: [],
      totalCatalogProducts: rows.length,
    });
  } catch (error: any) {
    console.error("QUOTE_GENERATE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao gerar cotação.",
      },
      { status: 500 }
    );
  }
}
