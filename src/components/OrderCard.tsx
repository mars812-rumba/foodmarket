import { useState, useMemo, type CSSProperties } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Wallet,
  Utensils,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Banknote,
  User,
  Phone,
  Check,
} from "lucide-react";
import { useTheme, type ThemeColors } from "@/contexts/ThemeContext";

/* ============================================================
   TYPES
   ============================================================ */

export type DashboardOrderStatus = "NEW" | "CONFIRMED" | "PAID" | "DONE" | "CANCELLED";

export type DashboardOrder = {
  order_id: string;
  restaurant_id: string;
  user_id: string;
  customer_name: string;
  contacts: string;
  items: Array<{ name: string; price: number; qnt: number }>;
  total: number;
  delivery_type: "pickup" | "delivery";
  payment_method: "qr_prompt_pay" | "cash";
  status: DashboardOrderStatus;
  payment_sent?: boolean;
  payment_sent_at?: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  order: DashboardOrder;
  restaurantName?: string;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (orderId: string) => void;
  onConfirm?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onMarkPaid?: (orderId: string) => void;
  onMarkDone?: (orderId: string) => void;
  onDismiss?: (orderId: string) => void;
  loading?: boolean;
};

/* ============================================================
   STATUS CONFIG
   ============================================================ */

const STATUS_CFG: Record<DashboardOrderStatus, {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
  icon: React.ReactNode;
  action: string;
}> = {
  NEW: {
    label: "NEW",
    color: "#D97706",
    bg: "#FFF7EA",
    borderColor: "#F5C77A",
    icon: <Clock size={16} />,
    action: "Confirm or reject the order",
  },
  CONFIRMED: {
    label: "CONFIRMED",
    color: "#2563EB",
    bg: "#EFF6FF",
    borderColor: "#93C5FD",
    icon: <CheckCircle2 size={16} />,
    action: "Waiting for payment from customer",
  },
  PAID: {
    label: "PAID",
    color: "#16A34A",
    bg: "#F0FDF4",
    borderColor: "#86EFAC",
    icon: <Banknote size={16} />,
    action: "Prepare order for pickup",
  },
  DONE: {
    label: "COMPLETED",
    color: "#0891B2",
    bg: "#ECFEFF",
    borderColor: "#67E8F9",
    icon: <CheckCircle2 size={16} />,
    action: "Order completed",
  },
  CANCELLED: {
    label: "CANCELLED",
    color: "#DC2626",
    bg: "#FEF2F2",
    borderColor: "#FCA5A5",
    icon: <XCircle size={16} />,
    action: "Order cancelled",
  },
};

/* ============================================================
   HELPERS
   ============================================================ */

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

/* ============================================================
   COMPONENT
   ============================================================ */

