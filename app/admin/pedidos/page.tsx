"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  email?: string | null;
  address?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  cep?: string | null;
};

type OrderItem = {
  id: string;
  name: string;
  price: number | string;
  quantity: number;
};

type Driver = {
  id: string;
  name: string;
  whatsapp: string;
  active?: boolean;
};

type Order = {
  id: string;
  code?: string | null;
  total: number | string;
  paymentMethod: string;
  observation?: string | null;
  status:
    | "NOVO"
    | "EM_PREPARO"
    | "SAIU_PARA_ENTREGA"
    | "ENTREGUE"
    | "CANCELADO";
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  archivedAt?: string | null;
  changeFor?: string | null;
  channel?: string;
  orderType?: string;
  customer?: Customer | null;
  items?: OrderItem[];
  driverId?: string | null;
  driverName?: string | null;
  deliveryBatchId?: string | null;
  deliveryBatchCode?: string | null;
  deliveryRouteOrder?: number | null;
  dispatchedAt?: string | null;
};

type StatusType =
  | "NOVO"
  | "EM_PREPARO"
  | "SAIU_PARA_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

type PeriodFilter = "HOJE" | "SEMANA" | "MES" | "TODOS";
type StatusFilter =
  | "TODOS"
  | "NOVO"
  | "EM_PREPARO"
  | "SAIU_PARA_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

type RouteMode = "NEAR_TO_FAR" | "FAR_TO_NEAR";

type DispatchPreviewOrder = {
  id: string;
  code: string;
  routeOrder: number;
  total: number;
  paymentMethod: string;
  changeFor?: string | null;
  observation?: string | null;
  customer?: Customer | null;
};

type DispatchPreview = {
  driver: {
    id: string;
    name: string;
    whatsapp: string;
  };
  batchCode: string;
  routeMode: RouteMode;
  mapsUrl: string;
  whatsappMessage: string;
  whatsappUrl: string;
  orders: DispatchPreviewOrder[];
};

const DELAY_MINUTES = 120;

