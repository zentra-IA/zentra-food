"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Additional = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  required: boolean;
  active: boolean;
  sortOrder: number;
};

type ProductAdditionalConfig = {
  additionalId: string;
  required: boolean;
  sortOrder: number;
  additional: Additional;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  categoryPrice?: number;
  imageUrl?: string | null;
  active: boolean;
  inStock: boolean;
  productAdditionalConfigs?: ProductAdditionalConfig[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type?: string | null;
  selectionRequired?: boolean;
  active?: boolean;
  additionals?: Additional[];
  products: Product[];
};

type ComboGroupItem = {
  id: string;
  productId: string;
  sortOrder: number;
  product: Product;
};

type ComboGroup = {
  id: string;
  comboId: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  items: ComboGroupItem[];
};

type ComboAdditionalConfig = {
  additionalId: string;
  required: boolean;
  sortOrder: number;
  additional: Additional;
};

type Combo = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  active: boolean;
  sortOrder: number;
  groups: ComboGroup[];
  comboAdditionalConfigs?: ComboAdditionalConfig[];
};

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

type SelectedTarget =
  | {
      type: "PRODUCT";
      product: Product;
      category: Category | null;
    }
  | {
      type: "HALF_HALF";
      category: Category;
      flavorIds: string[];
      flavorNames: string[];
      basePrice: number;
      name: string;
      productId: string;
    };

function getDisplayPrice(product: Product) {
  return Number(product.categoryPrice ?? product.price ?? 0);
}

function toBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isStoreOpenNow() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 18 || hour < 1;
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedFlavors, setSelectedFlavors] = useState<Product[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(
    null
  );
  const [selectedAdditionals, setSelectedAdditionals] = useState<Additional[]>(
    []
  );
  const [modalQuantity, setModalQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null);
  const [comboSelections, setComboSelections] = useState<
    Record<string, Record<string, number>>
  >({});
  const [comboSearchTerm, setComboSearchTerm] = useState("");
  const [selectedComboAdditionals, setSelectedComboAdditionals] = useState<
    Additional[]
  >([]);
  const [toast, setToast] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const estimatedDelivery = "35–50 min";
  const minimumOrder = 20;
  const storeOpen = isStoreOpenNow();

  useEffect(() => {
    loadData();

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

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  function getCompanyId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("active_company_id") || "";
  }

  function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {};

  if (typeof window === "undefined") {
    return headers;
  }

  const companyId = localStorage.getItem("active_company_id");

  if (companyId && companyId.trim()) {
    headers["x-company-id"] = companyId;
  }

  return headers;
}

  async function loadData() {
    try {
      const [menuRes, combosRes, logoRes] = await Promise.all([
        fetch(`/api/menu?t=${Date.now()}`, {
          cache: "no-store",
          headers: buildHeaders() as HeadersInit,
        }),

        fetch(`/api/combos?t=${Date.now()}`, {
          cache: "no-store",
          headers: buildHeaders() as HeadersInit,
        }),

        fetch(`/api/company/logo?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
          headers: buildHeaders(),
        }),
      ]);

      const [menuData, combosData, logoData] = await Promise.all([
        menuRes.json().catch(() => []),
        combosRes.json().catch(() => []),
        logoRes.json().catch(() => null),
      ]);

      const safeCategories = Array.isArray(menuData) ? menuData : [];

      const safeCombos = Array.isArray(combosData)
        ? combosData.filter((combo) => combo?.active !== false)
        : [];

      setCategories(safeCategories);
      setCombos(safeCombos);

      if (logoData?.success) {
        setLogoUrl(logoData.logoUrl || null);
      }

      const firstActiveCategory = safeCategories.find(
        (category) => category.active !== false
      );

      if (firstActiveCategory) {
        setSelectedCategoryId(firstActiveCategory.id);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setCategories([]);
      setCombos([]);
    }
  }
  function saveCart(nextCart: CartItem[]) {
    setCart(nextCart);
    localStorage.setItem("cart", JSON.stringify(nextCart));
  }

  function getProductAdditionals(product: Product, category?: Category | null) {
    const customConfigs = product.productAdditionalConfigs || [];

    if (customConfigs.length > 0) {
      return customConfigs
        .filter((config) => config.additional?.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
        .map((config) => ({
          ...config.additional,
          required: Boolean(config.required),
          sortOrder: Number(config.sortOrder || 0),
        }));
    }

    return category?.additionals || [];
  }

  function hasAdditionalsForProduct(
    product: Product,
    category?: Category | null
  ) {
    return Boolean(getProductAdditionals(product, category).length);
  }

  function addPlainProductToCart(product: Product) {
    const existing = cart.find(
      (item) =>
        !item.isHalfHalf &&
        !item.isCombo &&
        item.productId === product.id &&
        (!item.additionalIds || item.additionalIds.length === 0)
    );

    if (existing) {
      const nextCart = cart.map((item) =>
        !item.isHalfHalf &&
        !item.isCombo &&
        item.productId === product.id &&
        (!item.additionalIds || item.additionalIds.length === 0)
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );

      saveCart(nextCart);
      showToast("Produto adicionado ao pedido.");
      return;
    }

    const nextCart = [
      ...cart,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        price: getDisplayPrice(product),
        quantity: 1,
        additionalIds: [],
        additionalNames: [],
      },
    ];

    saveCart(nextCart);
    showToast("Produto adicionado ao pedido.");
  }

  function addToCart(product: Product, category?: Category | null) {
    if (hasAdditionalsForProduct(product, category)) {
      openProductOptions(product, category || null);
      return;
    }

    addPlainProductToCart(product);
  }

  function removeFromCart(productId: string) {
    const existing = cart.find(
      (item) =>
        !item.isHalfHalf &&
        !item.isCombo &&
        item.productId === productId &&
        (!item.additionalIds || item.additionalIds.length === 0)
    );

    if (!existing) return;

    if (existing.quantity <= 1) {
      const nextCart = cart.filter(
        (item) =>
          !(
            !item.isHalfHalf &&
            !item.isCombo &&
            item.productId === productId &&
            (!item.additionalIds || item.additionalIds.length === 0)
          )
      );

      saveCart(nextCart);
      return;
    }

    const nextCart = cart.map((item) =>
      !item.isHalfHalf &&
      !item.isCombo &&
      item.productId === productId &&
      (!item.additionalIds || item.additionalIds.length === 0)
        ? { ...item, quantity: item.quantity - 1 }
        : item
    );

    saveCart(nextCart);
  }

  function getProductQuantity(productId: string) {
    const item = cart.find(
      (cartItem) =>
        !cartItem.isHalfHalf &&
        !cartItem.isCombo &&
        cartItem.productId === productId &&
        (!cartItem.additionalIds || cartItem.additionalIds.length === 0)
    );

    return item ? item.quantity : 0;
  }

  function openProductOptions(product: Product, category: Category | null) {
    if (!hasAdditionalsForProduct(product, category)) {
      addPlainProductToCart(product);
      return;
    }

    setSelectedTarget({
      type: "PRODUCT",
      product,
      category,
    });

    setModalQuantity(1);
    setSelectedAdditionals([]);
  }

  function closeOptionsModal() {
    setSelectedTarget(null);
    setSelectedAdditionals([]);
    setModalQuantity(1);
  }

  function toggleAdditional(additional: Additional) {
    setSelectedAdditionals((prev) => {
      const exists = prev.some((item) => item.id === additional.id);

      if (exists) {
        return prev.filter((item) => item.id !== additional.id);
      }

      return [...prev, additional];
    });
  }

  function isAdditionalSelected(additionalId: string) {
    return selectedAdditionals.some((item) => item.id === additionalId);
  }

  const currentAdditionals = useMemo(() => {
    if (!selectedTarget) return [];

    if (selectedTarget.type === "PRODUCT") {
      return getProductAdditionals(
        selectedTarget.product,
        selectedTarget.category
      );
    }

    return selectedTarget.category?.additionals || [];
  }, [selectedTarget]);

  const currentBasePrice = useMemo(() => {
    if (!selectedTarget) return 0;

    if (selectedTarget.type === "PRODUCT") {
      return getDisplayPrice(selectedTarget.product);
    }

    return Number(selectedTarget.basePrice || 0);
  }, [selectedTarget]);

  const additionalTotal = useMemo(() => {
    return selectedAdditionals.reduce(
      (acc, item) => acc + Number(item.price || 0),
      0
    );
  }, [selectedAdditionals]);

  const finalModalPrice = currentBasePrice + additionalTotal;
  const finalModalTotal = finalModalPrice * modalQuantity;

  function validateRequiredAdditionals() {
    const requiredAdditionals = currentAdditionals.filter(
      (item) => item.required
    );

    if (requiredAdditionals.length === 0) return true;

    const missing = requiredAdditionals.some(
      (requiredItem) =>
        !selectedAdditionals.some((selected) => selected.id === requiredItem.id)
    );

    if (missing) {
      alert("Selecione os adicionais obrigatórios.");
      return false;
    }

    return true;
  }

  function confirmSelectedTarget() {
    if (!selectedTarget) return;
    if (!validateRequiredAdditionals()) return;

    if (selectedTarget.type === "PRODUCT") {
      const product = selectedTarget.product;

      const nextCart = [
        ...cart,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          name: product.name,
          price: Number(finalModalPrice),
          quantity: modalQuantity,
          additionalIds: selectedAdditionals.map((item) => item.id),
          additionalNames: selectedAdditionals.map((item) => item.name),
        },
      ];

      saveCart(nextCart);
      closeOptionsModal();
      showToast("Produto adicionado ao pedido.");
      return;
    }

    const nextCart = [
      ...cart,
      {
        id: crypto.randomUUID(),
        productId: selectedTarget.productId,
        name: selectedTarget.name,
        price: Number(finalModalPrice),
        quantity: modalQuantity,
        isHalfHalf: true,
        flavorIds: selectedTarget.flavorIds,
        flavorNames: selectedTarget.flavorNames,
        additionalIds: selectedAdditionals.map((item) => item.id),
        additionalNames: selectedAdditionals.map((item) => item.name),
      },
    ];

    saveCart(nextCart);
    setSelectedFlavors([]);
    closeOptionsModal();
    showToast("Pizza meio a meio adicionada ao pedido.");
  }

  function toggleFlavor(product: Product) {
    setSelectedFlavors((prev) => {
      const exists = prev.find((p) => p.id === product.id);

      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }

      if (prev.length >= 2) {
        alert("Só pode escolher 2 sabores.");
        return prev;
      }

      return [...prev, product];
    });
  }

  function isFlavorSelected(productId: string) {
    return selectedFlavors.some((product) => product.id === productId);
  }

  function getHalfHalfPrice() {
    if (selectedFlavors.length === 0) return 0;

    if (selectedFlavors.length === 1) {
      return getDisplayPrice(selectedFlavors[0]);
    }

    return Math.max(
      getDisplayPrice(selectedFlavors[0]),
      getDisplayPrice(selectedFlavors[1])
    );
  }
  function addHalfHalfToCart() {
    if (selectedFlavors.length !== 2) {
      alert("Selecione 2 sabores para montar a pizza meio a meio.");
      return;
    }

    const flavor1 = selectedFlavors[0];
    const flavor2 = selectedFlavors[1];
    const price = getHalfHalfPrice();

    const halfHalfCategory = selectedCategory;

    if (halfHalfCategory?.additionals?.length) {
      setSelectedTarget({
        type: "HALF_HALF",
        category: halfHalfCategory,
        flavorIds: [flavor1.id, flavor2.id],
        flavorNames: [flavor1.name, flavor2.name],
        basePrice: price,
        name: `Meio a Meio: ${flavor1.name} + ${flavor2.name}`,
        productId: `half-half-${flavor1.id}-${flavor2.id}`,
      });

      setModalQuantity(1);
      setSelectedAdditionals([]);
      return;
    }

    const nextCart = [
      ...cart,
      {
        id: crypto.randomUUID(),
        productId: `half-half-${flavor1.id}-${flavor2.id}`,
        name: `Meio a Meio: ${flavor1.name} + ${flavor2.name}`,
        price,
        quantity: 1,
        isHalfHalf: true,
        flavorIds: [flavor1.id, flavor2.id],
        flavorNames: [flavor1.name, flavor2.name],
        additionalIds: [],
        additionalNames: [],
      },
    ];

    saveCart(nextCart);
    setSelectedFlavors([]);
    showToast("Pizza meio a meio adicionada ao pedido.");
  }

  function openCombo(combo: Combo) {
    const initialSelections: Record<string, Record<string, number>> = {};

    combo.groups.forEach((group) => {
      initialSelections[group.id] = {};
    });

    setSelectedCombo(combo);
    setComboSelections(initialSelections);
    setComboSearchTerm("");
    setSelectedComboAdditionals([]);
  }

  function closeComboModal() {
    setSelectedCombo(null);
    setComboSelections({});
    setComboSearchTerm("");
    setSelectedComboAdditionals([]);
  }

  function getComboGroupTotalSelected(groupId: string) {
    const groupSelections = comboSelections[groupId] || {};

    return Object.values(groupSelections).reduce(
      (total, qty) => total + Number(qty || 0),
      0
    );
  }

  function incrementComboGroupProduct(group: ComboGroup, productId: string) {
    setComboSelections((prev) => {
      const currentGroup = prev[group.id] || {};
      const currentQty = Number(currentGroup[productId] || 0);

      const totalSelected = Object.values(currentGroup).reduce(
        (total, qty) => total + Number(qty || 0),
        0
      );

      if (totalSelected >= group.maxSelect) {
        alert(
          `Você pode escolher no máximo ${group.maxSelect} item(ns) em "${group.name}".`
        );
        return prev;
      }

      return {
        ...prev,
        [group.id]: {
          ...currentGroup,
          [productId]: currentQty + 1,
        },
      };
    });
  }

  function decrementComboGroupProduct(group: ComboGroup, productId: string) {
    setComboSelections((prev) => {
      const currentGroup = prev[group.id] || {};
      const currentQty = Number(currentGroup[productId] || 0);

      if (currentQty <= 0) return prev;

      const nextGroup = { ...currentGroup };

      if (currentQty === 1) {
        delete nextGroup[productId];
      } else {
        nextGroup[productId] = currentQty - 1;
      }

      return {
        ...prev,
        [group.id]: nextGroup,
      };
    });
  }

  function toggleComboAdditional(additional: Additional) {
    setSelectedComboAdditionals((prev) => {
      const exists = prev.find((a) => a.id === additional.id);

      if (exists) {
        return prev.filter((a) => a.id !== additional.id);
      }

      return [...prev, additional];
    });
  }

  function isComboAdditionalSelected(additionalId: string) {
    return selectedComboAdditionals.some((item) => item.id === additionalId);
  }

  function validateComboSelections() {
    if (!selectedCombo) return false;

    for (const group of selectedCombo.groups) {
      const groupSelections = comboSelections[group.id] || {};

      const totalSelected = Object.values(groupSelections).reduce(
        (total, qty) => total + Number(qty || 0),
        0
      );

      if (group.required && totalSelected < group.minSelect) {
        alert(
          `Selecione pelo menos ${group.minSelect} item(ns) em "${group.name}".`
        );
        return false;
      }

      if (totalSelected > group.maxSelect) {
        alert(
          `Você pode escolher no máximo ${group.maxSelect} item(ns) em "${group.name}".`
        );
        return false;
      }
    }

    const requiredComboAdditionals =
      selectedCombo.comboAdditionalConfigs?.filter((config) => config.required) ||
      [];

    if (requiredComboAdditionals.length > 0) {
      const hasMissingRequired = requiredComboAdditionals.some(
        (config) =>
          !selectedComboAdditionals.some(
            (selected) => selected.id === config.additionalId
          )
      );

      if (hasMissingRequired) {
        alert("Selecione os adicionais obrigatórios da promoção.");
        return false;
      }
    }

    return true;
  }

  const comboAdditionalTotal = useMemo(() => {
    return selectedComboAdditionals.reduce(
      (acc, item) => acc + Number(item.price || 0),
      0
    );
  }, [selectedComboAdditionals]);

  const comboFinalPrice = useMemo(() => {
    if (!selectedCombo) return 0;
    return Number(selectedCombo.price || 0) + comboAdditionalTotal;
  }, [selectedCombo, comboAdditionalTotal]);

  function confirmComboToCart() {
    if (!selectedCombo) return;
    if (!validateComboSelections()) return;

    const selectionsSummary: string[] = [];

    selectedCombo.groups.forEach((group) => {
      const groupSelections = comboSelections[group.id] || {};

      const selectedNames = group.items
        .map((item) => {
          const qty = Number(groupSelections[item.productId] || 0);

          if (qty <= 0) return null;

          return qty > 1
            ? `${item.product?.name} x${qty}`
            : item.product?.name;
        })
        .filter(Boolean) as string[];

      if (selectedNames.length > 0) {
        selectionsSummary.push(`${group.name}: ${selectedNames.join(", ")}`);
      }
    });

    if (selectedComboAdditionals.length > 0) {
      selectionsSummary.push(
        `Adicionais: ${selectedComboAdditionals
          .map((item) => item.name)
          .join(", ")}`
      );
    }

    const nextCart = [
      ...cart,
      {
        id: crypto.randomUUID(),
        productId: `combo-${selectedCombo.id}`,
        comboId: selectedCombo.id,
        name: selectedCombo.name,
        price: Number(comboFinalPrice),
        quantity: 1,
        isCombo: true,
        comboSelectionsSummary: selectionsSummary,
        additionalIds: selectedComboAdditionals.map((item) => item.id),
        additionalNames: selectedComboAdditionals.map((item) => item.name),
      },
    ];

    saveCart(nextCart);
    closeComboModal();
    showToast("Promoção adicionada ao pedido.");
  }

  const selectedCategory = useMemo(() => {
    if (selectedCategoryId === "COMBOS") return null;

    return (
      categories.find((category) => category.id === selectedCategoryId) ?? null
    );
  }, [categories, selectedCategoryId]);

  const isHalfHalfCategory = useMemo(() => {
    if (!selectedCategory) return false;

    const categoryName = String(selectedCategory.name || "").toLowerCase();
    const categorySlug = String(selectedCategory.slug || "").toLowerCase();
    const categoryType = String(selectedCategory.type || "").toUpperCase();

    return (
      categoryType === "PIZZA_HALF_HALF" ||
      categorySlug.includes("meio-a-meio") ||
      categoryName.includes("meio a meio")
    );
  }, [selectedCategory]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredProducts =
    selectedCategoryId === "COMBOS"
      ? []
      : (selectedCategory?.products || []).filter((product) => {
          const matchesSearch =
            !normalizedSearch ||
            product.name.toLowerCase().includes(normalizedSearch) ||
            String(product.description || "")
              .toLowerCase()
              .includes(normalizedSearch) ||
            String(selectedCategory?.name || "")
              .toLowerCase()
              .includes(normalizedSearch);

          return product.active && product.inStock && matchesSearch;
        });

  const filteredCombos =
    selectedCategoryId === "COMBOS"
      ? combos.filter((combo) => {
          const matchesSearch =
            !normalizedSearch ||
            String(combo.name || "").toLowerCase().includes(normalizedSearch) ||
            String(combo.description || "")
              .toLowerCase()
              .includes(normalizedSearch);

          return combo?.active !== false && matchesSearch;
        })
      : [];

  const filteredComboGroups = useMemo(() => {
    if (!selectedCombo) return [];

    const normalized = comboSearchTerm.trim().toLowerCase();

    if (!normalized) return selectedCombo.groups;

    return selectedCombo.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const name = String(item.product?.name || "").toLowerCase();
          const description = String(
            item.product?.description || ""
          ).toLowerCase();

          return name.includes(normalized) || description.includes(normalized);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [selectedCombo, comboSearchTerm]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const cartTotal = cart.reduce(
    (total, item) =>
      total + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );

  const remainingToMinimum = Math.max(0, minimumOrder - cartTotal);

  useEffect(() => {
    setSelectedFlavors([]);
  }, [selectedCategoryId]);
  return (
    <main className="min-h-screen bg-[#fff8f5] pb-24 text-zinc-950">
      <header className="sticky top-0 z-50 border-b border-red-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logoUrl || "/logo.jpg"}
                alt="Logo da empresa"
                className="h-10 w-10 rounded-2xl border border-red-100 object-cover shadow-sm"
              />

              <div className="min-w-0">
                <h1 className="truncate text-base font-black text-zinc-950">
                  Zentra app
                </h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      storeOpen
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {storeOpen ? "Aberto agora" : "Fechado"}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                    🚀 {estimatedDelivery}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/carrinho"
              className="shrink-0 rounded-2xl bg-red-600 px-3 py-2 text-sm font-black text-white shadow-lg shadow-red-200"
            >
              🛒 {cartCount}
            </Link>
          </div>

          <div className="mt-3">
            <input
              type="text"
              placeholder="Buscar pizza, bebida, promoção..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3 text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-100"
            />
          </div>
        </div>
      </header>

      <section className="px-3 pt-3">
        <div className="rounded-3xl bg-gradient-to-br from-red-600 to-orange-500 p-4 text-white shadow-xl shadow-red-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-100">
                Cardápio online
              </p>
              <h2 className="mt-1 text-xl font-black leading-tight">
                Peça rápido pelo celular
              </h2>
              <p className="mt-1 text-xs font-medium text-red-50">
                Pedido mínimo {toBRL(minimumOrder)} • Entrega{" "}
                {estimatedDelivery}
              </p>
            </div>
            <div className="rounded-2xl bg-white/20 px-3 py-2 text-center backdrop-blur">
              <p className="text-[10px] font-bold text-red-50">Status</p>
              <p className="text-sm font-black">
                {storeOpen ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-[112px] z-40 overflow-x-auto border-b border-red-100 bg-[#fff8f5]/95 px-3 py-3 backdrop-blur">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategoryId("COMBOS")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
              selectedCategoryId === "COMBOS"
                ? "bg-red-600 text-white shadow-lg shadow-red-100"
                : "border border-red-100 bg-white text-red-600"
            }`}
          >
            🎁 Promoções
          </button>

          {categories
            .filter((category) => category.active !== false)
            .map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategoryId(category.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition ${
                  selectedCategoryId === category.id
                    ? "bg-red-600 text-white shadow-lg shadow-red-100"
                    : "border border-red-100 bg-white text-red-600"
                }`}
              >
                {category.name}
              </button>
            ))}
        </div>
      </nav>

      {selectedCategoryId === "COMBOS" && (
        <section className="px-3 py-4">
          <div className="mb-3 rounded-3xl border border-red-100 bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black text-zinc-950">Promoções</h2>
            <p className="text-sm text-zinc-600">
              Escolha uma promoção e personalize seus itens.
            </p>
            <p className="mt-2 text-xs font-bold text-zinc-400">
              {filteredCombos.length} promoção(ões) disponível(is)
            </p>
          </div>

          <div className="grid gap-3">
            {filteredCombos.length > 0 ? (
              filteredCombos.map((combo) => (
                <article
                  key={combo.id}
                  className="flex gap-3 rounded-3xl border border-red-100 bg-white p-3 shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-red-50 bg-red-50">
                    {combo.imageUrl ? (
                      <img
                        src={combo.imageUrl}
                        alt={combo.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-4xl">🎁</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700">
                      Promoção especial
                    </div>
                    <h2 className="line-clamp-2 text-base font-black text-zinc-950">
                      {combo.name}
                    </h2>
                    <p className="line-clamp-2 text-xs text-zinc-500">
                      {combo.description ||
                        "Monte sua promoção personalizada."}
                    </p>
                    <p className="mt-1 text-lg font-black text-red-600">
                      {toBRL(Number(combo.price))}
                    </p>
                    <button
                      onClick={() => openCombo(combo)}
                      className="mt-2 rounded-2xl bg-red-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-red-100"
                    >
                      Montar promoção
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-red-100 bg-white p-4 text-sm text-zinc-500 shadow-sm">
                Nenhuma promoção disponível no momento.
              </div>
            )}
          </div>
        </section>
      )}

      {selectedCategory && (
        <section className="px-3 pt-4">
          <div className="rounded-3xl border border-red-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-zinc-950">
                  {selectedCategory.name}
                </h2>

                {selectedCategory.description && (
                  <p className="mt-1 text-sm text-zinc-600">
                    {selectedCategory.description}
                  </p>
                )}
              </div>

              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
                {filteredProducts.length} itens
              </span>
            </div>

            {isHalfHalfCategory && (
              <div className="mt-3 rounded-3xl border border-red-100 bg-red-50 p-3">
                <p className="font-black text-zinc-950">
                  Escolha 2 sabores para montar sua pizza meio a meio.
                </p>

                <div className="mt-2 text-sm font-semibold text-zinc-700">
                  {selectedFlavors.length === 0
                    ? "Nenhum sabor selecionado"
                    : selectedFlavors.map((flavor) => flavor.name).join(" + ")}
                </div>

                <div className="mt-2 text-sm font-black text-red-600">
                  Valor atual: {toBRL(getHalfHalfPrice())}
                </div>

                <button
                  onClick={addHalfHalfToCart}
                  disabled={selectedFlavors.length !== 2}
                  className="mt-3 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Adicionar pizza meio a meio
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {selectedCategoryId !== "COMBOS" && (
        <section className="grid gap-3 px-3 py-4">
          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-red-100 bg-white p-4 text-sm text-zinc-500 shadow-sm">
              Nenhum item encontrado para essa busca.
            </div>
          ) : (
            filteredProducts.map((product, index) => {
              const quantity = getProductQuantity(product.id);
              const flavorSelected = isFlavorSelected(product.id);
              const productHasAdditionals = hasAdditionalsForProduct(
                product,
                selectedCategory
              );
              const isFeatured = index === 0 || index === 1;

              return (
                <article
                  key={`${selectedCategoryId}-${product.id}`}
                  className="flex gap-3 rounded-3xl border border-red-100 bg-white p-3 shadow-sm transition active:scale-[0.99]"
                >
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-red-50 bg-red-50">
                    {isFeatured && (
                      <span className="absolute left-1 top-1 z-10 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white shadow">
                        🔥
                      </span>
                    )}
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-4xl">🍕</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {isFeatured && (
                      <div className="mb-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-600">
                        Mais pedido
                      </div>
                    )}

                    <h2 className="line-clamp-2 text-base font-black leading-tight text-zinc-950">
                      {product.name}
                    </h2>
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {product.description || "Produto artesanal da casa."}
                    </p>
                    <p className="mt-1 text-lg font-black text-red-600">
                      {toBRL(getDisplayPrice(product))}
                    </p>

                    {productHasAdditionals && !isHalfHalfCategory && (
                      <p className="mt-1 text-[11px] font-semibold text-zinc-400">
                        Personalize com adicionais
                      </p>
                    )}

                    <div className="mt-2">
                      {isHalfHalfCategory ? (
                        <button
                          onClick={() => toggleFlavor(product)}
                          className={`rounded-2xl px-4 py-2 text-xs font-black transition ${
                            flavorSelected
                              ? "bg-red-600 text-white shadow-md shadow-red-100"
                              : "border border-red-100 bg-white text-red-600"
                          }`}
                        >
                          {flavorSelected ? "Remover" : "Selecionar"}
                        </button>
                      ) : productHasAdditionals ? (
                        <button
                          onClick={() =>
                            openProductOptions(product, selectedCategory)
                          }
                          className="rounded-2xl bg-red-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-red-100"
                        >
                          Adicionar
                        </button>
                      ) : quantity === 0 ? (
                        <button
                          onClick={() => addToCart(product, selectedCategory)}
                          className="rounded-2xl bg-red-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-red-100"
                        >
                          Adicionar
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-2 py-1.5">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 font-black text-white"
                          >
                            -
                          </button>

                          <span className="min-w-[24px] text-center text-sm font-black text-zinc-950">
                            {quantity}
                          </span>

                          <button
                            onClick={() => addToCart(product, selectedCategory)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 font-black text-white"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {selectedTarget && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm md:items-center md:p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-red-100 bg-white shadow-2xl md:rounded-[2rem]">
            <div className="overflow-y-auto overscroll-contain p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-zinc-950">
                    {selectedTarget.type === "PRODUCT"
                      ? selectedTarget.product.name
                      : selectedTarget.name}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-600">
                    Escolha adicionais e quantidade.
                  </p>
                </div>
                <button
                  onClick={closeOptionsModal}
                  className="rounded-full bg-zinc-100 px-3 py-2 text-sm font-black text-zinc-600"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {currentAdditionals.length > 0 ? (
                  currentAdditionals.map((additional) => {
                    const checked = isAdditionalSelected(additional.id);

                    return (
                      <label
                        key={additional.id}
                        className={`flex cursor-pointer items-start justify-between gap-3 rounded-3xl border p-4 transition ${
                          checked
                            ? "border-red-500 bg-red-50"
                            : "border-red-100 bg-white"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-zinc-950">
                            {additional.name}
                            {additional.required ? " *" : ""}
                          </p>

                          {additional.description && (
                            <p className="text-sm text-zinc-500">
                              {additional.description}
                            </p>
                          )}

                          <p className="mt-1 text-sm font-black text-red-600">
                            + {toBRL(Number(additional.price))}
                          </p>
                        </div>

                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAdditional(additional)}
                          className="mt-1 h-6 w-6 shrink-0 accent-red-600"
                        />
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-500">
                    Este item não possui adicionais.
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-3xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-zinc-700">
                    Quantidade
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        setModalQuantity((prev) => Math.max(1, prev - 1))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-black text-red-600 shadow-sm"
                    >
                      -
                    </button>
                    <span className="min-w-[24px] text-center font-black text-zinc-950">
                      {modalQuantity}
                    </span>
                    <button
                      onClick={() => setModalQuantity((prev) => prev + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 font-black text-white shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-red-100 pt-4">
                <div className="flex items-center justify-between text-sm text-zinc-600">
                  <span>Base</span>
                  <span>{toBRL(currentBasePrice)}</span>
                </div>

                <div className="flex items-center justify-between text-sm text-zinc-600">
                  <span>Adicionais</span>
                  <span>{toBRL(additionalTotal)}</span>
                </div>

                <div className="flex items-center justify-between text-xl font-black text-zinc-950">
                  <span>Total</span>
                  <span className="text-red-600">
                    {toBRL(finalModalTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-red-100 bg-white p-4">
              <button
                onClick={closeOptionsModal}
                className="rounded-2xl border border-red-200 bg-white px-4 py-3 font-black text-red-600"
              >
                Cancelar
              </button>

              <button
                onClick={confirmSelectedTarget}
                className="rounded-2xl bg-red-600 px-4 py-3 font-black text-white shadow-lg shadow-red-100"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCombo && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm md:items-center">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] border border-red-100 bg-white p-5 shadow-2xl md:rounded-[2rem] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-zinc-950">
                  {selectedCombo.name}
                </h2>

                {selectedCombo.description && (
                  <p className="mt-1 text-sm text-zinc-600">
                    {selectedCombo.description}
                  </p>
                )}

                <div className="mt-2 text-lg font-black text-red-600">
                  {toBRL(Number(selectedCombo.price))}
                </div>
              </div>
              <button
                onClick={closeComboModal}
                className="rounded-full bg-zinc-100 px-3 py-2 text-sm font-black text-zinc-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <input
                type="text"
                placeholder="Buscar item da promoção..."
                value={comboSearchTerm}
                onChange={(e) => setComboSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-red-400 focus:bg-white"
              />
            </div>

            {selectedCombo.comboAdditionalConfigs &&
              selectedCombo.comboAdditionalConfigs.length > 0 && (
                <div className="mt-5 rounded-3xl border border-red-100 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 font-black text-zinc-950">
                    Adicionais da promoção
                  </h3>

                  <div className="space-y-2">
                    {selectedCombo.comboAdditionalConfigs.map((config) => {
                      const additional = config.additional;
                      const checked = isComboAdditionalSelected(additional.id);

                      return (
                        <label
                          key={additional.id}
                          className={`flex cursor-pointer items-center justify-between rounded-3xl border p-3 ${
                            checked
                              ? "border-red-500 bg-red-50"
                              : "border-red-100 bg-white"
                          }`}
                        >
                          <div>
                            <p className="font-black text-zinc-950">
                              {additional.name}
                              {config.required ? " *" : ""}
                            </p>

                            {additional.description && (
                              <p className="text-sm text-zinc-500">
                                {additional.description}
                              </p>
                            )}

                            <p className="text-sm font-black text-red-600">
                              + {toBRL(Number(additional.price))}
                            </p>
                          </div>

                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleComboAdditional(additional)}
                            className="h-6 w-6 accent-red-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

            <div className="mt-5 space-y-4">
              {filteredComboGroups.length > 0 ? (
                filteredComboGroups
                  .sort(
                    (a, b) =>
                      Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
                  )
                  .map((group) => (
                    <div
                      key={group.id}
                      className="rounded-3xl border border-red-100 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3">
                        <h3 className="font-black text-zinc-950">
                          {group.name}
                          {group.required ? " *" : ""}
                        </h3>
                        <p className="text-sm text-zinc-500">
                          Escolha de {group.minSelect} até {group.maxSelect}{" "}
                          item(ns)
                        </p>
                      </div>

                      <div className="space-y-2">
                        {group.items?.length > 0 ? (
                          group.items.map((item) => {
                            const product = item.product;
                            const qty = Number(
                              (comboSelections[group.id] || {})[
                                item.productId
                              ] || 0
                            );
                            const totalSelected = getComboGroupTotalSelected(
                              group.id
                            );

                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 rounded-3xl border border-red-100 bg-red-50/50 p-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-black text-zinc-950">
                                    {product?.name}
                                  </p>
                                  <p className="line-clamp-2 text-sm text-zinc-500">
                                    {product?.description}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      decrementComboGroupProduct(
                                        group,
                                        item.productId
                                      )
                                    }
                                    disabled={qty <= 0}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white font-black text-red-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    -
                                  </button>

                                  <span className="min-w-[24px] text-center font-black text-zinc-950">
                                    {qty}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      incrementComboGroupProduct(
                                        group,
                                        item.productId
                                      )
                                    }
                                    disabled={totalSelected >= group.maxSelect}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-zinc-500">
                            Nenhum produto configurado neste grupo.
                          </p>
                        )}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="rounded-3xl border border-red-100 bg-white p-4 text-sm text-zinc-500">
                  Nenhum item encontrado nesta busca da promoção.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-3xl border border-red-100 bg-red-50 p-4">
              <div className="flex items-center justify-between text-sm text-zinc-600">
                <span>Promoção</span>
                <span>{toBRL(Number(selectedCombo.price))}</span>
              </div>

              <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                <span>Adicionais</span>
                <span>{toBRL(comboAdditionalTotal)}</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xl font-black text-zinc-950">
                <span>Total</span>
                <span className="text-red-600">{toBRL(comboFinalPrice)}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={closeComboModal}
                className="rounded-2xl border border-red-200 bg-white px-4 py-3 font-black text-red-600"
              >
                Cancelar
              </button>

              <button
                onClick={confirmComboToCart}
                className="rounded-2xl bg-red-600 px-4 py-3 font-black text-white shadow-lg shadow-red-100"
              >
                Adicionar promoção
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 top-4 z-[90] -translate-x-1/2 rounded-full bg-zinc-950 px-4 py-3 text-sm font-black text-white shadow-2xl">
          {toast}
        </div>
      )}

      {cartCount > 0 && (
        <Link
          href="/carrinho"
          className="fixed bottom-4 left-3 right-3 z-50 flex items-center justify-between rounded-3xl bg-red-600 px-5 py-4 font-black text-white shadow-2xl shadow-red-200 transition active:scale-[0.98]"
        >
          <span>🛒 Ver pedido • {cartCount} item(ns)</span>
          <span>{toBRL(cartTotal)}</span>
        </Link>
      )}

      {cartCount > 0 && remainingToMinimum > 0 && (
        <div className="fixed bottom-[82px] left-3 right-3 z-40 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-center text-xs font-bold text-orange-700 shadow-sm">
          Faltam {toBRL(remainingToMinimum)} para o pedido mínimo.
        </div>
      )}
    </main>
  );
}