export default function OrderCard({
  order,
  restaurantName,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onConfirm,
  onReject,
  onMarkPaid,
  onMarkDone,
  onDismiss,
  loading = false,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => buildOrderCardStyles(C), [C]);
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[order.status] || STATUS_CFG.NEW;
  const isTerminal = order.status === "DONE" || order.status === "CANCELLED";

  // Checkbox state for each item
  const [checkedItems, setCheckedItems] = useState<Set<number>>(() => new Set());

  const toggleItem = (idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const allChecked = order.items.length > 0 && checkedItems.size === order.items.length;

  // Reset checkboxes when order changes
  // (simple approach: we don't persist across re-renders from parent)

  return (
    <div
      style={{
        ...s.card,
        borderLeft: `4px solid ${cfg.color}`,
        backgroundColor: selected
          ? C.accentSoft
          : allChecked
            ? C.cream
            : C.bg,
      }}
    >
      {/* ── Select mode checkbox ── */}
      {selectMode && (
        <div style={s.selectRow} onClick={() => onToggleSelect?.(order.order_id)}>
          <div style={{
            ...s.selectCheckbox,
            backgroundColor: selected ? C.accent : "transparent",
            borderColor: selected ? C.accent : C.borderLight,
          }}>
            {selected ? <Check size={14} style={{ color: C.white }} /> : null}
          </div>
          <span style={s.selectLabel}>
            {selected ? "Selected" : "Select"}
          </span>
        </div>
      )}

      {/* ── Header row ── */}
      <div style={s.header} onClick={() => !selectMode && setExpanded(!expanded)}>
        <div style={s.headerLeft}>
          <span
            style={{
              ...s.badge,
              backgroundColor: cfg.bg,
              color: cfg.color,
              borderColor: cfg.borderColor,
            }}
          >
            {cfg.icon}
            <span style={{ marginLeft: 4 }}>{cfg.label}</span>
          </span>
          <span style={s.orderId}>#{order.order_id}</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.time}>{fmtDate(order.created_at)} {fmtTime(order.created_at)}</span>
          {expanded ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
        </div>
      </div>

      {/* ── Summary (always visible) ── */}
      <div style={s.summary} onClick={() => setExpanded(!expanded)}>
        <span style={s.total}>{order.total.toLocaleString()} ฿</span>
        <span style={s.dot}>·</span>
        <span style={s.meta}>
          {order.delivery_type === "delivery" ? "Delivery" : "Pickup"}
        </span>
        <span style={s.dot}>·</span>
        <span style={s.meta}>
          {order.payment_method === "cash" ? "Cash" : "QR Pay"}
        </span>
        {restaurantName && (
          <>
            <span style={s.dot}>·</span>
            <span style={s.meta}>{restaurantName}</span>
          </>
        )}
        {order.payment_sent && order.status === "CONFIRMED" && (
          <>
            <span style={s.dot}>·</span>
            <span style={s.paymentSentBadge}>
              <AlertCircle size={12} />
              Customer marked payment sent
            </span>
          </>
        )}
      </div>

      {/* ── Action description line ── */}
      {!isTerminal && (
        <div style={s.actionLine}>
          <AlertCircle size={13} style={{ color: cfg.color, flexShrink: 0 }} />
          <span style={{ ...s.actionText, color: cfg.color }}>{cfg.action}</span>
        </div>
      )}

      {/* ── All items checked indicator ── */}
      {allChecked && expanded && (
        <div style={s.allCheckedLine}>
          <CheckCircle2 size={14} style={{ color: C.green }} />
          <span style={s.allCheckedText}>All items packed</span>
        </div>
      )}

      {/* ── Expanded details ── */}
      {expanded && (
        <div style={s.details}>
          {/* Delivery & Payment — ABOVE items */}
          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <Truck size={14} style={{ color: C.accent, flexShrink: 0 }} />
              <span style={s.infoLabel}>
                {order.delivery_type === "delivery" ? "Delivery" : "Pickup"}
              </span>
            </div>
            <div style={s.infoItem}>
              <Wallet size={14} style={{ color: C.green, flexShrink: 0 }} />
              <span style={s.infoLabel}>
                {order.payment_method === "cash" ? "Cash" : "QR PromptPay"}
              </span>
            </div>
          </div>

          {/* Customer info — ABOVE items */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              <User size={12} />
              Customer
            </div>
            <div style={s.customerRow}>
              <span style={s.customerName}>{order.customer_name || "—"}</span>
              {order.contacts && (
                <span style={s.customerContact}>
                  <Phone size={12} />
                  {order.contacts}
                </span>
              )}
            </div>
            {order.user_id && (
              <div style={s.userIdRow}>TG ID: {order.user_id}</div>
            )}
          </div>

          {/* Items with checkboxes */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              <Utensils size={12} />
              Order Items
            </div>
            {order.items.map((item, idx) => {
              const isChecked = checkedItems.has(idx);
              return (
                <div
                  key={idx}
                  style={{
                    ...s.itemRow,
                    backgroundColor: isChecked ? C.cream : C.soft,
                  }}
                  onClick={() => toggleItem(idx)}
                >
                  <div style={{
                    ...s.checkboxWrap,
                    backgroundColor: isChecked ? C.green : "transparent",
                    borderColor: isChecked ? C.green : C.borderLight,
                  }}>
                    {isChecked ? (
                      <Check size={14} style={{ color: C.white }} />
                    ) : null}
                  </div>
                  <span style={{
                    ...s.itemName,
                    textDecoration: isChecked ? "line-through" : "none",
                    color: isChecked ? C.muted : C.text,
                  }}>
                    {item.name}
                  </span>
                  <span style={{
                    ...s.itemQty,
                    color: isChecked ? C.muted : C.textSoft,
                  }}>×{item.qnt}</span>
                  <span style={{
                    ...s.itemPrice,
                    color: isChecked ? C.muted : C.text,
                  }}>
                    {(item.price * item.qnt).toLocaleString()} ฿
                  </span>
                </div>
              );
            })}
          </div>

          {/* Payment sent indicator */}
          {order.payment_sent && (
            <div style={s.paymentSentBox}>
              <AlertCircle size={16} style={{ color: C.accent, flexShrink: 0 }} />
              <div>
                <div style={s.paymentSentTitle}>Customer marked payment sent</div>
                {order.payment_sent_at && (
                  <div style={s.paymentSentTime}>
                    {fmtTime(order.payment_sent_at)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total — clean, no black bg */}
          <div style={s.totalBox}>
            <span style={s.totalLabel}>TOTAL</span>
            <span style={s.totalValue}>{order.total.toLocaleString()} ฿</span>
          </div>

          {/* Action buttons */}
          {!isTerminal && (
            <div style={s.actions}>
              {order.status === "NEW" && (
                <>
                  <button
                    style={s.btnConfirm}
                    onClick={() => onConfirm?.(order.order_id)}
                    disabled={loading}
                  >
                    <CheckCircle2 size={16} />
                    Confirm
                  </button>
                  <button
                    style={s.btnReject}
                    onClick={() => onReject?.(order.order_id)}
                    disabled={loading}
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </>
              )}
              {order.status === "CONFIRMED" && (
                <>
                  <button
                    style={s.btnPaid}
                    onClick={() => onMarkPaid?.(order.order_id)}
                    disabled={loading}
                  >
                    <Banknote size={16} />
                    Payment Received
                  </button>
                  <button
                    style={s.btnReject}
                    onClick={() => onReject?.(order.order_id)}
                    disabled={loading}
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </>
              )}
              {order.status === "PAID" && (
                <button
                  style={s.btnDone}
                  onClick={() => onMarkDone?.(order.order_id)}
                  disabled={loading}
                >
                  <CheckCircle2 size={16} />
                  Order Complete
                </button>
              )}
            </div>
          )}

          {/* Dismiss for terminal orders */}
          {isTerminal && onDismiss && (
            <div style={s.actions}>
              <button
                style={s.btnDismiss}
                onClick={() => onDismiss(order.order_id)}
                disabled={loading}
              >
                Remove from list
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES — theme-aware builder
   ============================================================ */

function buildOrderCardStyles(C: ThemeColors): Record<string, CSSProperties> {
  const BORDER = C.borderLight;

  return {
    card: {
      background: C.bg,
      borderRadius: 12,
      border: `1px solid ${BORDER}`,
      overflow: "hidden",
      marginBottom: 8,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      transition: "background-color 0.2s",
    },
    selectRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px 0",
      cursor: "pointer",
    },
    selectCheckbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `2px solid ${C.borderLight}`,
      display: "grid",
      placeItems: "center",
      flexShrink: 0,
      transition: "all 0.15s",
    },
    selectLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: C.muted,
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px 6px",
      cursor: "pointer",
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    headerRight: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      padding: "4px 10px",
      borderRadius: 8,
      border: "1px solid",
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: 0.6,
    },
    orderId: {
      fontSize: 14,
      fontWeight: 800,
      color: C.text,
      letterSpacing: -0.3,
    },
    time: {
      fontSize: 12,
      color: C.muted,
      fontVariantNumeric: "tabular-nums",
    },
    summary: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0 14px 8px",
      cursor: "pointer",
      flexWrap: "wrap" as const,
    },
    actionLine: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0 14px 8px",
    },
    actionText: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.2,
    },
    total: {
      fontSize: 15,
      fontWeight: 900,
      color: C.text,
    },
    dot: {
      color: C.borderLight,
      fontSize: 12,
    },
    meta: {
      fontSize: 12,
      color: C.muted,
      fontWeight: 600,
    },
    paymentSentBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 11,
      fontWeight: 700,
      color: C.accent,
      backgroundColor: C.accentSoft,
      padding: "2px 8px",
      borderRadius: 6,
    },

    allCheckedLine: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 14px 6px",
    },
    allCheckedText: {
      fontSize: 12,
      fontWeight: 700,
      color: C.green,
    },

    /* Details (expanded) */
    details: {
      padding: "0 14px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      borderTop: `1px solid ${BORDER}`,
      paddingTop: 10,
    },
    section: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    sectionLabel: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
      color: C.muted,
      marginBottom: 2,
    },
    itemRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 8px",
      borderRadius: 8,
      cursor: "pointer",
      transition: "background-color 0.15s",
    },
    checkboxWrap: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `2px solid ${C.borderLight}`,
      display: "grid",
      placeItems: "center",
      flexShrink: 0,
      backgroundColor: "transparent",
      transition: "all 0.15s",
    },
    itemName: {
      flex: 1,
      fontSize: 13,
      fontWeight: 600,
      transition: "all 0.15s",
    },
    itemQty: {
      fontSize: 12,
      fontWeight: 600,
      transition: "color 0.15s",
    },
    itemPrice: {
      fontSize: 13,
      fontWeight: 800,
      minWidth: 60,
      textAlign: "right" as const,
      transition: "color 0.15s",
    },
    infoGrid: {
      display: "flex",
      gap: 8,
    },
    infoItem: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 10px",
      borderRadius: 10,
      background: C.soft,
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: C.textSoft,
    },
    customerRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "6px 8px",
      borderRadius: 8,
      background: C.soft,
    },
    customerName: {
      fontSize: 13,
      fontWeight: 700,
      color: C.text,
    },
    customerContact: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontSize: 12,
      color: C.muted,
    },
    userIdRow: {
      fontSize: 11,
      color: C.muted,
      padding: "2px 8px",
    },

    /* Payment sent box */
    paymentSentBox: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 10,
      background: C.accentSoft,
      border: `1px solid ${C.borderLight}`,
    },
    paymentSentTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: C.accent,
    },
    paymentSentTime: {
      fontSize: 11,
      color: C.accent,
    },

    /* Total */
    totalBox: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 12px",
      borderRadius: 10,
      background: C.soft,
      border: `1px solid ${BORDER}`,
    },
    totalLabel: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 0.8,
      textTransform: "uppercase" as const,
      color: C.muted,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: 900,
      color: C.text,
    },

    /* Actions */
    actions: {
      display: "flex",
      gap: 8,
      marginTop: 4,
    },
    btnConfirm: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      flex: 1,
      background: C.greenGradient,
      color: C.white,
      border: "none",
      padding: "12px 16px",
      borderRadius: 12,
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(34,197,94,0.25)",
    },
    btnPaid: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      flex: 1,
      background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
      color: C.white,
      border: "none",
      padding: "12px 16px",
      borderRadius: 12,
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(59,130,246,0.25)",
    },
    btnDone: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      flex: 1,
      background: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
      color: C.white,
      border: "none",
      padding: "12px 16px",
      borderRadius: 12,
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(6,182,212,0.25)",
    },
    btnReject: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      background: "transparent",
      color: "#DC2626",
      border: "1px solid #FCA5A5",
      padding: "12px 16px",
      borderRadius: 12,
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    btnDismiss: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      flex: 1,
      background: "transparent",
      color: C.muted,
      border: `1px solid ${C.borderLight}`,
      padding: "10px 16px",
      borderRadius: 12,
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
    },
  };
}
