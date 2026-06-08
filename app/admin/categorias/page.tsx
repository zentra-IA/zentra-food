"use client";

import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: "NORMAL" | "PIZZA_HALF_HALF";
  selectionRequired: boolean;
  active: boolean;
  sortOrder: number;
};

type CategoryForm = {
  name: string;
  description: string;
  type: "NORMAL" | "PIZZA_HALF_HALF";
  selectionRequired: boolean;
  active: boolean;
  sortOrder: string;
};

const initialForm: CategoryForm = {
  name: "",
  description: "",
  type: "NORMAL",
  selectionRequired: false,
  active: true,
  sortOrder: "0",
};

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  function getCompanyId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("active_company_id") || "";
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);

      const res = await fetch("/api/categories", {
        cache: "no-store",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        console.error("ERRO AO CARREGAR CATEGORIAS:", data);
        setCategories([]);
        return;
      }

      const ordered = Array.isArray(data)
        ? [...data].sort(
            (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
          )
        : [];

      setCategories(ordered);
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      alert("Nome da categoria é obrigatório");
      return;
    }

    if (Number.isNaN(Number(form.sortOrder))) {
      alert("Ordem inválida");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        selectionRequired: Boolean(form.selectionRequired),
        active: Boolean(form.active),
        sortOrder: Number(form.sortOrder || 0),
      };

      const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
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
        console.error("ERRO API CATEGORIA:", data);

        alert(
          `${data?.error || "Erro ao salvar categoria"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      resetForm();
      await loadCategories();

      alert(
        editingId
          ? "Categoria atualizada com sucesso!"
          : "Categoria criada com sucesso!"
      );
    } catch (error) {
      console.error("Erro ao salvar categoria:", error);
      alert("Erro ao salvar categoria");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(category: Category) {
    setEditingId(category.id);

    setForm({
      name: category.name || "",
      description: category.description || "",
      type: category.type || "NORMAL",
      selectionRequired: Boolean(category.selectionRequired),
      active: Boolean(category.active),
      sortOrder: String(category.sortOrder ?? 0),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(id: string) {
    const confirmed = confirm("Deseja excluir esta categoria?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("ERRO AO EXCLUIR CATEGORIA:", data);

        alert(
          `${data?.error || "Erro ao excluir categoria"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      await loadCategories();
      alert("Categoria excluída com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
      alert("Erro ao excluir categoria");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Zentra Food</p>
            <h1 className="text-2xl font-black tracking-tight md:text-4xl">
              Categorias
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Organize o cardápio por grupos como pizzas, bebidas, combos e
              adicionais.
            </p>
          </div>

          <button
            type="button"
            onClick={loadCategories}
            disabled={loading}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Atualizando..." : "Atualizar lista"}
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-1">
            <h2 className="text-xl font-black">
              {editingId ? "Editar categoria" : "Criar categoria"}
            </h2>
            <p className="text-sm text-slate-500">
              Use nomes simples. O cliente final vai ver isso no cardápio.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Nome da categoria
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pizzas, Bebidas, Combos"
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
                  Ordem no cardápio
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sortOrder: e.target.value,
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
                placeholder="Ex: Escolha sua pizza favorita."
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

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Tipo da categoria
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as "NORMAL" | "PIZZA_HALF_HALF",
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                >
                  <option value="NORMAL">Categoria normal</option>
                  <option value="PIZZA_HALF_HALF">Pizza meio a meio</option>
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.selectionRequired}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      selectionRequired: e.target.checked,
                    })
                  }
                  className="h-5 w-5"
                />
                Exigir seleção
              </label>

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
                Categoria ativa
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50 sm:w-auto"
              >
                {saving
                  ? editingId
                    ? "Salvando..."
                    : "Criando..."
                  : editingId
                  ? "Salvar edição"
                  : "Criar categoria"}
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
              <h2 className="text-xl font-black">Categorias cadastradas</h2>
              <p className="text-sm text-slate-500">
                {categories.length} categoria(s) encontrada(s).
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Carregando categorias...
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Nenhuma categoria cadastrada ainda.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {categories.map((category) => (
                <article
                  key={category.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-red-200 hover:bg-white hover:shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {category.name}
                      </h3>

                      {category.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {category.description}
                        </p>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        category.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {category.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>

                  <div className="mb-4 grid gap-2 text-sm text-slate-600">
                    <p>
                      <strong>Tipo:</strong>{" "}
                      {category.type === "PIZZA_HALF_HALF"
                        ? "Pizza meio a meio"
                        : "Normal"}
                    </p>

                    <p>
                      <strong>Exigir seleção:</strong>{" "}
                      {category.selectionRequired ? "Sim" : "Não"}
                    </p>

                    <p>
                      <strong>Ordem:</strong>{" "}
                      {Number(category.sortOrder || 0)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleEdit(category)}
                      className="w-full rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-white transition hover:bg-yellow-600 sm:w-auto"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(category.id)}
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