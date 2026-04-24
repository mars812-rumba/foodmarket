import { useEffect, useState, useCallback, type CSSProperties } from "react";
import OrderCard, { type DashboardOrder } from "@/components/OrderCard";
import {
  RefreshCw,
  LayoutDashboard,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";
const POLL_MS = 15_000;

/* ============================================================
   COMPONENT
   ============================================================ */

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, any>>({});
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "done">("active");
  const [restaurantFilter, setRestaurantFilter] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ── Fetch all orders ──
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API_URL}/api/dashboard/admin/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setRestaurants(data.restaurants || {});
        setLastRefresh(new Date());
      }
    } catch {
      // silently retry
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // ── Actions ──
  const updateStatus = async (orderId: string, restaurantId: string, status: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(
        `${API_URL}/api/${restaurantId}/orders/${orderId}/status`,
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

  const handleConfirm = (orderId: string) => {
    const order = orders.find((o) => o.order_id === orderId);
    if (order) updateStatus(orderId, order.restaurant_id, "CONFIRMED");
  };
  const handleReject = (orderId: string) => {
    const order = orders.find((o) => o.order_id === orderId);
    if (order) updateStatus(orderId, order.restaurant_id, "CANCELLED");
  };
  const handleMarkPaid = (orderId: string) => {
    const order = orders.find((o) => o.order_id === orderId);
    if (order) updateStatus(orderId, order.restaurant_id, "PAID");
  };
  const handleMarkDone = (orderId: string) => {
    const order = orders.find((o) => o.order_id === orderId);
    if (order) updateStatus(orderId, order.restaurant_id, "DONE");
  };
  const handleDismiss = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
  };

  // ── Filtered orders ──
  const filtered = orders.filter((o) => {
    if (restaurantFilter !== "all" && o.restaurant_id !== restaurantFilter) return false;
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

  const restaurantList = Object.keys(restaurants);

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <LayoutDashboard size={20} style={{ color: "#E04E1B" }} />
          <div>
            <h1 style={s.title}>Все заказы</h1>
            <p style={s.subtitle}>Администрирование · {orders.length} заказов</p>
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

      {/* ── Filter bar ── */}
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

        {/* Restaurant filter */}
        {restaurantList.length > 1 && (
          <select
            style={s.select}
            value={restaurantFilter}
            onChange={(e) => setRestaurantFilter(e.target.value)}
          >
            <option value="all">Все рестораны</option>
            {restaurantList.map((id) => (
              <option key={id} value={id}>
                {restaurants[id]?.name || id}
              </option>
            ))}
          </select>
        )}

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
              restaurantName={restaurants[order.restaurant_id]?.name}
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
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 20px 12px",
    flexWrap: "wrap" as const,
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
  select: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #D4C8B8",
    background: "#FFFFFF",
    color: "#3D2E1E",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  lastRefresh: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#9A8A78",
    fontVariantNumeric: "tabular-nums",
  },
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
