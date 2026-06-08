"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
};

type Additional = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  required: boolean;
  active: boolean;
  sortOrder: number;
  categoryId: string;
};

type ProductAdditionalConfig = {
  additionalId: string;
  required: boolean;
  sortOrder: number;
};

type CategoryPrice = {
  categoryId: string;
  customPrice: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  active: boolean;
  inStock: boolean;
  categories?: {
    categoryId: string;
    sortOrder: number;
    customPrice?: number | null;
    category: {
      id: string;
      name: string;
    };
  }[];
  productAdditionalConfigs?: {
    additionalId: string;
    required: boolean;
    sortOrder: number;
    additional: Additional;
  }[];
};

type ProductForm = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  categoryIds: string[];
  active: boolean;
  inStock: boolean;
};

const initialForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  categoryIds: [],
  active: true,
  inStock: true,
};

export default function ProdutosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedConfigs, setSelectedConfigs] = useState<ProductAdditionalConfig[]>([]);
  const [categoryPrices, setCategoryPrices] = useState<CategoryPrice[]>([]);
  const [loading, setLoading] = useState(false);

  function getCompanyId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("active_company_id") || "";
  }

  const primaryCategoryId = form.categoryIds[0] || "";

  useEffect(() => {
    loadCategories();
    loadAdditionals();
    loadProducts();
  }, []);

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories", {
        cache: "no-store",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => []);
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
      setCategories([]);
    }
  }

  async function loadAdditionals() {
    try {
      const res = await fetch("/api/additionals", {
        cache: "no-store",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => []);
      setAdditionals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar adicionais:", error);
      setAdditionals([]);
    }
  }

  async function loadProducts() {
    try {
      setLoading(true);

      const res = await fetch("/api/products", {
        cache: "no-store",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        console.error("ERRO AO CARREGAR PRODUTOS:", data);
        setProducts([]);
        return;
      }

      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setSelectedConfigs([]);
    setCategoryPrices([]);
  }

  async function handleUpload(file: File) {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || "Erro no upload da imagem");
        return;
      }

      setForm((prev) => ({
  ...prev,
  imageUrl: data?.url || data?.imageUrl || data?.path || "",
}));
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      alert("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }

  const categoryAdditionals = useMemo(() => {
    return additionals
      .filter(
        (additional) =>
          additional.categoryId === primaryCategoryId && additional.active
      )
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }, [additionals, primaryCategoryId]);

  function isSelectedAdditional(additionalId: string) {
    return selectedConfigs.some((item) => item.additionalId === additionalId);
  }

  function toggleProductAdditional(additionalId: string) {
    setSelectedConfigs((prev) => {
      const exists = prev.some((item) => item.additionalId === additionalId);

      if (exists) {
        return prev.filter((item) => item.additionalId !== additionalId);
      }

      return [
        ...prev,
        {
          additionalId,
          required: false,
          sortOrder: prev.length,
        },
      ];
    });
  }

  function toggleProductAdditionalRequired(additionalId: string) {
    setSelectedConfigs((prev) =>
      prev.map((item) =>
        item.additionalId === additionalId
          ? { ...item, required: !item.required }
          : item
      )
    );
  }

  function handleCategoryToggle(categoryId: string) {
    setForm((prev) => {
      const exists = prev.categoryIds.includes(categoryId);

      const nextCategoryIds = exists
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId];

      return {
        ...prev,
        categoryIds: nextCategoryIds,
      };
    });

    setCategoryPrices((prev) => {
      const exists = prev.some((item) => item.categoryId === categoryId);

      if (exists) {
        return prev.filter((item) => item.categoryId !== categoryId);
      }

      return [...prev, { categoryId, customPrice: "" }];
    });
  }

  function getCategoryCustomPrice(categoryId: string) {
    return (
      categoryPrices.find((item) => item.categoryId === categoryId)
        ?.customPrice || ""
    );
  }

  function setCategoryCustomPrice(categoryId: string, value: string) {
    setCategoryPrices((prev) => {
      const exists = prev.some((item) => item.categoryId === categoryId);

      if (!exists) {
        return [...prev, { categoryId, customPrice: value }];
      }

      return prev.map((item) =>
        item.categoryId === categoryId ? { ...item, customPrice: value } : item
      );
    });
  }

  async function handleSubmit() {
    if (
      !form.name.trim() ||
      !form.description.trim() ||
      !form.price ||
      !form.categoryIds.length
    ) {
      alert("Preencha nome, descrição, preço e pelo menos uma categoria");
      return;
    }

    if (Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      alert("Preço base inválido");
      return;
    }

    for (const item of categoryPrices) {
      if (!form.categoryIds.includes(item.categoryId)) continue;
      if (item.customPrice.trim() === "") continue;

      const parsed = Number(item.customPrice);
      if (Number.isNaN(parsed) || parsed < 0) {
        alert("Um dos preços por categoria está inválido");
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        imageUrl: form.imageUrl.trim() || null,
        categoryIds: form.categoryIds,
        categoryPrices: form.categoryIds.map((categoryId) => ({
          categoryId,
          customPrice: getCategoryCustomPrice(categoryId),
        })),
        productAdditionalConfigs: selectedConfigs.map((item, index) => ({
          additionalId: item.additionalId,
          required: item.required,
          sortOrder: index,
        })),
      };

      const url = editingId ? `/api/products/${editingId}` : "/api/products";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-company-id": getCompanyId(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("ERRO API PRODUTO:", data);

        alert(
          `${data?.error || "Erro ao salvar produto"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      resetForm();
      await loadProducts();

      alert(
        editingId
          ? "Produto atualizado com sucesso!"
          : "Produto criado com sucesso!"
      );
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      alert("Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(product: Product) {
    setEditingId(product.id);

    const productCategoryIds = (product.categories || []).map(
      (item) => item.categoryId
    );

    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      imageUrl: product.imageUrl || "",
      categoryIds: productCategoryIds,
      active: product.active,
      inStock: product.inStock,
    });

    setCategoryPrices(
      (product.categories || []).map((item) => ({
        categoryId: item.categoryId,
        customPrice:
          item.customPrice !== undefined && item.customPrice !== null
            ? String(item.customPrice)
            : "",
      }))
    );

    setSelectedConfigs(
      (product.productAdditionalConfigs || []).map((config, index) => ({
        additionalId: config.additionalId,
        required: Boolean(config.required),
        sortOrder:
          config.sortOrder !== undefined ? Number(config.sortOrder) : index,
      }))
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(id: string) {
    const confirmed = confirm("Deseja excluir este produto?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("ERRO AO EXCLUIR PRODUTO:", data);

        alert(
          `${data?.error || "Erro ao excluir produto"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      await loadProducts();
      alert("Produto excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      alert("Erro ao excluir produto");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Zentra Food</p>
            <h1 className="text-2xl font-black tracking-tight md:text-4xl">
              Produtos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre pizzas, bebidas, combos e itens do cardápio.
            </p>
          </div>

          <button
            type="button"
            onClick={loadProducts}
            disabled={loading}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Atualizando..." : "Atualizar lista"}
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-1">
            <h2 className="text-xl font-black">
              {editingId ? "Editar produto" : "Criar produto"}
            </h2>
            <p className="text-sm text-slate-500">
              Use nomes simples e fotos boas. Isso aparece para o cliente no
              cardápio.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Nome do produto
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pizza de Calabresa"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Preço base
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 49.90"
                  value={form.price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price: e.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Descrição
              </label>
              <textarea
                placeholder="Ex: Mussarela, calabresa, cebola e orégano."
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
                className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Imagem do produto
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    handleUpload(file);
                  }
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />

              {uploading && (
                <p className="mt-2 text-sm text-slate-500">
                  Enviando imagem...
                </p>
              )}

              {form.imageUrl && (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={form.imageUrl}
                    alt="Preview do produto"
                    className="h-24 w-24 rounded-2xl border object-cover"
                  />
                  <p className="text-sm text-slate-500">
                    Imagem carregada com sucesso.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-black text-slate-700">
                  Categorias do produto
                </p>
                <p className="text-sm text-slate-500">
                  Escolha onde esse produto vai aparecer no cardápio.
                </p>
              </div>

              {categories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Nenhuma categoria encontrada. Crie uma categoria antes de
                  cadastrar produtos.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {categories.map((category) => {
                    const checked = form.categoryIds.includes(category.id);

                    return (
                      <div
                        key={category.id}
                        className={`rounded-2xl border p-4 transition ${
                          checked
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <label className="flex items-center gap-3 text-sm font-black text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleCategoryToggle(category.id)}
                            className="h-5 w-5"
                          />
                          {category.name}
                        </label>

                        {checked && (
                          <div className="mt-3">
                            <label className="mb-1 block text-xs font-bold text-slate-600">
                              Preço nesta categoria
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Vazio = usa preço base"
                              value={getCategoryCustomPrice(category.id)}
                              onChange={(e) =>
                                setCategoryCustomPrice(
                                  category.id,
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-black text-slate-700">
                  Adicionais do produto
                </p>
                <p className="text-sm text-slate-500">
                  Selecione bordas, extras e opções vinculadas à primeira
                  categoria.
                </p>
              </div>

              {!primaryCategoryId ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Selecione pelo menos uma categoria para configurar adicionais.
                </div>
              ) : categoryAdditionals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Essa categoria ainda não possui adicionais cadastrados.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {categoryAdditionals.map((additional) => {
                    const selected = isSelectedAdditional(additional.id);

                    return (
                      <div
                        key={additional.id}
                        className={`rounded-2xl border p-4 transition ${
                          selected
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <label className="flex items-start gap-3 text-sm font-black text-slate-700">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              toggleProductAdditional(additional.id)
                            }
                            className="mt-1 h-5 w-5"
                          />
                          <span>
                            {additional.name} — R${" "}
                            {Number(additional.price).toFixed(2)}
                          </span>
                        </label>

                        {additional.description && (
                          <p className="mt-2 text-sm text-slate-500">
                            {additional.description}
                          </p>
                        )}

                        {selected && (
                          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={
                                selectedConfigs.find(
                                  (item) =>
                                    item.additionalId === additional.id
                                )?.required || false
                              }
                              onChange={() =>
                                toggleProductAdditionalRequired(additional.id)
                              }
                              className="h-5 w-5"
                            />
                            Obrigatório neste produto
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      active: e.target.checked,
                    })
                  }
                  className="h-5 w-5"
                />
                Produto ativo
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      inStock: e.target.checked,
                    })
                  }
                  className="h-5 w-5"
                />
                Em estoque
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || uploading}
                className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50 sm:w-auto"
              >
                {saving
                  ? editingId
                    ? "Salvando..."
                    : "Criando..."
                  : editingId
                  ? "Salvar edição"
                  : "Criar produto"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-300 sm:w-auto"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Produtos cadastrados</h2>
              <p className="text-sm text-slate-500">
                {products.length} produto(s) encontrado(s).
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Carregando produtos...
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Nenhum produto cadastrado ainda.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-red-200 hover:bg-white hover:shadow-sm"
                >
                  <div className="mb-4 flex gap-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white">
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
                      <h3 className="truncate text-lg font-black text-slate-900">
                        {product.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {product.description}
                      </p>

                      <p className="mt-2 text-sm font-black text-red-600">
                        R$ {Number(product.price).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-2 text-sm text-slate-600">
                    <p>
                      <strong>Status:</strong>{" "}
                      {product.active ? "Ativo" : "Inativo"}
                    </p>

                    <p>
                      <strong>Estoque:</strong>{" "}
                      {product.inStock ? "Disponível" : "Indisponível"}
                    </p>

                    <p>
                      <strong>Categorias:</strong>{" "}
                      {product.categories && product.categories.length > 0
                        ? product.categories
                            .map((item) => {
                              const custom =
                                item.customPrice !== undefined &&
                                item.customPrice !== null
                                  ? ` (R$ ${Number(item.customPrice).toFixed(
                                      2
                                    )})`
                                  : "";

                              return `${item.category.name}${custom}`;
                            })
                            .join(", ")
                        : "Sem categoria"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleEdit(product)}
                      className="w-full rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-white transition hover:bg-yellow-600 sm:w-auto"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 sm:w-auto"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}