"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Combo = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
};

type ComboGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  items?: {
    id: string;
    product?: {
      id: string;
      name: string;
    };
  }[];
};

type GroupForm = {
  name: string;
  required: boolean;
  minSelect: string;
  maxSelect: string;
  sortOrder: string;
};

const initialForm: GroupForm = {
  name: "",
  required: true,
  minSelect: "1",
  maxSelect: "1",
  sortOrder: "0",
};

export default function ComboGroupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [comboId, setComboId] = useState("");
  const [combo, setCombo] = useState<Combo | null>(null);
  const [groups, setGroups] = useState<ComboGroup[]>([]);
  const [form, setForm] = useState<GroupForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  function getCompanyId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("active_company_id") || "";
  }

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setComboId(resolved.id);
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!comboId) return;
    loadComboAndGroups();
  }, [comboId]);

  async function loadComboAndGroups() {
    try {
      setLoading(true);

      const headers = {
        "x-company-id": getCompanyId(),
      };

      const [combosRes, groupsRes] = await Promise.all([
        fetch("/api/combos", {
          cache: "no-store",
          headers,
        }),
        fetch(`/api/combos/${comboId}/groups`, {
          cache: "no-store",
          headers,
        }),
      ]);

      const combosData = await combosRes.json().catch(() => []);
      const groupsData = await groupsRes.json().catch(() => []);

      if (!combosRes.ok) {
        console.error("ERRO COMBOS:", combosData);
        setCombo(null);
      } else {
        const found = Array.isArray(combosData)
          ? combosData.find((item: Combo) => item.id === comboId)
          : null;

        setCombo(found || null);
      }

      if (!groupsRes.ok) {
        console.error("ERRO GROUPS:", groupsData);
        setGroups([]);
      } else {
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      }
    } catch (error) {
      console.error("Erro ao carregar combo/grupos:", error);
      setCombo(null);
      setGroups([]);
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

    if (!form.name.trim()) {
      alert("Nome do grupo é obrigatório");
      return;
    }

    const minSelect = Number(form.minSelect);
    const maxSelect = Number(form.maxSelect);
    const sortOrder = Number(form.sortOrder || 0);

    if (
      Number.isNaN(minSelect) ||
      Number.isNaN(maxSelect) ||
      minSelect < 0 ||
      maxSelect < 1
    ) {
      alert("Mínimo ou máximo inválido");
      return;
    }

    if (minSelect > maxSelect) {
      alert("O mínimo não pode ser maior que o máximo");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        required: Boolean(form.required),
        minSelect,
        maxSelect,
        sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      };

      const url = editingId
        ? `/api/combo-groups/${editingId}`
        : `/api/combos/${comboId}/groups`;

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
        console.error("ERRO API GROUP:", data);

        alert(
          `${data?.error || "Erro ao salvar grupo"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      resetForm();
      await loadComboAndGroups();

      alert(
        editingId
          ? "Grupo atualizado com sucesso!"
          : "Grupo criado com sucesso!"
      );
    } catch (error) {
      console.error("Erro ao salvar grupo:", error);
      alert("Erro ao salvar grupo");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(group: ComboGroup) {
    setEditingId(group.id);

    setForm({
      name: group.name || "",
      required: Boolean(group.required),
      minSelect: String(group.minSelect ?? 1),
      maxSelect: String(group.maxSelect ?? 1),
      sortOrder: String(group.sortOrder ?? 0),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(id: string) {
    const confirmed = confirm("Deseja excluir este grupo?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/combo-groups/${id}`, {
        method: "DELETE",
        headers: {
          "x-company-id": getCompanyId(),
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("ERRO DELETE GROUP:", data);

        alert(
          `${data?.error || "Erro ao excluir grupo"}${
            data?.details ? `\n\nDetalhes: ${data.details}` : ""
          }`
        );

        return;
      }

      await loadComboAndGroups();
      alert("Grupo excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir grupo:", error);
      alert("Erro ao excluir grupo");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Zentra Food</p>
            <h1 className="text-2xl font-black tracking-tight md:text-4xl">
              Grupos do Combo
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {combo ? `Combo: ${combo.name}` : "Carregando combo..."}
            </p>
          </div>

          <Link
            href="/admin/combos"
            className="w-full rounded-2xl bg-slate-800 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-slate-900 sm:w-auto"
          >
            Voltar para combos
          </Link>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-black">
              {editingId ? "Editar grupo" : "Criar grupo"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Grupos controlam quantos itens o cliente pode escolher dentro do combo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Nome do grupo
              </label>
              <input
                type="text"
                placeholder="Ex: Escolha sua pizza"
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

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Mínimo
                </label>
                <input
                  type="number"
                  value={form.minSelect}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      minSelect: e.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Máximo
                </label>
                <input
                  type="number"
                  value={form.maxSelect}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxSelect: e.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Ordem
                </label>
                <input
                  type="number"
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

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) =>
                  setForm({
                    ...form,
                    required: e.target.checked,
                  })
                }
                className="h-5 w-5"
              />
              Grupo obrigatório
            </label>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50 sm:w-auto"
              >
                {saving
                  ? "Salvando..."
                  : editingId
                  ? "Salvar grupo"
                  : "Criar grupo"}
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
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Grupos cadastrados</h2>
              <p className="text-sm text-slate-500">
                {groups.length} grupo(s) configurado(s).
              </p>
            </div>

            <button
              type="button"
              onClick={loadComboAndGroups}
              disabled={loading}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Carregando grupos...
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Nenhum grupo cadastrado ainda.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <article
                  key={group.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-red-200 hover:bg-white hover:shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {group.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.items?.length || 0} item(ns) configurado(s)
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        group.required
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {group.required ? "Obrigatório" : "Opcional"}
                    </span>
                  </div>

                  <div className="mb-4 grid gap-2 text-sm text-slate-600">
                    <p>
                      <strong>Mínimo:</strong> {group.minSelect}
                    </p>
                    <p>
                      <strong>Máximo:</strong> {group.maxSelect}
                    </p>
                    <p>
                      <strong>Ordem:</strong> {group.sortOrder}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleEdit(group)}
                      className="w-full rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-white transition hover:bg-yellow-600 sm:w-auto"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(group.id)}
                      className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 sm:w-auto"
                    >
                      Excluir
                    </button>

                    <Link
                      href={`/admin/combo-groups/${group.id}/items`}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-700 sm:w-auto"
                    >
                      Itens
                    </Link>
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