import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import OrderCard, { type DashboardOrder } from "@/components/OrderCard";
import { RefreshCw, Utensils, Clock, AlertCircle, Loader2 } from "lucide-react";
import { C, R, SH, FONT } from "/home/loft_fire/simple-ar/src/data/theme.tsx";

const API_URL =
  import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";
const POLL_MS = 15_000;

type AuthState = {
  authenticated: boolean;
  restaurantId: string;
  restaurantName: string;
  loading: boolean;
  error: string;
};

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

  // Auth
  useEffect(() => {
    if (!token) {
      setAuth({
        authenticated: false,
        restaurantId: "",
        restaurantName: "",
        loading: false,
        error: "Токен не указан. Используйте ссылку с параметром ?token=...",
      });
      return;
    }

    const authenticate = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/dashboard/auth?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({ detail: "Ошибка авторизации" }));
          setAuth({
            authenticated: false,
            restaurantId: "",
            restaurantName: "",
            loading: false,
            error: data.detail || "Неверный токен",
          });
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
        setAuth({
          authenticated: false,
          restaurantId: "",
          restaurantName: "",
          loading: false,
          error: "Не удалось подключиться к серверу",
        });
      }
    };

    authenticate();
  }, [token]);

  // Orders
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
      /* retry */
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
        },
      );
      if (res.ok) await fetchOrders();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirm = (orderId: string) => updateStatus(orderId, "CONFIRMED");
  const handleReject = (orderId: string) => updateStatus(orderId, "CANCELLED");
  const handleMarkPaid = (orderId: string) => updateStatus(orderId, "PAID");
  const handleMarkDone = (orderId: string) => updateStatus(orderId, "DONE");
  const handleDismiss = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
  };

  const filtered = orders.filter((o) => {
    if (filter === "active") return o.status !== "DONE" && o.status !== "CANCELLED";
    if (filter === "done") return o.status === "DONE" || o.status === "CANCELLED";
    return true;
  });

  const stats = {
    new: orders.filter((o) => o.status === "NEW").length,
    confirmed: orders.filter((o) => o.status === "CONFIRMED").length,
    paid: orders.filter((o) => o.status === "PAID").length,
    done: orders.filter((o) => o.status === "DONE").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
  };

  if (auth.loading) {
    return (
      <div style={s.page}>
        <div style={s.centerBox}>
          <Loader2
            size={32}
            style={{ animation: "spin 1s linear infinite", color: C.accent }}
          />
          <p style={s.loadingText}>Авторизация...</p>
        </div>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div style={s.page}>
        <div style={s.centerBox}>
          <AlertCircle size={40} style={{ color: C.danger }} />
          <h2 style={s.errorTitle}>Доступ запрещён</h2>
          <p style={s.errorText}>{auth.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.brandIcon}>
            <Utensils size={18} style={{ color: "#FFFFFF" }} />
          </div>
          <div>
            <h1 style={s.title}>{auth.restaurantName}</h1>
            <p style={s.subtitle}>Панель управления заказами</p>
          </div>
        </div>
        <button style={s.refreshBtn} onClick={fetchOrders} disabled={loadingOrders}>
          <RefreshCw
            size={16}
            style={loadingOrders ? { animation: "spin 1s linear infinite" } : {}}
          />
        </button>
      </div>

      {/* Stats */}
      <div style={s.statsBar}>
        <StatChip value={stats.new} label="Новые" color={C.accent} />
        <StatChip value={stats.confirmed} label="Подтв." color={C.info} />
        <StatChip value={stats.paid} label="Оплач." color={C.ok} />
        <StatChip value={stats.done} label="Готово" color={C.done} />
      </div>

      {/* Filter */}
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
          {lastRefresh.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* List */}
      <div style={s.ordersList}>
        {filtered.length === 0 ? (
          <div style={s.emptyState}>
            <Clock size={40} style={{ color: C.hint }} />
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

function StatChip({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div style={{ ...s.statItem, borderTop: `3px solid ${color}` }}>
      <span style={{ ...s.statValue, color }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: C.pageBg,
    fontFamily: FONT,
    padding: "0 0 40px",
    color: C.text,
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
  loadingText: { fontSize: 14, color: C.muted },
  errorTitle: { fontSize: 20, fontWeight: 800, color: C.text, margin: 0 },
  errorText: {
    fontSize: 14,
    color: C.muted,
    textAlign: "center" as const,
    maxWidth: 300,
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    background: C.bg,
    borderBottom: `1px solid ${C.border}`,
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 6px rgba(20,10,5,0.04)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    background: C.accentGradient,
    display: "grid",
    placeItems: "center",
    boxShadow: SH.accent,
  },
  title: {
    fontSize: 17,
    fontWeight: 800,
    color: C.text,
    margin: 0,
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 12, color: C.faint, margin: 0 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    border: `1px solid ${C.border}`,
    background: C.cream,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    color: C.muted,
  },

  statsBar: {
    display: "flex",
    gap: 10,
    padding: "14px 16px 8px",
    overflowX: "auto" as const,
  },
  statItem: {
    flex: 1,
    minWidth: 76,
    padding: "10px 10px 8px",
    borderRadius: R.md,
    background: C.bg,
    border: `1px solid ${C.border}`,
    boxShadow: SH.card,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: 900, lineHeight: 1.1 },
  statLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: C.faint,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },

  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px 12px",
  },
  filterBtn: {
    padding: "7px 14px",
    borderRadius: R.pill,
    border: `1px solid ${C.border}`,
    background: C.bg,
    color: C.muted,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filterBtnActive: {
    background: C.accentGradient,
    color: "#FFFFFF",
    borderColor: "transparent",
    boxShadow: SH.accent,
  },
  lastRefresh: {
    marginLeft: "auto",
    fontSize: 11,
    color: C.faint,
    fontVariantNumeric: "tabular-nums",
  },

  ordersList: { padding: "0 16px" },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "60px 20px",
  },
  emptyText: { fontSize: 14, color: C.faint, margin: 0 },
};
