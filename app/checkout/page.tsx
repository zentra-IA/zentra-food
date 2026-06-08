"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  isHalfHalf?: boolean;
  isCombo?: boolean;
  comboId?: string;
  comboSelectionsSummary?: string[];
  flavorIds?: string[];
  flavorNames?: string[];
  additionalIds?: string[];
  additionalNames?: string[];
};

type PaymentMethod = "PIX" | "DINHEIRO" | "DEBITO" | "CREDITO";

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [customerCep, setCustomerCep] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [customerComplement, setCustomerComplement] = useState("");
  const [customerNeighborhood, setCustomerNeighborhood] = useState("");
  const [customerCity, setCustomerCity] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [changeFor, setChangeFor] = useState("");
  const [observation, setObservation] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [couponApplied, setCouponApplied] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem("cart");

    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        setCart(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCart([]);
      }
    }
  }, []);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
  }, [cart]);

  const deliveryFee = 0;

  const total = Math.max(
    0,
    subtotal + deliveryFee - Number(discountValue || 0)
  );

  function formatMoney(value: number) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function onlyNumbers(value: string) {
    return value.replace(/\D/g, "");
  }

  async function searchCep() {
    const cep = onlyNumbers(customerCep);

    if (cep.length !== 8) return;

    try {
      setIsLoadingCep(true);

      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data?.erro) {
        alert("CEP não encontrado");
        return;
      }

      setCustomerAddress(data.logradouro || "");
      setCustomerNeighborhood(data.bairro || "");
      setCustomerCity(data.localidade || "");
    } catch {
      alert("Erro ao buscar CEP");
    } finally {
      setIsLoadingCep(false);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) {
      alert("Digite um cupom");
      return;
    }

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id":
            localStorage.getItem("active_company_id") ||
            "b7336aa2-345d-4624-8141-0ea0de084c3d",
        },
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotal,
          deliveryFee,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        alert(data?.error || "Cupom inválido");
        setCouponApplied(null);
        setDiscountValue(0);
        return;
      }

      setCouponApplied(data);
      setDiscountValue(Number(data.discount || 0));
    } catch {
      alert("Erro ao validar cupom");
    }
  }

  function removeCoupon() {
    setCouponCode("");
    setCouponApplied(null);
    setDiscountValue(0);
  }

  function buildItemDisplayName(item: CartItem) {
    let finalName = "Produto";

    if (item.isHalfHalf && item.flavorNames?.length) {
      finalName = `Meio a Meio: ${item.flavorNames.join(" + ")}`;
    } else if (item.isCombo) {
      finalName = item.name?.trim() || "Combo";
    } else {
      finalName = item.name?.trim() || "Produto";
    }

    if (item.isCombo && item.comboSelectionsSummary?.length) {
      finalName += ` | Itens: ${item.comboSelectionsSummary.join(" | ")}`;
    }

    if (item.additionalNames?.length) {
      finalName += ` | Adicionais: ${item.additionalNames.join(", ")}`;
    }

    return finalName;
  }
  async function handleFinishOrder() {
    if (cart.length === 0) return alert("Seu carrinho está vazio.");
    if (!customerName.trim()) return alert("Nome do cliente é obrigatório");
    if (!customerWhatsapp.trim()) return alert("WhatsApp é obrigatório");
    if (!customerCep.trim()) return alert("CEP é obrigatório");
    if (!customerAddress.trim()) return alert("Endereço é obrigatório");
    if (!customerNumber.trim()) return alert("Número é obrigatório");
    if (!customerNeighborhood.trim()) return alert("Bairro é obrigatório");
    if (!customerCity.trim()) return alert("Cidade é obrigatória");

    let parsedChangeFor: string | null = null;

    if (paymentMethod === "DINHEIRO" && changeFor.trim()) {
      const troco = Number(changeFor.replace(",", "."));

      if (Number.isNaN(troco) || troco < total) {
        alert("O troco precisa ser maior ou igual ao valor total.");
        return;
      }

      parsedChangeFor = troco.toFixed(2);
    }

    try {
      setIsSubmitting(true);

      const normalizedItems = cart.map((item) => {
        const rawProductId =
          item.productId && String(item.productId).trim() !== ""
            ? String(item.productId).trim()
            : null;

        const isInvalidProduct =
          item.isHalfHalf ||
          item.isCombo ||
          !rawProductId ||
          rawProductId.startsWith("half-half-") ||
          rawProductId.startsWith("combo-");

        return {
          productId: isInvalidProduct ? null : rawProductId,
          comboId: item.comboId || null,
          name: buildItemDisplayName(item),
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          isHalfHalf: !!item.isHalfHalf,
          isCombo: !!item.isCombo,
          flavorIds: Array.isArray(item.flavorIds) ? item.flavorIds : [],
          flavorNames: Array.isArray(item.flavorNames) ? item.flavorNames : [],
          comboSelectionsSummary: Array.isArray(item.comboSelectionsSummary)
            ? item.comboSelectionsSummary
            : [],
          additionalIds: Array.isArray(item.additionalIds)
            ? item.additionalIds
            : [],
          additionalNames: Array.isArray(item.additionalNames)
            ? item.additionalNames
            : [],
        };
      });

      const payload = {
        customer: {
          name: customerName.trim(),
          whatsapp: customerWhatsapp.trim(),
          cep: onlyNumbers(customerCep),
          address: customerAddress.trim(),
          number: customerNumber.trim(),
          complement: customerComplement.trim() || null,
          neighborhood: customerNeighborhood.trim(),
          city: customerCity.trim(),
        },
        paymentMethod,
        changeFor: parsedChangeFor,
        observation: observation.trim() || null,
        couponCode: couponApplied?.code || couponCode.trim() || null,
        discountValue: Number(discountValue || 0),
        subtotalAmount: Number(subtotal.toFixed(2)),
        deliveryFee: Number(deliveryFee.toFixed(2)),
        totalAmount: Number(total.toFixed(2)),
        items: normalizedItems,
      };

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id":
            localStorage.getItem("active_company_id") ||
            "b7336aa2-345d-4624-8141-0ea0de084c3d",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("Erro API /api/orders/create:", data);
        alert(data?.error || data?.details || "Erro ao criar pedido");
        return;
      }

      localStorage.removeItem("cart");
      alert("Pedido enviado com sucesso!");
      window.location.href = "/";
    } catch (error) {
      console.error("Erro ao finalizar pedido:", error);
      alert("Erro ao finalizar pedido");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff8f5] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-5 md:py-8">
        <header className="mb-5 rounded-[2rem] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-5 text-white shadow-xl shadow-red-100 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-red-100">
                Finalização segura
              </p>

              <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">
                Finalize seu pedido
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-medium text-red-50 md:text-base">
                Confirme seus dados, aplique cupom e escolha a forma de pagamento.
              </p>
            </div>

            <Link
              href="/carrinho"
              className="w-fit rounded-2xl bg-white/20 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/30"
            >
              ← Voltar ao carrinho
            </Link>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5">
            <div className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-xl">
                  📍
                </div>

                <div>
                  <h2 className="text-xl font-black text-zinc-950">
                    Dados para entrega
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Informe os dados para encontrarmos seu endereço.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Input label="Nome" value={customerName} onChange={setCustomerName} placeholder="Seu nome" />
                <Input label="WhatsApp" value={customerWhatsapp} onChange={setCustomerWhatsapp} placeholder="(11) 99999-9999" />
                <Input label="CEP" value={customerCep} onChange={setCustomerCep} onBlur={searchCep} placeholder="00000-000" />
                <Input label="Endereço" value={customerAddress} onChange={setCustomerAddress} placeholder={isLoadingCep ? "Buscando..." : "Rua / Avenida"} />
                <Input label="Número" value={customerNumber} onChange={setCustomerNumber} placeholder="Número" />
                <Input label="Complemento" value={customerComplement} onChange={setCustomerComplement} placeholder="Apto, bloco, referência" />
                <Input label="Bairro" value={customerNeighborhood} onChange={setCustomerNeighborhood} placeholder="Bairro" />
                <Input label="Cidade" value={customerCity} onChange={setCustomerCity} placeholder="Cidade" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl">
                  🎟️
                </div>

                <div>
                  <h2 className="text-xl font-black text-zinc-950">
                    Cupom de desconto
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Insira um cupom para aplicar desconto no pedido.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Ex: PIZZA10"
                  className="h-14 flex-1 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white"
                />

                <button
                  type="button"
                  onClick={applyCoupon}
                  className="h-14 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700"
                >
                  Aplicar
                </button>
              </div>
              {couponApplied && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-emerald-700">
                        Cupom aplicado
                      </p>

                      <p className="text-sm text-emerald-600">
                        {couponApplied.code}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-zinc-100 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-xl">
                  💳
                </div>

                <div>
                  <h2 className="text-xl font-black text-zinc-950">
                    Pagamento
                  </h2>
                </div>
              </div>

              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="mt-5 h-14 w-full rounded-2xl border border-zinc-200 px-4 font-semibold"
              >
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="DEBITO">Cartão Débito</option>
                <option value="CREDITO">Cartão Crédito</option>
              </select>

              {paymentMethod === "DINHEIRO" && (
                <input
                  value={changeFor}
                  onChange={(e) => setChangeFor(e.target.value)}
                  placeholder="Troco para quanto?"
                  className="mt-4 h-14 w-full rounded-2xl border border-zinc-200 px-4"
                />
              )}

              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Observações do pedido"
                rows={4}
                className="mt-4 w-full rounded-2xl border border-zinc-200 p-4"
              />
            </div>
          </section>

          <aside className="lg:sticky lg:top-5 lg:h-fit">
            <div className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-xl shadow-red-50">
              <h2 className="text-2xl font-black text-zinc-950">
                Resumo do pedido
              </h2>

              <div className="mt-5 space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-zinc-100 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-zinc-900">
                          {item.name}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Quantidade: {item.quantity}
                        </p>
                      </div>

                      <strong className="text-red-600">
                        {formatMoney(
                          Number(item.price) * Number(item.quantity)
                        )}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t pt-5">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Entrega</span>
                  <strong>{formatMoney(deliveryFee)}</strong>
                </div>

                {discountValue > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Desconto</span>
                    <strong>
                      - {formatMoney(discountValue)}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between border-t pt-4 text-xl font-black">
                  <span>Total</span>

                  <span className="text-red-600">
                    {formatMoney(total)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleFinishOrder}
                disabled={isSubmitting || cart.length === 0}
                className="mt-6 h-14 w-full rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 font-black text-white shadow-xl shadow-red-100 transition hover:scale-[1.01] disabled:opacity-50"
              >
                {isSubmitting
                  ? "Enviando pedido..."
                  : "Finalizar Pedido"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-zinc-700">
        {label}
      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-zinc-950 outline-none transition focus:border-red-400 focus:bg-white"
      />
    </div>
  );
}