import dotenv from "dotenv";
import OpenAI from "openai";
import { NextResponse } from "next/server";

dotenv.config({ path: ".env.local", override: true });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function cleanText(text: string) {
  return String(text || "")
    .replace(/###/g, "")
    .replace(/\*\*/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt || "";
    const images = body.images || [];

    const content: any[] = [
      {
        type: "text",
        text: `
Crie uma mensagem de campanha para WhatsApp de pizzaria/delivery.

Objetivo:
reativar clientes que receberam mensagem inicial, mas ainda não responderam.

Contexto do usuário:
${prompt}

Regras:
- Parece escrita por uma pessoa da pizzaria
- Não seja agressivo
- Máximo 700 caracteres
- Use no máximo 3 emojis
- Fale de promoção, combo, cardápio ou entrega
- Chamada final simples para responder ou pedir
- Não use markdown
- Não use títulos
- Não diga que é IA

Retorne somente a mensagem pronta.
        `,
      },
    ];

    for (const image of images) {
      content.push({
        type: "image_url",
        image_url: { url: image },
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
    });

    const text = cleanText(response.choices[0].message.content || "");

    return NextResponse.json({
      success: true,
      text,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao gerar campanha",
      },
      { status: 500 }
    );
  }
}