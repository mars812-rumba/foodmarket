import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import OrderCard, { type DashboardOrder } from "@/components/OrderCard";
import {
  RefreshCw,
  Utensils,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";
const POLL_MS = 15_000;

/* ============================================================
   TYPES
   ============================================================ */

type AuthState = {
  authenticated: boolean;
  restaurantId: string;
  restaurantName: string;
  loading: boolean;
  error: string;
};

/* ============================================================
   COMPONENT
   ============================================================ */

export default function RestaurantDashboard() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    restaurantId: "",
    restaurantName: "",
    loading: true,
    error: "",
  });

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "done">("active");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ── Auth via token ──
  useEffect(() => {
    if (!token) {
      setAuth({ authenticated: false, restaurantId: "", restaurantName: "", loading: false, error: "Токен не указан. Используйте ссылку с параметром ?token=..." });
      return;
    }

    const authenticate = async () => {
      try {
        const res = await fetch(`${API_URL}/api/dashboard/auth?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({ detail: "Ошибка авторизации" }));
          setAuth({ authenticated: false, restaurantId: "", restaurantName: "", loading: false, error: data.detail || "Неверный токен" });
          return;
        }
        const data = await res.json();
        setAuth({
          authenticated: true,
          restaurantId: data.restaurant_id,
          restaurantName: data.restaurant_name || data.restaurant_id,
          loading: false,
          error: "",
        });
      } catch {
        setAuth({ authenticated: false, restaurantId: "", restaurantName: "", loading: false, error: "Не удалось подключиться к серверу" });
      }
    };

    authenticate();
  }, [token]);

  // ── Fetch orders ──
  const fetchOrders = useCallback(async () => {
    if (!auth.authenticated || !auth.restaurantId) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API_URL}/api/dashboard/${auth.restaurantId}/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setLastRefresh(new Date());
      }
    } catch {
      // silently retry
    } finally {
      setLoadingOrders(false);
    }
  }, [auth.authenticated, auth.restaurantId]);

  useEffect(() => {
    if (!auth.authenticated) return;
    fetchOrders();
    const id = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(id);
  }, [auth.authenticated, fetchOrders]);

  // ── Actions ──
  const updateStatus = async (orderId: string, status: string) => {
    if (!auth.restaurantId) return;
    setActionLoading(orderId);
    try {
      const res = await fetch(
        `${API_URL}/api/${auth.restaurantId}/orders/${orderId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (res.ok) {
        await fetchOrders();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirm = (orderId: string) => updateStatus(orderId, "CONFIRMED");
  const handleReject = (orderId: string) => updateStatus(orderId, "CANCELLED");
  const handleMarkPaid = (orderId: string) => updateStatus(orderId, "PAID");
  const handleMarkDone = (orderId: string) => updateStatus(orderId, "DONE");
  const handleDismiss = (orderId: string) => {
    // Remove from local view only (already DONE/CANCELLED)
    setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
  };

  // ── Filtered orders ──
  const filtered = orders.filter((o) => {
    if (filter === "active") return o.status !== "DONE" && o.status !== "CANCELLED";
    if (filter === "done") return o.status === "DONE" || o.status === "CANCELLED";
    return true;
  });

  // ── Stats ──
  const stats = {
    new: orders.filter((o) => o.status === "NEW").length,
    confirmed: orders.filter((o) => o.status === "CONFIRMED").length,
    paid: orders.filter((o) => o.status === "PAID").length,
    done: orders.filter((o) => o.status === "DONE").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
  };

  // ── Render ──

  // Loading auth
  if (auth.loading) {
    return (
      <div style={s.page}>
        <div style={s.centerBox}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#D97706" }} />
          <p style={s.loadingText}>Авторизация...</p>
        </div>
      </div>
    );
  }

  // Auth error
  if (!auth.authenticated) {
    return (
      <div style={s.page}>
        <div style={s.centerBox}>
          <AlertCircle size={40} style={{ color: "#DC2626" }} />
          <h2 style={s.errorTitle}>Доступ запрещён</h2>
          <p style={s.errorText}>{auth.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <Utensils size={20} style={{ color: "#E04E1B" }} />
          <div>
            <h1 style={s.title}>{auth.restaurantName}</h1>
            <p style={s.subtitle}>Панель управления заказами</p>
          </div>
        </div>
        <button style={s.refreshBtn} onClick={fetchOrders} disabled={loadingOrders}>
          <RefreshCw size={16} style={loadingOrders ? { animation: "spin 1s linear infinite" } : {}} />
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div style={s.statsBar}>
        <div style={{ ...s.statItem, borderLeft: "3px solid #F59E0B" }}>
          <span style={s.statValue}>{stats.new}</span>
          <span style={s.statLabel}>Новые</span>
        </div>
        <div style={{ ...s.statItem, borderLeft: "3px solid #3B82F6" }}>
          <span style={s.statValue}>{stats.confirmed}</span>
          <span style={s.statLabel}>Подтв.</span>
        </div>
        <div style={{ ...s.statItem, borderLeft: "3px solid #22C55E" }}>
          <span style={s.statValue}>{stats.paid}</span>
          <span style={s.statLabel}>Оплач.</span>
        </div>
        <div style={{ ...s.statItem, borderLeft: "3px solid #06B6D4" }}>
          <span style={s.statValue}>{stats.done}</span>
          <span style={s.statLabel}>Готово</span>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div style={s.filterBar}>
        {(["active", "all", "done"] as const).map((f) => (
          <button
            key={f}
            style={{
              ...s.filterBtn,
              ...(filter === f ? s.filterBtnActive : {}),
            }}
            onClick={() => setFilter(f)}
          >
            {f === "active" ? "Активные" : f === "all" ? "Все" : "Завершённые"}
          </button>
        ))}
        <span style={s.lastRefresh}>
          {lastRefresh.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* ── Orders list ── */}
      <div style={s.ordersList}>
        {filtered.length === 0 ? (
          <div style={s.emptyState}>
            <Clock size={40} style={{ color: "#D4C8B8" }} />
            <p style={s.emptyText}>
              {filter === "active"
                ? "Нет активных заказов"
                : filter === "done"
                ? "Нет завершённых заказов"
                : "Заказов пока нет"}
            </p>
          </div>
        ) : (
          filtered.map((order) => (
            <OrderCard
              key={order.order_id}
              order={order}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onMarkPaid={handleMarkPaid}
              onMarkDone={handleMarkDone}
              onDismiss={handleDismiss}
              loading={actionLoading === order.order_id}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F7F4F0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "0 0 40px",
  },
  centerBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: 16,
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: "#7A6650",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#1A1208",
    margin: 0,
  },
  errorText: {
    fontSize: 14,
    color: "#7A6650",
    textAlign: "center" as const,
    maxWidth: 300,
  },

  /* Header */
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    background: "#FFFFFF",
    borderBottom: "1px solid rgba(120,80,30,0.16)",
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    color: "#1A1208",
    margin: 0,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: "#9A8A78",
    margin: 0,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(120,80,30,0.16)",
    background: "#FFFAF2",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    color: "#7A6650",
  },

  /* Stats */
  statsBar: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
    overflowX: "auto" as const,
  },
  statItem: {
    flex: 1,
    minWidth: 70,
    padding: "8px 10px",
    borderRadius: 10,
    background: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 900,
    color: "#1A1208",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#9A8A78",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },

  /* Filter */
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 20px 12px",
  },
  filterBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid #D4C8B8",
    background: "transparent",
    color: "#7A6650",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filterBtnActive: {
    background: "#1A1208",
    color: "#FFFFFF",
    borderColor: "#1A1208",
  },
  lastRefresh: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#9A8A78",
    fontVariantNumeric: "tabular-nums",
  },

  /* Orders */
  ordersList: {
    padding: "0 16px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "60px 20px",
  },
  emptyText: {
    fontSize: 14,
    color: "#9A8A78",
    margin: 0,
  },
};
