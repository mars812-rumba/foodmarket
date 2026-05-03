import { useEffect, useState, useCallback, useMemo, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import OrderCard, { type DashboardOrder } from "@/components/OrderCard";
import { RefreshCw, Clock, AlertCircle, Loader2, Trash2, CheckSquare, X } from "lucide-react";
import { R, FONT } from "/home/loft_fire/simple-ar/src/data/theme.tsx";
import { ThemeProvider, useTheme, type ThemeColors } from "@/contexts/ThemeContext";
import { THEMES, type ThemeKey } from "@/data/themes";

const API_URL =
  import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";
const POLL_MS = 15_000;

type AuthState = {
  authenticated: boolean;
  restaurantId: string;
  restaurantName: string;
  restaurantLogo: string;
  theme: string;
  loading: boolean;
  error: string;
};

type StatusFilter = "ALL" | "NEW" | "CONFIRMED" | "PAID" | "DONE" | "CANCELLED";

const STATUS_TABS: { key: StatusFilter; label: string; color: string; bgColor: string }[] = [
  { key: "ALL", label: "All", color: "#6B7280", bgColor: "#F3F4F6" },
  { key: "NEW", label: "New", color: "#D97706", bgColor: "#FFF7EA" },
  { key: "CONFIRMED", label: "Confirmed", color: "#2563EB", bgColor: "#EFF6FF" },
  { key: "PAID", label: "Paid", color: "#16A34A", bgColor: "#F0FDF4" },
  { key: "DONE", label: "Done", color: "#0891B2", bgColor: "#ECFEFF" },
  { key: "CANCELLED", label: "Cancelled", color: "#DC2626", bgColor: "#FEF2F2" },
];

export default function RestaurantDashboard() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    restaurantId: "",
    restaurantName: "",
    restaurantLogo: "",
    theme: "warm",
    loading: true,
    error: "",
  });

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Auth
  useEffect(() => {
    if (!token) {
      setAuth({
        authenticated: false,
        restaurantId: "",
        restaurantName: "",
        restaurantLogo: "",
        theme: "warm",
        loading: false,
        error: "Token not provided. Use a link with ?token=... parameter",
      });
      return;
    }

    const authenticate = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/dashboard/auth?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({ detail: "Authorization error" }));
          setAuth({
            authenticated: false,
            restaurantId: "",
            restaurantName: "",
            restaurantLogo: "",
            theme: "warm",
            loading: false,
            error: data.detail || "Invalid token",
          });
          return;
        }
        const data = await res.json();

        // Fetch restaurant config for logo + theme
        let logo = "";
        let theme = "warm";
        try {
          const cfgRes = await fetch(`${API_URL}/api/restaurants/${data.restaurant_id}/config`);
          if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            logo = cfg.logo || "";
            theme = cfg.theme || "warm";
          }
        } catch { /* ignore */ }

        setAuth({
          authenticated: true,
          restaurantId: data.restaurant_id,
          restaurantName: data.restaurant_name || data.restaurant_id,
          restaurantLogo: logo,
          theme,
          loading: false,
          error: "",
        });
      } catch {
        setAuth({
          authenticated: false,
          restaurantId: "",
          restaurantName: "",
          restaurantLogo: "",
          theme: "warm",
          loading: false,
          error: "Failed to connect to server",
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
  const handleDismiss = async (orderId: string) => {
    // Delete from backend
    try {
      await fetch(`${API_URL}/api/${auth.restaurantId}/orders/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: [orderId] }),
      });
    } catch { /* ignore */ }
    setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(orderId); return n; });
  };

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(orderId)) n.delete(orderId); else n.add(orderId);
      return n;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((o) => o.order_id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const dismissSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Delete from backend
    try {
      await fetch(`${API_URL}/api/${auth.restaurantId}/orders/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids }),
      });
    } catch { /* ignore */ }
    setOrders((prev) => prev.filter((o) => !selectedIds.has(o.order_id)));
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Filter by status tab
  const filtered = orders.filter((o) => {
    if (statusFilter === "ALL") return true;
    return o.status === statusFilter;
  });

  // Stats per status
  const stats = {
    NEW: orders.filter((o) => o.status === "NEW").length,
    CONFIRMED: orders.filter((o) => o.status === "CONFIRMED").length,
    PAID: orders.filter((o) => o.status === "PAID").length,
    DONE: orders.filter((o) => o.status === "DONE").length,
    CANCELLED: orders.filter((o) => o.status === "CANCELLED").length,
  };

  // Logo URL helper
  const getLogoUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return path;
    return `/images_web/${path}`;
  };

  const themeKey = useMemo<ThemeKey>(() => {
    if (auth.theme && auth.theme in THEMES) return auth.theme as ThemeKey;
    return "warm";
  }, [auth.theme]);

  if (auth.loading) {
    return (
      <ThemeProvider theme={themeKey}>
        <DashboardLoading />
      </ThemeProvider>
    );
  }

  if (!auth.authenticated) {
    return (
      <ThemeProvider theme={themeKey}>
        <DashboardError error={auth.error} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={themeKey}>
      <DashboardContent
        auth={auth}
        orders={orders}
        loadingOrders={loadingOrders}
        actionLoading={actionLoading}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        lastRefresh={lastRefresh}
        selectMode={selectMode}
        selectedIds={selectedIds}
        setSelectMode={setSelectMode}
        fetchOrders={fetchOrders}
        handleConfirm={handleConfirm}
        handleReject={handleReject}
        handleMarkPaid={handleMarkPaid}
        handleMarkDone={handleMarkDone}
        handleDismiss={handleDismiss}
        toggleSelect={toggleSelect}
        selectAll={selectAll}
        clearSelection={clearSelection}
        dismissSelected={dismissSelected}
        exitSelectMode={exitSelectMode}
        filtered={filtered}
        stats={stats}
      />
    </ThemeProvider>
  );
}

