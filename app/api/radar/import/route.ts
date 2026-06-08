import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: any) {
  return String(value || "").trim();
}

function normalizeEmail(email: any) {
  const value = clean(email).toLowerCase();
  return value.includes("@") ? value : null;
}

function normalizePhone(phone: any, city?: string) {
  let digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return null;

  if (digits.length === 9 && clean(city).toLowerCase().includes("são paulo")) {
    digits = `11${digits}`;
  }

  if (!digits.startsWith("55")) {
    digits = `55${digits}`;
  }

  if (digits.length !== 13) return null;
  if (digits[4] !== "9") return null;

  return digits;
}

function chunkArray<T>(array: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

export async function POST(req: Request) {
  let jobId: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Arquivo não enviado." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    let totalRows = rows.length;
    let created = 0;
    let updated = 0;
    let duplicated = 0;
    let invalidPhone = 0;
    let underAge = 0;

    const job = await prisma.prospectImportJob.create({
      data: {
        fileName: file.name,
        totalRows,
        status: "PROCESSING",
      },
    });

    jobId = job.id;

    const prepared = [];
    const seenKeys = new Set<string>();

    for (const row of rows) {
      const name = clean(row.nome);
      const age = Number(row.idade || 0);
      const city = clean(row.cidade);
      const email = normalizeEmail(row.email);

      const phone1 = normalizePhone(row.celular1, city);
      const phone2 = normalizePhone(row.celular2, city);

      if (!name) continue;

      if (age < 18) {
        underAge++;
        continue;
      }

      if (!phone1 && !phone2) {
        invalidPhone++;
        continue;
      }

      const key = email || phone1 || phone2;

      if (!key) {
        invalidPhone++;
        continue;
      }

      if (seenKeys.has(key)) {
        duplicated++;
        continue;
      }

      seenKeys.add(key);

      prepared.push({
        name,
        age,
        email,
        phone1,
        phone2,
        gender: clean(row.sexo),
        city,
        address: clean(row.endereco),
        cep: clean(row.cep),
      });
    }

    const batches = chunkArray(prepared, 500);

    for (const batch of batches) {
      const emails = batch
        .map((item) => item.email)
        .filter(Boolean) as string[];

      const phones = batch
        .flatMap((item) => [item.phone1, item.phone2])
        .filter(Boolean) as string[];

      const existing = await prisma.prospect.findMany({
        where: {
          OR: [
            emails.length
              ? {
                  email: {
                    in: emails,
                  },
                }
              : undefined,

            phones.length
              ? {
                  phone1: {
                    in: phones,
                  },
                }
              : undefined,

            phones.length
              ? {
                  phone2: {
                    in: phones,
                  },
                }
              : undefined,
          ].filter(Boolean) as any,
        },
        select: {
          id: true,
          email: true,
          phone1: true,
          phone2: true,
          name: true,
          age: true,
          gender: true,
          city: true,
          address: true,
          cep: true,
        },
      });

      const existingMap = new Map<string, (typeof existing)[number]>();

      for (const item of existing) {
        if (item.email) existingMap.set(item.email, item);
        if (item.phone1) existingMap.set(item.phone1, item);
        if (item.phone2) existingMap.set(item.phone2, item);
      }

      const toCreate = [];

      for (const item of batch) {
        const match =
          (item.email && existingMap.get(item.email)) ||
          (item.phone1 && existingMap.get(item.phone1)) ||
          (item.phone2 && existingMap.get(item.phone2));

        if (match) {
          duplicated++;

          await prisma.prospect.update({
            where: { id: match.id },
            data: {
              name: match.name || item.name,
              age: match.age || item.age,
              email: match.email || item.email,
              phone1: match.phone1 || item.phone1,
              phone2: match.phone2 || item.phone2,
              gender: match.gender || item.gender,
              city: match.city || item.city,
              address: match.address || item.address,
              cep: match.cep || item.cep,
            },
          });

          updated++;
        } else {
          toCreate.push(item);
        }
      }

      if (toCreate.length) {
        await prisma.prospect.createMany({
          data: toCreate,
          skipDuplicates: true,
        });

        created += toCreate.length;
      }
    }

    await prisma.prospectImportJob.update({
      where: { id: jobId },
      data: {
        created,
        updated,
        duplicated,
        invalidPhone,
        underAge,
        status: "DONE",
      },
    });

    return NextResponse.json({
      success: true,
      totalRows,
      created,
      updated,
      duplicated,
      invalidPhone,
      underAge,
    });
  } catch (error: any) {
    console.error(error);

    if (jobId) {
      await prisma.prospectImportJob.update({
        where: { id: jobId },
        data: {
          status: "ERROR",
          error: error.message || "Erro interno",
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro interno ao importar.",
      },
      { status: 500 }
    );
  }
}