import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ============================================================
   TYPES
   ============================================================ */

/** Front-end order statuses (mapped from backend statuses) */
export type ClientOrderStatus = "Work" | "Pbook" | "Book" | "Done";

export type ActiveOrder = {
  orderId: string;
  restaurantId: string;
  status: ClientOrderStatus;
  items: Array<{ name: string; price: number; qnt: number }>;
  total: number;
  paymentMethod: "qr_prompt_pay" | "cash";
  deliveryType: "pickup" | "delivery";
  createdAt: string; // ISO string
};

type OrderContextValue = {
  activeOrder: ActiveOrder | null;
  setActiveOrder: (order: ActiveOrder | null) => void;
  clearOrder: () => void;
  /** Cancel the active order (calls backend CANCELLED) and clear locally */
  cancelOrder: () => void;
  /** True when order is in Work or Pbook — needs user action */
  needsAttention: boolean;
  /** Open/close state for ClientOrderModal */
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const OrderContext = createContext<OrderContextValue | null>(null);

const STORAGE_KEY = "lfp_active_order_v1";
const API_URL =
  import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";
const POLL_INTERVAL_MS = 10_000;

/* ============================================================
   STATUS MAPPING
   ============================================================ */

/**
 * Map backend status + payment_method → client-facing status.
 *
 * Backend flow: NEW → CONFIRMED → PAID → DONE | CANCELLED
 *
 * Client mapping:
 *   NEW       + cash           → Work   (needs manager confirmation)
 *   NEW       + qr_prompt_pay  → Pbook  (needs payment, QR shown)
 *   CONFIRMED + cash           → Book   (confirmed, cooking)
 *   CONFIRMED + qr_prompt_pay  → Pbook  (confirmed, still needs payment)
 *   PAID                       → Book   (paid, cooking)
 *   DONE                       → Done   (ready)
 *   CANCELLED                  → clear order
 */
function mapBackendStatus(
  backendStatus: string,
  paymentMethod: string
): ClientOrderStatus | null {
  const s = backendStatus.toUpperCase();
  if (s === "CANCELLED") return null; // order cancelled → clear
  if (s === "DONE") return "Done";
  if (s === "PAID") return "Book";
  if (s === "CONFIRMED") {
    // Manager confirmed — cash orders can start cooking, QR still need payment
    if (paymentMethod === "cash") return "Book";
    return "Pbook"; // qr_prompt_pay — still waiting for payment
  }
  // NEW or anything else
  if (paymentMethod === "cash") return "Work";
  return "Pbook"; // qr_prompt_pay
}

/* ============================================================
   PERSISTENCE HELPERS
   ============================================================ */

function loadFromStorage(): ActiveOrder | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveOrder;
  } catch {
    return null;
  }
}

function saveToStorage(order: ActiveOrder | null) {
  try {
    if (order) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/* ============================================================
   PROVIDER
   ============================================================ */

export function OrderProvider({ children }: { children: ReactNode }) {
  const [activeOrder, setActiveOrderRaw] = useState<ActiveOrder | null>(
    loadFromStorage
  );
  const [modalOpen, setModalOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist on every change
  const setActiveOrder = useCallback((order: ActiveOrder | null) => {
    setActiveOrderRaw(order);
    saveToStorage(order);
  }, []);

  const clearOrder = useCallback(() => {
    setActiveOrderRaw(null);
    saveToStorage(null);
    setModalOpen(false);
  }, []);

  const cancelOrder = useCallback(async () => {
    if (!activeOrder) return;
    try {
      await fetch(
        `${API_URL}/api/${activeOrder.restaurantId}/orders/${activeOrder.orderId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        }
      );
    } catch {
      // Even if backend fails, clear locally
    }
    setActiveOrderRaw(null);
    saveToStorage(null);
    setModalOpen(false);
  }, [activeOrder]);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // ── Polling: fetch order status from backend ──────────────
  useEffect(() => {
    if (!activeOrder) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    // If order is already in a terminal state (Book/Done), no need to poll
    if (activeOrder.status === "Book" || activeOrder.status === "Done") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/${activeOrder.restaurantId}/orders/${activeOrder.orderId}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          order?: {
            order_id?: string;
            status?: string;
            payment_method?: string;
          };
        };
        const backendOrder = data.order;
        if (!backendOrder) return;

        const newStatus = mapBackendStatus(
          backendOrder.status || "NEW",
          activeOrder.paymentMethod
        );

        if (newStatus === null) {
          // Order was cancelled
          clearOrder();
          return;
        }

        if (newStatus !== activeOrder.status) {
          setActiveOrder({ ...activeOrder, status: newStatus });
        }
      } catch {
        // Network error — silently retry next interval
      }
    };

    // Poll immediately, then on interval
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeOrder?.orderId, activeOrder?.status, activeOrder?.restaurantId]);

  const needsAttention =
    activeOrder?.status === "Work" || activeOrder?.status === "Pbook";

  const value = useMemo<OrderContextValue>(
    () => ({
      activeOrder,
      setActiveOrder,
      clearOrder,
      cancelOrder,
      needsAttention,
      modalOpen,
      openModal,
      closeModal,
    }),
    [
      activeOrder,
      setActiveOrder,
      clearOrder,
      cancelOrder,
      needsAttention,
      modalOpen,
      openModal,
      closeModal,
    ]
  );

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used within OrderProvider");
  return ctx;
}
