import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function imageSize(format: string) {
  if (format === "story") return "1024x1536";
  if (format === "feed") return "1536x1024";
  return "1024x1024";
}

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY || process.env.OPENAI_SUPPORT_KEY;

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY ausente",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const {
      prompt,
      theme = "Pizza",
      style = "Chamativo",
      format = "story",
    } = body;

    const textPrompt = `
Você é um especialista em marketing para pizzaria, hamburgueria, açaí e delivery.

Crie conteúdo persuasivo.

Tema:
${theme}

Estilo:
${style}

Pedido:
${prompt}

Retorne JSON:
{
 "statusText":"",
 "instagramCaption":"",
 "whatsappText":"",
 "hashtags":""
}
`;

    const textRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: textPrompt }],
        temperature: 0.8,
      }),
    });

    const textData = await textRes.json();

    if (!textRes.ok) {
      throw new Error(textData?.error?.message || "Erro texto");
    }

    const raw = textData?.choices?.[0]?.message?.content || "{}";

    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        statusText: raw,
        instagramCaption: raw,
        whatsappText: raw,
        hashtags: "#pizza #food #delivery",
      };
    }

    const imagePrompt = `
Crie arte profissional para delivery.

Tema:
${theme}

Estilo:
${style}

Campanha:
${prompt}

Visual:
- comida apetitosa
- pizza premium
- hamburguer
- delivery
- instagram
- whatsapp
- visual chamativo
- iluminação bonita
`;

    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: imagePrompt,
        size: imageSize(format),
        quality: "medium",
        n: 1,
      }),
    });

    const imageData = await imageRes.json();

    if (!imageRes.ok) {
      throw new Error(imageData?.error?.message || "Erro imagem");
    }

    const b64 = imageData?.data?.[0]?.b64_json;

    if (!b64) {
      throw new Error("Imagem não retornada");
    }

    return NextResponse.json({
      success: true,
      imageUrl: `data:image/png;base64,${b64}`,
      statusText: parsed.statusText,
      instagramCaption: parsed.instagramCaption,
      whatsappText: parsed.whatsappText,
      hashtags: parsed.hashtags,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro interno",
      },
      { status: 500 }
    );
  }
}