"use client";

import { useEffect, useState } from "react";

type Coupon = {
  id: string;
  code: string;
  name?: string;
  type: "PERCENT" | "FIXED";
  value: number;
  min_order: number;
  max_uses?: number | null;
  used_count?: number;
  active: boolean;
  expires_at?: string | null;
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function loadCoupons() {
    try {
      const res = await fetch("/api/coupons");
      const data = await res.json();

      setCoupons(Array.isArray(data) ? data : []);
    } catch {
      setCoupons([]);
    }
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  async function createCoupon() {
    if (!code.trim()) {
      alert("Informe o código");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          code,
          type,
          value: Number(value || 0),
          min_order: Number(minOrder || 0),
          max_uses: maxUses ? Number(maxUses) : null,
          expires_at: expiresAt || null,
          active: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao criar cupom");
        return;
      }

      setName("");
      setCode("");
      setValue("");
      setMinOrder("");
      setMaxUses("");
      setExpiresAt("");

      await loadCoupons();

      alert("Cupom criado");
    } catch {
      alert("Erro ao criar cupom");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 rounded-3xl bg-gradient-to-r from-red-600 to-orange-500 p-6 text-white">
          <h1 className="text-3xl font-black">
            🎟️ Gestão de Cupons
          </h1>

          <p className="mt-2 opacity-90">
            Crie descontos, promoções e campanhas.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">

          <div className="rounded-3xl bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-xl font-black">
              Novo Cupom
            </h2>

            <div className="space-y-4">

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da campanha"
                className="w-full rounded-2xl border p-3"
              />

              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase())
                }
                placeholder="PIZZA10"
                className="w-full rounded-2xl border p-3 font-bold"
              />

              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as any)
                }
                className="w-full rounded-2xl border p-3"
              >
                <option value="PERCENT">
                  Porcentagem
                </option>

                <option value="FIXED">
                  Valor Fixo
                </option>
              </select>

              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Valor"
                className="w-full rounded-2xl border p-3"
              />

              <input
                type="number"
                value={minOrder}
                onChange={(e) =>
                  setMinOrder(e.target.value)
                }
                placeholder="Pedido mínimo"
                className="w-full rounded-2xl border p-3"
              />

              <input
                type="number"
                value={maxUses}
                onChange={(e) =>
                  setMaxUses(e.target.value)
                }
                placeholder="Máximo de usos"
                className="w-full rounded-2xl border p-3"
              />

              <input
                type="date"
                value={expiresAt}
                onChange={(e) =>
                  setExpiresAt(e.target.value)
                }
                className="w-full rounded-2xl border p-3"
              />

              <button
                disabled={loading}
                onClick={createCoupon}
                className="w-full rounded-2xl bg-red-600 p-4 font-black text-white"
              >
                {loading
                  ? "Criando..."
                  : "Criar Cupom"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-xl font-black">
              Cupons Criados
            </h2>

            <div className="space-y-4">

              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="rounded-2xl border p-4"
                >
                  <div className="flex items-center justify-between">

                    <div>
                      <h3 className="font-black">
                        {coupon.code}
                      </h3>

                      <p className="text-sm text-gray-500">
                        {coupon.name}
                      </p>
                    </div>

                    <div
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        coupon.active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {coupon.active
                        ? "ATIVO"
                        : "INATIVO"}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">

                    <div>
                      Tipo:
                      <strong>
                        {" "}
                        {coupon.type}
                      </strong>
                    </div>

                    <div>
                      Valor:
                      <strong>
                        {" "}
                        {coupon.value}
                      </strong>
                    </div>

                    <div>
                      Pedido mínimo:
                      <strong>
                        {" "}
                        R$ {coupon.min_order}
                      </strong>
                    </div>

                    <div>
                      Utilizados:
                      <strong>
                        {" "}
                        {coupon.used_count || 0}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}

              {!coupons.length && (
                <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
                  Nenhum cupom criado
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}