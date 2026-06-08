"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Additional = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  required: boolean;
  active: boolean;
  sortOrder: number;
  categoryIds?: string[];
  categories?: Category[];
  category?: Category | null;
  categoryId?: string;
};

type AdditionalForm = {
  name: string;
  description: string;
  price: string;
  categoryIds: string[];
  required: boolean;
  active: boolean;
  sortOrder: string;
};

const initialForm: AdditionalForm = {
  name: "",
  description: "",
  price: "",
  categoryIds: [],
  required: false,
  active: true,
  sortOrder: "0",
};

export default function AdminAdditionalsPage() {
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<AdditionalForm>(initialForm);

  function getCompanyId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("active_company_id") || "";
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);

      const headers = {
        "x-company-id": getCompanyId(),
      };

      const [additionalsRes, categoriesRes] = await Promise.all([
        fetch("/api/additionals", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/categories", {
          cache: "no-store",
          headers,
        }),
      ]);

      const additionalsData = await additionalsRes.json().catch(() => []);
      const categoriesData = await categoriesRes.json().catch(() => []);

      if (!additionalsRes.ok) {
        console.error("ERRO AO BUSCAR ADICIONAIS:", additionalsData);
        setAdditionals([]);
      } else {
        setAdditionals(Array.isArray(additionalsData) ? additionalsData : []);
      }

      if (!categoriesRes.ok) {
        console.error("ERRO AO BUSCAR CATEGORIAS:", categoriesData);
        setCategories([]);
      } else {
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert("Erro ao carregar adicionais e categorias");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function handleChange(
    field: keyof AdditionalForm,
    value: string | boolean | string[]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function toggleCategory(categoryId: string) {
    setForm((prev) => {
      const currentCategoryIds = Array.isArray(prev.categoryIds)
        ? prev.categoryIds
        : [];

      const exists = currentCategoryIds.includes(categoryId);

      return {
        ...prev,
        categoryIds: exists
          ? currentCategoryIds.filter((id) => id !== categoryId)
          : [...currentCategoryIds, categoryId],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Nome do adicional é obrigatório");
      return;
    }

    if (!Array.isArray(form.categoryIds) || form.categoryIds.length === 0) {
      alert("Selecione pelo menos uma categoria");
      return;
    }

    if (form.price === "" || Number.isNaN(Number(form.price))) {
      alert("Preço inválido");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        categoryIds: form.categoryIds,
        required: Boolean(form.required),
        active: Boolean(form.active),
        sortOrder: Number(form.sortOrder || 0),
      };

      const url = editingId
        ? `/api/additionals/${editingId}`
        : "/api/additionals";

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
        console.error("ERRO API ADDITIONAL:", data);

        alert(
          `${data?.error || "Erro ao salvar adicional"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      await loadInitialData();
      resetForm();

      alert(
        editingId
          ? "Adicional atualizado com sucesso!"
          : "Adicional criado com sucesso!"
      );
    } catch (error) {
      console.error("Erro ao salvar adicional:", error);
      alert(error instanceof Error ? error.message : "Erro ao salvar adicional");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(additional: Additional) {
    const normalizedCategoryIds =
      Array.isArray(additional.categoryIds) && additional.categoryIds.length > 0
        ? additional.categoryIds
        : additional.categoryId
        ? [additional.categoryId]
        : [];

    setEditingId(additional.id);
    setForm({
      name: additional.name || "",
      description: additional.description || "",
      price: String(additional.price ?? ""),
      categoryIds: normalizedCategoryIds,
      required: Boolean(additional.required),
      active: Boolean(additional.active),
      sortOrder: String(additional.sortOrder ?? 0),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(id: string) {
    const confirmed = confirm("Tem certeza que deseja excluir este adicional?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/additionals/${id}`, {
        method: "DELETE",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("ERRO AO EXCLUIR ADICIONAL:", data);

        alert(
          `${data?.error || "Erro ao excluir adicional"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      await loadInitialData();
      alert("Adicional excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir adicional:", error);
      alert("Erro ao excluir adicional");
    }
  }

  const filteredAdditionals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return additionals;

    return additionals.filter((additional) => {
      const name = additional.name?.toLowerCase() || "";
      const categoriesText =
        additional.categories
          ?.map((category) => category.name.toLowerCase())
          .join(" ") || "";
      const slug = additional.slug?.toLowerCase() || "";

      return (
        name.includes(term) ||
        categoriesText.includes(term) ||
        slug.includes(term)
      );
    });
  }, [additionals, search]);

  const safeCategoryIds = Array.isArray(form.categoryIds)
    ? form.categoryIds
    : [];

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Zentra Food</p>
            <h1 className="text-2xl font-black tracking-tight md:text-4xl">
              Adicionais
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre bordas, extras, bebidas adicionais e opções para seus produtos.
            </p>
          </div>

          <button
            type="button"
            onClick={loadInitialData}
            disabled={loading}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Atualizando..." : "Atualizar lista"}
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-1">
            <h2 className="text-xl font-black">
              {editingId ? "Editar adicional" : "Criar adicional"}
            </h2>
            <p className="text-sm text-slate-500">
              Vincule o adicional às categorias onde ele deve aparecer.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Nome do adicional
                </label>
                <input
                  type="text"
                  placeholder="Ex: Borda catupiry"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Preço
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 5.00"
                  value={form.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Descrição
              </label>
              <textarea
                placeholder="Ex: Borda recheada com catupiry original."
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Ordem
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.sortOrder}
                onChange={(e) => handleChange("sortOrder", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 md:max-w-xs"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <p className="text-sm font-black text-slate-700">
                  Categorias do adicional
                </p>
                <p className="text-sm text-slate-500">
                  Escolha onde esse adicional será exibido.
                </p>
              </div>

              {categories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  Nenhuma categoria encontrada. Crie uma categoria primeiro.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {categories.map((category) => {
                    const checked = safeCategoryIds.includes(category.id);

                    return (
                      <label
                        key={category.id}
                        className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-black transition ${
                          checked
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(category.id)}
                          className="h-5 w-5"
                        />
                        {category.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => handleChange("required", e.target.checked)}
                  className="h-5 w-5"
                />
                Obrigatório
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => handleChange("active", e.target.checked)}
                  className="h-5 w-5"
                />
                Ativo
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50 sm:w-auto"
              >
                {saving
                  ? editingId
                    ? "Salvando..."
                    : "Criando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Criar adicional"}
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
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">Adicionais cadastrados</h2>
              <p className="text-sm text-slate-500">
                {filteredAdditionals.length} adicional(is) encontrado(s).
              </p>
            </div>

            <input
              type="text"
              placeholder="Buscar adicional"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 md:max-w-sm"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Carregando adicionais...
            </div>
          ) : filteredAdditionals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Nenhum adicional encontrado.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAdditionals.map((additional) => (
                <article
                  key={additional.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-red-200 hover:bg-white hover:shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {additional.name}
                      </h3>

                      {additional.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {additional.description}
                        </p>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        additional.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {additional.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="mb-4 grid gap-2 text-sm text-slate-600">
                    <p>
                      <strong>Preço:</strong> R${" "}
                      {Number(additional.price).toFixed(2)}
                    </p>

                    <p>
                      <strong>Obrigatório:</strong>{" "}
                      {additional.required ? "Sim" : "Não"}
                    </p>

                    <p>
                      <strong>Ordem:</strong>{" "}
                      {Number(additional.sortOrder || 0)}
                    </p>

                    <p>
                      <strong>Categorias:</strong>{" "}
                      {additional.categories && additional.categories.length > 0
                        ? additional.categories
                            .map((category) => category.name)
                            .join(", ")
                        : "Sem categoria"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleEdit(additional)}
                      className="w-full rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-white transition hover:bg-yellow-600 sm:w-auto"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(additional.id)}
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