/* ============================================================
   SUB-COMPONENTS (inside ThemeProvider)
   ============================================================ */

function DashboardLoading() {
  const C = useTheme();
  const s = useMemo(() => buildDashboardStyles(C), [C]);
  return (
    <div style={s.page}>
      <div style={s.centerBox}>
        <Loader2
          size={32}
          style={{ animation: "spin 1s linear infinite", color: C.accent }}
        />
        <p style={s.loadingText}>Authenticating...</p>
      </div>
    </div>
  );
}

function DashboardError({ error }: { error: string }) {
  const C = useTheme();
  const s = useMemo(() => buildDashboardStyles(C), [C]);
  return (
    <div style={s.page}>
      <div style={s.centerBox}>
        <AlertCircle size={40} style={{ color: "#DC2626" }} />
        <h2 style={s.errorTitle}>Access Denied</h2>
        <p style={s.errorText}>{error}</p>
      </div>
    </div>
  );
}

function DashboardContent({
  auth,
  orders,
  loadingOrders,
  actionLoading,
  statusFilter,
  setStatusFilter,
  lastRefresh,
  selectMode,
  selectedIds,
  setSelectMode,
  fetchOrders,
  handleConfirm,
  handleReject,
  handleMarkPaid,
  handleMarkDone,
  handleDismiss,
  toggleSelect,
  selectAll,
  clearSelection,
  dismissSelected,
  exitSelectMode,
  filtered,
  stats,
}: {
  auth: AuthState;
  orders: DashboardOrder[];
  loadingOrders: boolean;
  actionLoading: string | null;
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  lastRefresh: Date;
  selectMode: boolean;
  selectedIds: Set<string>;
  setSelectMode: (m: boolean) => void;
  fetchOrders: () => void;
  handleConfirm: (id: string) => void;
  handleReject: (id: string) => void;
  handleMarkPaid: (id: string) => void;
  handleMarkDone: (id: string) => void;
  handleDismiss: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  dismissSelected: () => void;
  exitSelectMode: () => void;
  filtered: DashboardOrder[];
  stats: Record<string, number>;
}) {
  const C = useTheme();
  const s = useMemo(() => buildDashboardStyles(C), [C]);

  const getLogoUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return path;
    return `/images_web/${path}`;
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          {auth.restaurantLogo ? (
            <img
              src={getLogoUrl(auth.restaurantLogo)}
              alt={auth.restaurantName}
              style={s.logoImg}
            />
          ) : (
            <div style={s.brandIconFallback}>
              {auth.restaurantName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={s.title}>{auth.restaurantName}</h1>
            <p style={s.subtitle}>Orders Dashboard</p>
          </div>
        </div>
        <div style={s.headerRight}>
          <button
            style={{
              ...s.modeBtn,
              backgroundColor: selectMode ? "#FEF2F2" : C.soft,
              color: selectMode ? "#DC2626" : C.muted,
              borderColor: selectMode ? "#FCA5A5" : C.borderLight,
            }}
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          >
            <CheckSquare size={16} />
          </button>
          <button style={s.refreshBtn} onClick={fetchOrders} disabled={loadingOrders}>
            <RefreshCw
              size={16}
              style={loadingOrders ? { animation: "spin 1s linear infinite" } : {}}
            />
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div style={s.tabsBar}>
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "ALL" ? orders.length : (stats as Record<string, number>)[tab.key] || 0;
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              style={{
                ...s.tabBtn,
                backgroundColor: isActive ? tab.color : C.bg,
                color: isActive ? C.white : tab.color,
                borderColor: isActive ? tab.color : C.borderLight,
              }}
              onClick={() => setStatusFilter(tab.key)}
            >
              <span style={s.tabCount}>{count}</span>
              <span style={s.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Last refresh indicator */}
      <div style={s.refreshLine}>
        <span style={s.refreshTime}>
          Updated: {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Batch action bar (select mode) */}
      {selectMode && (
        <div style={s.batchBar}>
          <button style={s.batchBtn} onClick={selectAll}>
            <CheckSquare size={14} />
            Select All
          </button>
          {selectedIds.size > 0 && (
            <>
              <span style={s.batchCount}>Selected: {selectedIds.size}</span>
              <button style={s.batchClearBtn} onClick={clearSelection}>
                <X size={14} />
                Clear
              </button>
              <button style={s.batchDeleteBtn} onClick={dismissSelected}>
                <Trash2 size={14} />
                Delete ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      )}

      {/* Orders list */}
      <div style={s.ordersList}>
        {filtered.length === 0 ? (
          <div style={s.emptyState}>
            <Clock size={40} style={{ color: C.muted }} />
            <p style={s.emptyText}>
              {statusFilter === "ALL"
                ? "No orders yet"
                : `No orders with status "${STATUS_TABS.find(t => t.key === statusFilter)?.label || statusFilter}"`}
            </p>
          </div>
        ) : (
          filtered.map((order) => (
            <OrderCard
              key={order.order_id}
              order={order}
              selectMode={selectMode}
              selected={selectedIds.has(order.order_id)}
              onToggleSelect={toggleSelect}
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

function buildDashboardStyles(C: ThemeColors): Record<string, CSSProperties> {
  return {
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
      padding: "14px 16px",
      background: C.headerBg,
      borderBottom: `1px solid ${C.headerBorder}`,
      position: "sticky" as const,
      top: 0,
      zIndex: 100,
    },
    headerLeft: { display: "flex", alignItems: "center", gap: 12 },
    headerRight: { display: "flex", alignItems: "center", gap: 8 },
    modeBtn: {
      width: 38,
      height: 38,
      borderRadius: R.md,
      border: "1px solid",
      background: C.soft,
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
      color: C.muted,
      transition: "all 0.15s",
    },
    logoImg: {
      width: 40,
      height: 40,
      borderRadius: R.md,
      objectFit: "cover" as const,
      border: `1px solid ${C.borderLight}`,
    },
    brandIconFallback: {
      width: 40,
      height: 40,
      borderRadius: R.md,
      background: C.accentGradient,
      display: "grid",
      placeItems: "center",
      color: C.white,
      fontSize: 18,
      fontWeight: 900,
    },
    title: {
      fontSize: 16,
      fontWeight: 800,
      color: C.text,
      margin: 0,
      letterSpacing: -0.3,
    },
    subtitle: { fontSize: 12, color: C.muted, margin: 0 },
    refreshBtn: {
      width: 38,
      height: 38,
      borderRadius: R.md,
      border: `1px solid ${C.borderLight}`,
      background: C.soft,
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
      color: C.muted,
    },

    tabsBar: {
      display: "flex",
      gap: 6,
      padding: "12px 12px 8px",
      overflowX: "auto" as const,
    },
    tabBtn: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid",
      cursor: "pointer",
      fontFamily: "inherit",
      minWidth: 58,
      transition: "all 0.15s",
    },
    tabCount: {
      fontSize: 18,
      fontWeight: 900,
      lineHeight: 1.1,
    },
    tabLabel: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase" as const,
    },

    refreshLine: {
      padding: "0 16px 6px",
    },
    refreshTime: {
      fontSize: 11,
      color: C.muted,
      fontVariantNumeric: "tabular-nums",
    },

    batchBar: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 16px",
      background: C.soft,
      borderBottom: `1px solid ${C.borderLight}`,
      flexWrap: "wrap" as const,
    },
    batchBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 12px",
      borderRadius: 8,
      border: `1px solid ${C.borderLight}`,
      background: C.bg,
      color: C.textSoft,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    batchCount: {
      fontSize: 12,
      fontWeight: 700,
      color: C.accent,
    },
    batchClearBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 12px",
      borderRadius: 8,
      border: `1px solid ${C.borderLight}`,
      background: C.bg,
      color: C.muted,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    batchDeleteBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 12px",
      borderRadius: 8,
      border: "1px solid #FCA5A5",
      background: "#FEF2F2",
      color: "#DC2626",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    },

    ordersList: { padding: "0 12px" },
    emptyState: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
      padding: "60px 20px",
    },
    emptyText: { fontSize: 14, color: C.muted, margin: 0 },
  };
}
