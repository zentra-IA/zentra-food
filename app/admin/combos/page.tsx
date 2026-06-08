"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Combo = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  active: boolean;
  sortOrder: number;
};

type ComboForm = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  active: boolean;
  sortOrder: string;
};

const initialForm: ComboForm = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  active: true,
  sortOrder: "0",
};

export default function AdminCombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ComboForm>(initialForm);

  function getCompanyId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("active_company_id") || "";
  }

  useEffect(() => {
    loadCombos();
  }, []);

  async function loadCombos() {
    try {
      setLoading(true);

      const res = await fetch("/api/combos", {
        cache: "no-store",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(data);
        alert(data?.error || "Erro ao carregar combos");
        return;
      }

      setCombos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar combos");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        imageUrl: form.imageUrl.trim() || null,
        active: form.active,
        sortOrder: Number(form.sortOrder || 0),
      };

      const url = editingId
        ? `/api/combos/${editingId}`
        : "/api/combos";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-company-id": getCompanyId(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(data);
        alert(data?.error || "Erro ao salvar combo");
        return;
      }

      await loadCombos();
      resetForm();

      alert(
        editingId
          ? "Combo atualizado com sucesso!"
          : "Combo criado com sucesso!"
      );
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar combo");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(combo: Combo) {
    setEditingId(combo.id);

    setForm({
      name: combo.name || "",
      description: combo.description || "",
      price: String(combo.price || ""),
      imageUrl: combo.imageUrl || "",
      active: Boolean(combo.active),
      sortOrder: String(combo.sortOrder || 0),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(id: string) {
    const confirmed = confirm("Deseja excluir este combo?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "DELETE",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(data);
        alert(data?.error || "Erro ao excluir combo");
        return;
      }

      await loadCombos();
      alert("Combo excluído com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir combo");
    }
  }

  const filteredCombos = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return combos;

    return combos.filter((combo) => {
      return (
        combo.name?.toLowerCase().includes(term) ||
        combo.slug?.toLowerCase().includes(term)
      );
    });
  }, [combos, search]);

  return (
    <main className="min-h-screen bg-slate-50 p-3 md:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold text-red-600">
              Zentra Food
            </p>

            <h1 className="text-3xl font-black text-slate-900 md:text-5xl">
              Combos
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Monte combos inteligentes e personalize grupos de seleção.
            </p>
          </div>

          <button
            onClick={loadCombos}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm"
          >
            Atualizar
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">

          <div className="mb-5">
            <h2 className="text-xl font-black">
              {editingId ? "Editar combo" : "Criar combo"}
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4"
          >

            <div className="grid gap-4 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm font-black">
                  Nome
                </label>

                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black">
                  Preço
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                Imagem URL
              </label>

              <input
                type="text"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    imageUrl: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                Descrição
              </label>

              <textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      active: e.target.checked,
                    }))
                  }
                />
                Combo ativo
              </label>

              <div>
                <label className="mb-2 block text-sm font-black">
                  Ordem
                </label>

                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sortOrder: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
              >
                {saving
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Criar combo"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-700"
                >
                  Cancelar
                </button>
              )}

            </div>

          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">

          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>
              <h2 className="text-xl font-black">
                Combos cadastrados
              </h2>

              <p className="text-sm text-slate-500">
                {filteredCombos.length} combo(s)
              </p>
            </div>

            <input
              type="text"
              placeholder="Buscar combo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-red-500 md:max-w-sm"
            />

          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              Carregando...
            </div>
          ) : filteredCombos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              Nenhum combo encontrado.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">

              {filteredCombos.map((combo) => (
                <article
                  key={combo.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >

                  {combo.imageUrl && (
                    <img
                      src={combo.imageUrl}
                      alt={combo.name}
                      className="mb-4 h-48 w-full rounded-2xl object-cover"
                    />
                  )}

                  <div className="mb-4">

                    <div className="mb-2 flex items-start justify-between gap-3">

                      <h3 className="text-xl font-black">
                        {combo.name}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          combo.active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {combo.active ? "Ativo" : "Inativo"}
                      </span>

                    </div>

                    {combo.description && (
                      <p className="text-sm text-slate-500">
                        {combo.description}
                      </p>
                    )}

                  </div>

                  <div className="mb-5 grid gap-2 text-sm">

                    <p>
                      <strong>Preço:</strong> R$ {Number(combo.price).toFixed(2)}
                    </p>

                    <p>
                      <strong>Ordem:</strong> {combo.sortOrder}
                    </p>

                  </div>

                  <div className="flex flex-col gap-2">

                    <Link
                      href={`/admin/combos/${combo.id}`}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white"
                    >
                      Gerenciar grupos
                    </Link>

                    <div className="flex gap-2">

                      <button
                        onClick={() => handleEdit(combo)}
                        className="flex-1 rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-white"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleDelete(combo.id)}
                        className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white"
                      >
                        Excluir
                      </button>

                    </div>

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