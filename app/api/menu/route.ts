import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId } from "@/lib/server-company";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada" },
        { status: 401 }
      );
    }

    const categories = await prisma.category.findMany({
      where: {
        active: true,
        company_id: companyId,
      },
      orderBy: {
        sortOrder: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        type: true,
        selectionRequired: true,
        active: true,
        sortOrder: true,

        additionalLinks: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            additional: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                price: true,
                required: true,
                active: true,
                sortOrder: true,
              },
            },
          },
        },

        productLinks: {
          where: {
            company_id: companyId,
          },
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            categoryId: true,
            customPrice: true,
            sortOrder: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                price: true,
                imageUrl: true,
                active: true,
                inStock: true,

                productAdditionalConfigs: {
                  where: {
                    company_id: companyId,
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                  select: {
                    additionalId: true,
                    required: true,
                    additional: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        price: true,
                        required: true,
                        active: true,
                        sortOrder: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const formatted = categories.map((category) => {
      const additionals = (category.additionalLinks || [])
        .map((link) => link.additional)
        .filter((additional) => additional && additional.active);

      const products = (category.productLinks || [])
        .filter(
          (link) =>
            link.product &&
            link.product.active &&
            link.product.inStock
        )
        .map((link) => {
          const basePrice = Number(link.product.price || 0);

          const customPrice =
            link.customPrice !== null && link.customPrice !== undefined
              ? Number(link.customPrice)
              : null;

          return {
            ...link.product,
            categoryPrice: customPrice ?? basePrice,
            productAdditionalConfigs: (
              link.product.productAdditionalConfigs || []
            )
              .filter((config) => config.additional?.active !== false)
              .map((config, index) => ({
                ...config,
                sortOrder: index,
              })),
          };
        });

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        type: category.type,
        selectionRequired: category.selectionRequired,
        active: category.active,
        sortOrder: category.sortOrder,
        additionals,
        products,
      };
    });

    return NextResponse.json(formatted, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("ERRO AO BUSCAR CARDÁPIO:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar cardápio",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}