const statusLabels: Record<StatusType, string> = {
  NOVO: "Novo",
  EM_PREPARO: "Em preparo",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const statusBadgeClass: Record<StatusType, string> = {
  NOVO: "bg-zinc-100 text-zinc-700 border-zinc-200",
  EM_PREPARO: "bg-amber-100 text-amber-700 border-amber-200",
  SAIU_PARA_ENTREGA: "bg-blue-100 text-blue-700 border-blue-200",
  ENTREGUE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELADO: "bg-red-100 text-red-700 border-red-200",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("HOJE");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [search, setSearch] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [routeMode, setRouteMode] = useState<RouteMode>("NEAR_TO_FAR");
  const [storeAddress, setStoreAddress] = useState(
    "R. dos Secadouros, 292 - Vila Carmosina, São Paulo - SP, 08270-550"
  );
  const [dispatchPreview, setDispatchPreview] = useState<DispatchPreview | null>(null);
  const [creatingDispatch, setCreatingDispatch] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverWhatsapp, setNewDriverWhatsapp] = useState("");

  const previousOrdersCount = useRef(0);
  const previousDelayedIds = useRef<string[]>([]);
  const audioUnlockedRef = useRef(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    notificationAudioRef.current = new Audio("/notification.mp3");
    notificationAudioRef.current.preload = "auto";

    const unlockAudio = async () => {
      if (audioUnlockedRef.current) return;
      try {
        if (!notificationAudioRef.current) return;
        notificationAudioRef.current.volume = 1;
        await notificationAudioRef.current.play();
        notificationAudioRef.current.pause();
        notificationAudioRef.current.currentTime = 0;
        audioUnlockedRef.current = true;
      } catch {
        // navegador pode bloquear até a primeira interação válida
      }
    };

    const handleUserGesture = () => {
      unlockAudio();
    };

    window.addEventListener("click", handleUserGesture, { passive: true });
    window.addEventListener("touchstart", handleUserGesture, { passive: true });
    window.addEventListener("keydown", handleUserGesture);

    return () => {
      window.removeEventListener("click", handleUserGesture);
      window.removeEventListener("touchstart", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
    };
  }, []);

  useEffect(() => {
    loadOrders();
    loadDrivers();

    const interval = setInterval(async () => {
      try {
        await fetch("/api/orders/archive", {
          method: "POST",
        });
      } catch (error) {
        console.error("Erro ao arquivar automaticamente:", error);
      }

      await loadOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function playNotificationSound() {
    try {
      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio("/notification.mp3");
      }

      notificationAudioRef.current.pause();
      notificationAudioRef.current.currentTime = 0;
      await notificationAudioRef.current.play();
    } catch (error) {
      console.warn("Som bloqueado ou arquivo não encontrado:", error);
    }
  }

  function isDelayedOrder(order: Order) {
    if (order.archived) return false;
    if (order.status !== "EM_PREPARO") return false;

    const updatedAtDate = new Date(order.updatedAt || order.createdAt);
    const now = new Date();

    const diffMs = now.getTime() - updatedAtDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    return diffMinutes >= DELAY_MINUTES;
  }

  async function loadOrders() {
    try {
      const res = await fetch("/api/orders/list", { cache: "no-store" });
      const data = await res.json();

      if (Array.isArray(data)) {
        const currentActiveCount = data.filter(
          (order: Order) => !order.archived
        ).length;

        const delayedIdsNow = data
          .filter((order: Order) => isDelayedOrder(order))
          .map((order: Order) => order.id);

        const previousDelayedSet = new Set(previousDelayedIds.current);
        const hasNewDelayedOrder = delayedIdsNow.some(
          (id) => !previousDelayedSet.has(id)
        );

        if (
          previousOrdersCount.current > 0 &&
          currentActiveCount > previousOrdersCount.current
        ) {
          await playNotificationSound();
        }

        if (hasNewDelayedOrder) {
          await playNotificationSound();
          alert("Atenção: existe pedido em atraso no funil.");
        }

        previousOrdersCount.current = currentActiveCount;
        previousDelayedIds.current = delayedIdsNow;
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      setOrders([]);
    }
  }

  async function loadDrivers() {
    try {
      const res = await fetch("/api/drivers/list", { cache: "no-store" });
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar motoqueiros:", error);
      setDrivers([]);
    }
  }

  function getOrderCode(order: Order | DispatchPreviewOrder) {
    return order.code || `PED-${String(order.id).slice(0, 8)}`;
  }

  function toMoney(value: unknown) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/\s/g, "").replace("R$", "").trim();

      if (!cleaned) return 0;

      const hasComma = cleaned.includes(",");
      const normalized = hasComma
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned;

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  function getItemsTotal(order: Order) {
    if (!order.items || order.items.length === 0) return 0;

    return order.items.reduce((acc, item) => {
      return acc + toMoney(item.price) * Number(item.quantity || 0);
    }, 0);
  }

  function getOrderTotal(order: Order) {
    const savedTotal = toMoney(order.total);
    const itemsTotal = getItemsTotal(order);

    if (savedTotal > 0) return savedTotal;
    if (itemsTotal > 0) return itemsTotal;
    return 0;
  }

  function formatAddress(customer?: Customer | null) {
    if (!customer) return "Cliente não encontrado";

    const address = String(customer.address || "").trim();
    const number = String(customer.number || "").trim();
    const complement = String(customer.complement || "").trim();
    const neighborhood = String(customer.neighborhood || "").trim();
    const city = String(customer.city || "").trim();
    const cep = String(customer.cep || "").trim();

    const line1 = [address, number].filter(Boolean).join(", ");
    const line1WithComplement = [line1, complement].filter(Boolean).join(" - ");
    const line2 = [neighborhood, city].filter(Boolean).join(" - ");

    const finalParts = [
      line1WithComplement,
      line2,
      cep ? `CEP: ${cep}` : "",
    ].filter(Boolean);

    return finalParts.length > 0
      ? finalParts.join(" | ")
      : "Endereço não informado";
  }

  function getWhatsappMessage(order: Order) {
    const nome = order.customer?.name || "cliente";
    const pedido = getOrderCode(order);

    return `Olá, ${nome}! 🛵\n\nSeu pedido ${pedido} saiu para entrega e em breve estará com você.\nAgradecemos muito a sua preferência.\n\nQualquer dúvida, estamos à disposição!`;
  }

  function openWhatsapp(order: Order) {
    if (!order.customer?.whatsapp) return;

    const phone = order.customer.whatsapp.replace(/\D/g, "");
    const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;
    const message = getWhatsappMessage(order);
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  }

  function printOrder(order: Order) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const orderTotal = getOrderTotal(order);

    const itemsHtml =
      order.items
        ?.map(
          (item) => `
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
              <span>${item.quantity}x ${item.name}</span>
              <span>R$ ${(toMoney(item.price) * Number(item.quantity)).toFixed(2)}</span>
            </div>
          `
        )
        .join("") || "";

    printWindow.document.write(`
      <html>
        <head>
          <title>Pedido ${getOrderCode(order)}</title>
          <style>
            body { font-family: monospace; width: 300px; margin: 0; padding: 10px; color: #000; }
            h2, p { margin: 0 0 6px 0; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h2 class="center">Pizzaria KMCL</h2>
          <p class="center">Recibo do Pedido</p>
          <div class="divider"></div>
          <p><strong>Pedido:</strong> ${getOrderCode(order)}</p>
          <p><strong>Cliente:</strong> ${order.customer?.name || ""}</p>
          <p><strong>WhatsApp:</strong> ${order.customer?.whatsapp || ""}</p>
          <p><strong>Endereço:</strong> ${formatAddress(order.customer)}</p>
          <div class="divider"></div>
          <p><strong>Itens:</strong></p>
          ${itemsHtml}
          <div class="divider"></div>
          <p><strong>Total:</strong> R$ ${orderTotal.toFixed(2)}</p>
          <p><strong>Pagamento:</strong> ${order.paymentMethod}</p>
          <p><strong>Status:</strong> ${order.status}</p>
          ${order.changeFor ? `<p><strong>Troco para:</strong> R$ ${order.changeFor}</p>` : ""}
          ${order.observation ? `<p><strong>Obs:</strong> ${order.observation}</p>` : ""}
          <div class="divider"></div>
          <p class="center">Obrigado pela preferência!</p>
          <script>window.print(); window.onafterprint = () => window.close();</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  async function updateStatus(order: Order, status: StatusType) {
    try {
      setLoadingId(order.id);

      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, status }),
      });

      await res.json().catch(() => null);

      if (!res.ok) {
        alert("Erro ao atualizar status");
        return;
      }

      await loadOrders();

      if (status === "SAIU_PARA_ENTREGA") {
        openWhatsapp(order);
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar status");
    } finally {
      setLoadingId(null);
    }
  }

  async function deleteOrder(orderId: string) {
    try {
      const confirmed = confirm("Tem certeza que deseja excluir este pedido?");
      if (!confirmed) return;

      setLoadingId(orderId);

      const res = await fetch("/api/orders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      await res.json().catch(() => null);

      if (!res.ok) {
        alert("Erro ao excluir pedido");
        return;
      }

      await loadOrders();
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      alert("Erro ao excluir pedido");
    } finally {
      setLoadingId(null);
    }
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }

  function clearDispatchState() {
    setDispatchModalOpen(false);
    setSelectedDriverId("");
    setRouteMode("NEAR_TO_FAR");
    setDispatchPreview(null);
    setSelectedOrderIds([]);
    setCreatingDispatch(false);
  }

  async function createDriver() {
    try {
      if (!newDriverName.trim()) {
        alert("Informe o nome do motoqueiro");
        return;
      }

      if (!newDriverWhatsapp.trim()) {
        alert("Informe o WhatsApp do motoqueiro");
        return;
      }

      const res = await fetch("/api/drivers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDriverName, whatsapp: newDriverWhatsapp }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao cadastrar motoqueiro");
        return;
      }

      setNewDriverName("");
      setNewDriverWhatsapp("");
      await loadDrivers();
      setSelectedDriverId(data.id);
    } catch (error) {
      console.error("Erro ao criar motoqueiro:", error);
      alert("Erro ao criar motoqueiro");
    }
  }

  async function generateDispatchPreview() {
    try {
      if (!selectedOrderIds.length) {
        alert("Selecione ao menos um pedido");
        return;
      }

      if (!selectedDriverId) {
        alert("Selecione um motoqueiro");
        return;
      }

      setCreatingDispatch(true);

      const res = await fetch("/api/orders/dispatch-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrderIds, driverId: selectedDriverId, routeMode, storeAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao gerar preview");
        return;
      }

      setDispatchPreview(data);
    } catch (error) {
      console.error("Erro ao gerar preview:", error);
      alert("Erro ao gerar preview");
    } finally {
      setCreatingDispatch(false);
    }
  }

  async function confirmDispatch() {
    try {
      if (!dispatchPreview) {
        alert("Gere o preview antes de confirmar");
        return;
      }

      setCreatingDispatch(true);

      const res = await fetch("/api/orders/dispatch-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: dispatchPreview.orders.map((order) => order.id),
          orderedIds: dispatchPreview.orders.map((order) => order.id),
          driverId: dispatchPreview.driver.id,
          routeMode: dispatchPreview.routeMode,
          mapsUrl: dispatchPreview.mapsUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao confirmar despacho");
        return;
      }

      if (dispatchPreview.whatsappUrl) {
        window.open(dispatchPreview.whatsappUrl, "_blank");
      }

      await loadOrders();
      clearDispatchState();
    } catch (error) {
      console.error("Erro ao confirmar despacho:", error);
      alert("Erro ao confirmar despacho");
    } finally {
      setCreatingDispatch(false);
    }
  }

  function isToday(dateString: string) {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function isThisWeek(dateString: string) {
    const date = new Date(dateString);
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(today.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return date >= startOfWeek && date < endOfWeek;
  }

  function isThisMonth(dateString: string) {
    const date = new Date(dateString);
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  }

  function getDayLabel(date: Date) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }

  function canSelectForDispatch(order: Order) {
    return !order.archived && order.status === "EM_PREPARO";
  }

  const activeOrders = useMemo(() => orders.filter((order) => !order.archived), [orders]);
  const archivedOrders = useMemo(() => orders.filter((order) => order.archived), [orders]);

  const periodFilteredOrders = useMemo(() => {
    if (periodFilter === "TODOS") return orders;
    if (periodFilter === "HOJE") return orders.filter((o) => isToday(o.createdAt));
    if (periodFilter === "SEMANA") return orders.filter((o) => isThisWeek(o.createdAt));
    if (periodFilter === "MES") return orders.filter((o) => isThisMonth(o.createdAt));
    return orders;
  }, [orders, periodFilter]);

  const searchFilteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return periodFilteredOrders;

    return periodFilteredOrders.filter((order) => {
      const nome = order.customer?.name?.toLowerCase() || "";
      const whatsapp = order.customer?.whatsapp?.toLowerCase() || "";
      const number = getOrderCode(order).toLowerCase();
      const driverName = order.driverName?.toLowerCase() || "";
      return nome.includes(term) || whatsapp.includes(term) || number.includes(term) || driverName.includes(term);
    });
  }, [periodFilteredOrders, search]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "TODOS") return searchFilteredOrders;
    return searchFilteredOrders.filter((o) => o.status === statusFilter);
  }, [searchFilteredOrders, statusFilter]);

  const filteredActiveOrders = useMemo(() => filteredOrders.filter((order) => !order.archived), [filteredOrders]);
  const filteredArchivedOrders = useMemo(() => filteredOrders.filter((order) => order.archived), [filteredOrders]);

  const todayOrders = useMemo(() => orders.filter((order) => isToday(order.createdAt)), [orders]);
  const deliveredTodayOrders = useMemo(() => todayOrders.filter((order) => order.status === "ENTREGUE"), [todayOrders]);
  const canceledTodayOrders = useMemo(() => todayOrders.filter((order) => order.status === "CANCELADO"), [todayOrders]);

  const totalRevenue = useMemo(() => deliveredTodayOrders.reduce((acc, order) => acc + getOrderTotal(order), 0), [deliveredTodayOrders]);
  const averageTicket = useMemo(() => deliveredTodayOrders.length === 0 ? 0 : totalRevenue / deliveredTodayOrders.length, [deliveredTodayOrders, totalRevenue]);

  const inProgressOrders = useMemo(() => {
    return activeOrders.filter((o) => o.status === "NOVO" || o.status === "EM_PREPARO" || o.status === "SAIU_PARA_ENTREGA");
  }, [activeOrders]);

  const archivedTodayCount = useMemo(() => archivedOrders.filter((order) => isToday(order.createdAt)).length, [archivedOrders]);

  const revenueLast7Days = useMemo(() => {
    const result: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const deliveredFromDay = orders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return order.status === "ENTREGUE" && orderDate.toDateString() === day.toDateString();
      });
      const total = deliveredFromDay.reduce((acc, order) => acc + getOrderTotal(order), 0);
      result.push({ label: getDayLabel(day), value: total });
    }
    return result;
  }, [orders]);

  const maxRevenue = useMemo(() => {
    const max = Math.max(...revenueLast7Days.map((d) => d.value), 0);
    return max === 0 ? 1 : max;
  }, [revenueLast7Days]);

  const novoOrders = useMemo(() => filteredActiveOrders.filter((order) => order.status === "NOVO"), [filteredActiveOrders]);
  const atrasoOrders = useMemo(() => filteredActiveOrders.filter((order) => isDelayedOrder(order)), [filteredActiveOrders]);
  const preparoOrders = useMemo(() => filteredActiveOrders.filter((order) => order.status === "EM_PREPARO" && !isDelayedOrder(order)), [filteredActiveOrders]);
  const entregaOrders = useMemo(() => filteredActiveOrders.filter((order) => order.status === "SAIU_PARA_ENTREGA"), [filteredActiveOrders]);
  const entregueOrders = useMemo(() => filteredActiveOrders.filter((order) => order.status === "ENTREGUE"), [filteredActiveOrders]);
  const canceladoOrders = useMemo(() => filteredActiveOrders.filter((order) => order.status === "CANCELADO"), [filteredActiveOrders]);

  function exportCSV() {
    const header = ["Pedido", "Cliente", "WhatsApp", "Total", "Pagamento", "Status", "Arquivado", "Criado em", "Motoqueiro", "Lote", "Ordem da rota"];
    const rows = filteredOrders.map((order) => [
      getOrderCode(order),
      order.customer?.name || "",
      order.customer?.whatsapp || "",
      getOrderTotal(order).toFixed(2),
      order.paymentMethod,
      order.status,
      order.archived ? "SIM" : "NAO",
      new Date(order.createdAt).toLocaleString("pt-BR"),
      order.driverName || "",
      order.deliveryBatchCode || "",
      order.deliveryRouteOrder || "",
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "pedidos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function renderItems(order: Order) {
    if (!order.items || order.items.length === 0) return null;

    return (
      <div className="mt-3 rounded-2xl bg-zinc-50 p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">Itens</p>
        <ul className="space-y-1 text-sm text-zinc-700">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="min-w-0 flex-1">{item.quantity}x {item.name}</span>
              <span className="shrink-0 font-bold text-zinc-950">{formatBRL(toMoney(item.price) * Number(item.quantity))}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function getDelayText(order: Order) {
    if (!isDelayedOrder(order)) return null;
    const baseDate = new Date(order.updatedAt || order.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - baseDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} min em preparo`;
  }

  function renderOrderCard(order: Order, archivedView = false) {
    const delayText = getDelayText(order);
    const orderStatus = order.status as StatusType;

    return (
      <article key={order.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black text-zinc-950">{getOrderCode(order)}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusBadgeClass[orderStatus]}`}>
                {statusLabels[orderStatus]}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString("pt-BR")}</p>
          </div>

          {canSelectForDispatch(order) && !archivedView && (
            <label className="flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
              <input type="checkbox" checked={selectedOrderIds.includes(order.id)} onChange={() => toggleOrderSelection(order.id)} className="accent-emerald-600" />
              Rota
            </label>
          )}
        </div>

        {delayText && (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-700">
            ⚠️ Atraso: {delayText}
          </div>
        )}

        <div className="space-y-2 text-sm text-zinc-700">
          <p><span className="font-black text-zinc-950">Cliente:</span> {order.customer?.name || "Não encontrado"}</p>
          <p><span className="font-black text-zinc-950">WhatsApp:</span> {order.customer?.whatsapp || "Não informado"}</p>
          <p className="line-clamp-3"><span className="font-black text-zinc-950">Endereço:</span> {formatAddress(order.customer)}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black text-white ${order.channel === "LOJA" ? "bg-purple-600" : "bg-blue-600"}`}>
            {order.channel === "LOJA" ? "Loja / PDV" : "Online"}
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-700">
            {order.orderType === "PICKUP" ? "Retirada" : order.orderType === "DINE_IN" ? "Local" : "Entrega"}
          </span>
          {order.driverName && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">🛵 {order.driverName}</span>}
          {order.deliveryBatchCode && <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-black text-white">{order.deliveryBatchCode}</span>}
        </div>

        {renderItems(order)}

        {order.observation && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span className="font-black">Obs:</span> {order.observation}
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-zinc-950 p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Total</span>
            <span className="text-xl font-black">{formatBRL(getOrderTotal(order))}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm text-zinc-300">
            <span>Pagamento</span>
            <span className="font-bold text-white">{order.paymentMethod}</span>
          </div>
          {order.changeFor && (
            <div className="mt-1 flex items-center justify-between text-sm text-zinc-300">
              <span>Troco para</span>
              <span className="font-bold text-white">R$ {order.changeFor}</span>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {!archivedView && (
            <>
              <button onClick={() => updateStatus(order, "NOVO")} disabled={loadingId === order.id} className="rounded-2xl bg-zinc-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Novo</button>
              <button onClick={() => updateStatus(order, "EM_PREPARO")} disabled={loadingId === order.id} className="rounded-2xl bg-amber-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Preparo</button>
              <button onClick={() => updateStatus(order, "SAIU_PARA_ENTREGA")} disabled={loadingId === order.id} className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Entrega</button>
              <button onClick={() => updateStatus(order, "ENTREGUE")} disabled={loadingId === order.id} className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Entregue</button>
              <button onClick={() => updateStatus(order, "CANCELADO")} disabled={loadingId === order.id} className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Cancelar</button>
            </>
          )}

          {order.customer?.whatsapp && (
            <button onClick={() => openWhatsapp(order)} className="rounded-2xl bg-green-600 px-3 py-2 text-xs font-black text-white">WhatsApp</button>
          )}
          <button onClick={() => printOrder(order)} className="rounded-2xl bg-zinc-950 px-3 py-2 text-xs font-black text-white">Imprimir</button>
          <button onClick={() => deleteOrder(order.id)} disabled={loadingId === order.id} className="rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50">Excluir</button>
        </div>
      </article>
    );
  }

  function renderColumn(title: string, ordersList: Order[], colorClass: string, icon: string) {
    return (
      <section className="min-w-[310px] rounded-[2rem] border border-zinc-200 bg-white/70 p-3 shadow-sm backdrop-blur xl:min-w-0">
        <div className={`mb-3 rounded-3xl px-4 py-3 text-white ${colorClass}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-black">{icon} {title}</h2>
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-black">{ordersList.length}</span>
          </div>
        </div>

        <div className="space-y-3">
          {ordersList.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">
              Nenhum pedido nesta etapa.
            </div>
          ) : (
            ordersList.map((order) => renderOrderCard(order))
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-zinc-950">
      <div className="mx-auto max-w-[1800px] p-3 md:p-6">
        <header className="mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-700 p-5 text-white shadow-2xl md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-red-200">Zentra Operação</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Painel de Pedidos</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-200">Funil operacional para cozinha, balcão, delivery, despacho e histórico.</p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white/10 p-2 backdrop-blur md:min-w-[420px]">
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <p className="text-xs text-zinc-300">Hoje</p>
                <p className="text-2xl font-black">{todayOrders.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <p className="text-xs text-zinc-300">Ativos</p>
                <p className="text-2xl font-black">{inProgressOrders.length}</p>
              </div>
              <div className="rounded-2xl bg-red-600 p-3 text-center shadow-lg">
                <p className="text-xs text-red-100">Faturamento</p>
                <p className="text-xl font-black">{formatBRL(totalRevenue)}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Pedidos hoje" value={String(todayOrders.length)} />
          <MetricCard label="Faturamento hoje" value={formatBRL(totalRevenue)} />
          <MetricCard label="Ticket médio" value={formatBRL(averageTicket)} />
          <MetricCard label="Em andamento" value={String(inProgressOrders.length)} />
          <MetricCard label="Cancelados hoje" value={String(canceledTodayOrders.length)} />
          <MetricCard label="Arquivados hoje" value={String(archivedTodayCount)} />
        </section>

        <section className="mb-5 grid gap-4 xl:grid-cols-[0.7fr_0.3fr]">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Faturamento dos últimos 7 dias</h2>
                <p className="text-sm text-zinc-500">Só conta pedidos entregues.</p>
              </div>
            </div>

            <div className="flex h-56 items-end gap-2 overflow-x-auto rounded-3xl bg-zinc-50 p-3">
              {revenueLast7Days.map((day) => {
                const height = (day.value / maxRevenue) * 100;
                return (
                  <div key={day.label} className="flex min-w-[54px] flex-1 flex-col items-center">
                    <div className="mb-2 text-[11px] font-black text-zinc-600">{formatBRL(day.value)}</div>
                    <div className="flex h-40 w-full items-end">
                      <div className="w-full rounded-t-2xl bg-gradient-to-t from-red-600 to-orange-400 shadow-md transition-all" style={{ height: `${height}%` }} />
                    </div>
                    <div className="mt-2 text-xs font-black uppercase text-zinc-500">{day.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className="text-xl font-black">Filtros</h2>
            <p className="mb-4 text-sm text-zinc-500">Busque e organize o funil.</p>
            <div className="space-y-3">
              <input type="text" placeholder="Cliente, WhatsApp, pedido..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" />
              <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-red-500">
                <option value="HOJE">Hoje</option>
                <option value="SEMANA">Semana</option>
                <option value="MES">Mês</option>
                <option value="TODOS">Todos</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-red-500">
                <option value="TODOS">Todos</option>
                <option value="NOVO">Novo</option>
                <option value="EM_PREPARO">Em preparo</option>
                <option value="SAIU_PARA_ENTREGA">Saiu para entrega</option>
                <option value="ENTREGUE">Entregue</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportCSV} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">CSV</button>
                <button onClick={() => { setSearch(""); setPeriodFilter("HOJE"); setStatusFilter("TODOS"); }} className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">Limpar</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">Pedidos ativos</h2>
              <p className="text-sm text-zinc-500">Arraste lateralmente no celular para ver todas as etapas.</p>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3 xl:grid xl:grid-cols-6 xl:overflow-visible">
            {renderColumn("Novos", novoOrders, "bg-zinc-800", "🆕")}
            {renderColumn("Preparo", preparoOrders, "bg-amber-500", "🍳")}
            {renderColumn("Atraso", atrasoOrders, "bg-red-700", "⚠️")}
            {renderColumn("Entrega", entregaOrders, "bg-blue-600", "🛵")}
            {renderColumn("Entregues", entregueOrders, "bg-emerald-600", "✅")}
            {renderColumn("Cancelados", canceladoOrders, "bg-red-500", "❌")}
          </div>
        </section>

        <section className="pb-28">
          <h2 className="mb-4 text-2xl font-black">Histórico / Arquivados</h2>
          {filteredArchivedOrders.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-zinc-500 shadow-sm">Nenhum pedido arquivado encontrado.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredArchivedOrders.map((order) => renderOrderCard(order, true))}
            </div>
          )}
        </section>
      </div>

      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[94%] max-w-xl -translate-x-1/2 flex-col gap-3 rounded-3xl bg-zinc-950 px-4 py-4 text-white shadow-2xl sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-black">{selectedOrderIds.length} pedido(s) selecionado(s)</span>
          <div className="flex gap-2">
            <button onClick={() => setDispatchModalOpen(true)} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black sm:flex-none">Despachar</button>
            <button onClick={() => setSelectedOrderIds([])} className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-black sm:flex-none">Limpar</button>
          </div>
        </div>
      )}

      {dispatchModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center md:p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-white p-4 text-zinc-950 shadow-2xl md:rounded-[2rem] md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Despacho</p>
                <h2 className="text-2xl font-black">Despachar pedidos</h2>
                <p className="text-sm text-zinc-500">Escolha o motoqueiro, gere a rota e confirme a saída.</p>
              </div>
              <button onClick={clearDispatchState} className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-700">✕</button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="mb-3 font-black">Motoqueiro</h3>
                  <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} className="mb-3 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none">
                    <option value="">Selecione</option>
                    {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} - {driver.whatsapp}</option>)}
                  </select>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input type="text" placeholder="Novo motoqueiro" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none" />
                    <input type="text" placeholder="WhatsApp" value={newDriverWhatsapp} onChange={(e) => setNewDriverWhatsapp(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none" />
                  </div>
                  <button onClick={createDriver} className="mt-3 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">Cadastrar motoqueiro</button>
                </div>

                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="mb-3 font-black">Rota</h3>
                  <label className="mb-1 block text-xs font-black uppercase text-zinc-500">Endereço da pizzaria</label>
                  <input type="text" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} className="mb-3 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none" />
                  <label className="mb-1 block text-xs font-black uppercase text-zinc-500">Ordem</label>
                  <select value={routeMode} onChange={(e) => setRouteMode(e.target.value as RouteMode)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none">
                    <option value="NEAR_TO_FAR">Mais perto → mais longe</option>
                    <option value="FAR_TO_NEAR">Mais longe → mais perto</option>
                  </select>
                  <button onClick={generateDispatchPreview} disabled={creatingDispatch} className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Gerar preview</button>
                </div>

                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="mb-3 font-black">Pedidos selecionados</h3>
                  <div className="space-y-2 text-sm">
                    {orders.filter((order) => selectedOrderIds.includes(order.id)).map((order) => (
                      <div key={order.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <p className="font-black">{getOrderCode(order)}</p>
                        <p>{order.customer?.name || "Sem cliente"}</p>
                        <p className="text-zinc-500">{formatAddress(order.customer)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 font-black">Preview do despacho</h3>
                {!dispatchPreview ? (
                  <p className="text-sm text-zinc-500">Gere o preview para ver a rota e a mensagem.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-3xl bg-zinc-50 p-4 text-sm">
                      <p><strong>Lote:</strong> {dispatchPreview.batchCode}</p>
                      <p><strong>Motoqueiro:</strong> {dispatchPreview.driver.name}</p>
                      <p><strong>Ordem:</strong> {dispatchPreview.routeMode === "NEAR_TO_FAR" ? "Mais perto → mais longe" : "Mais longe → mais perto"}</p>
                    </div>
                    <div className="space-y-2">
                      {dispatchPreview.orders.map((order) => (
                        <div key={order.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                          <p className="font-black">{order.routeOrder}. {order.code}</p>
                          <p>{order.customer?.name}</p>
                          <p className="text-zinc-500">{formatAddress(order.customer)}</p>
                          <p>Pagamento: {order.paymentMethod}</p>
                          <p>Total: {formatBRL(Number(order.total || 0))}</p>
                          {order.changeFor && <p>Troco para: {order.changeFor}</p>}
                        </div>
                      ))}
                    </div>
                    {dispatchPreview.mapsUrl && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => window.open(dispatchPreview.mapsUrl, "_blank")} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">Maps</button>
                        <button onClick={() => navigator.clipboard.writeText(dispatchPreview.mapsUrl)} className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-black">Copiar rota</button>
                      </div>
                    )}
                    <textarea readOnly value={dispatchPreview.whatsappMessage} className="min-h-[220px] w-full rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                      {dispatchPreview.whatsappUrl && <button onClick={() => window.open(dispatchPreview.whatsappUrl, "_blank")} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">WhatsApp</button>}
                      <button onClick={confirmDispatch} disabled={creatingDispatch} className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Confirmar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-zinc-950">{value}</p>
    </div>
  );
}
