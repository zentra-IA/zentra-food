"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  active: boolean;
  inStock: boolean;
  category?: {
    name: string;
  };
};

type Group = {
  id: string;
  name: string;
  comboId: string;
};

type GroupItem = {
  id: string;
  productId: string;
  sortOrder?: number;
  product?: Product;
};

export default function ComboGroupItemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [groupId, setGroupId] = useState("");
  const [group, setGroup] = useState<Group | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  function getCompanyId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("active_company_id") || "";
  }

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setGroupId(resolved.id);
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!groupId) return;
    loadData();
  }, [groupId]);

  async function loadData() {
    try {
      setLoading(true);

      const headers = {
        "x-company-id": getCompanyId(),
      };

      const [groupRes, productsRes, itemsRes] = await Promise.all([
        fetch(`/api/combo-groups/${groupId}`, {
          cache: "no-store",
          headers,
        }),
        fetch("/api/products", {
          cache: "no-store",
          headers,
        }),
        fetch(`/api/combo-groups/${groupId}/items`, {
          cache: "no-store",
          headers,
        }),
      ]);

      const groupData = await groupRes.json().catch(() => null);
      const productsData = await productsRes.json().catch(() => []);
      const itemsData = await itemsRes.json().catch(() => []);

      if (!groupRes.ok) {
        console.error("ERRO GROUP:", groupData);
        setGroup(null);
      } else {
        setGroup(groupData);
      }

      if (!productsRes.ok) {
        console.error("ERRO PRODUCTS:", productsData);
        setProducts([]);
      } else {
        setProducts(Array.isArray(productsData) ? productsData : []);
      }

      if (!itemsRes.ok) {
        console.error("ERRO ITEMS:", itemsData);
        setSelectedProductIds([]);
      } else {
        const items = Array.isArray(itemsData) ? itemsData : [];
        setSelectedProductIds(items.map((item: GroupItem) => item.productId));
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setGroup(null);
      setProducts([]);
      setSelectedProductIds([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleProduct(productId: string) {
    setSelectedProductIds((prev) => {
      const exists = prev.includes(productId);

      if (exists) {
        return prev.filter((id) => id !== productId);
      }

      return [...prev, productId];
    });
  }

  const availableProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products
      .filter((product) => product.active && product.inStock)
      .filter((product) => {
        if (!term) return true;

        return (
          product.name.toLowerCase().includes(term) ||
          String(product.description || "").toLowerCase().includes(term) ||
          String(product.category?.name || "").toLowerCase().includes(term)
        );
      });
  }, [products, search]);

  async function handleSave() {
    try {
      setSaving(true);

      const payload = {
        items: selectedProductIds.map((productId, index) => ({
          productId,
          sortOrder: index,
        })),
      };

      const res = await fetch(`/api/combo-groups/${groupId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": getCompanyId(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("ERRO SAVE ITEMS:", data);

        alert(
          `${data?.error || "Erro ao salvar itens"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      await loadData();
      alert("Itens do grupo salvos com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar itens:", error);
      alert("Erro ao salvar itens");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Zentra Food</p>
            <h1 className="text-2xl font-black tracking-tight md:text-4xl">
              Itens do Grupo
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {group ? `Grupo: ${group.name}` : "Carregando grupo..."}
            </p>
          </div>

          <Link
            href={group ? `/admin/combos/${group.comboId}` : "/admin/combos"}
            className="w-full rounded-2xl bg-slate-800 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-slate-900 sm:w-auto"
          >
            Voltar
          </Link>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">Produtos disponíveis</h2>
              <p className="text-sm text-slate-500">
                Selecione quais produtos aparecem dentro deste grupo.
              </p>
            </div>

            <input
              type="text"
              placeholder="Buscar produto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 md:max-w-sm"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Carregando produtos...
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Nenhum produto disponível.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {availableProducts.map((product) => {
                const selected = selectedProductIds.includes(product.id);

                return (
                  <label
                    key={product.id}
                    className={`flex cursor-pointer gap-4 rounded-3xl border p-4 transition ${
                      selected
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleProduct(product.id)}
                      className="mt-2 h-5 w-5"
                    />

                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">🍕</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900">
                        {product.name}
                      </p>

                      {product.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {product.description}
                        </p>
                      )}

                      <p className="mt-2 text-sm font-black text-red-600">
                        R$ {Number(product.price).toFixed(2)}
                      </p>

                      <p className="text-xs text-slate-500">
                        Categoria: {product.category?.name || "Sem categoria"}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-slate-600">
              {selectedProductIds.length} produto(s) selecionado(s)
            </p>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Salvando..." : "Salvar itens do grupo"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}