import { useState, type CSSProperties } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  QrCode,
  Truck,
  Wallet,
  Utensils,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Banknote,
  User,
  Phone,
} from "lucide-react";

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
}> = {
  NEW: {
    label: "НОВЫЙ",
    color: "#D97706",
    bg: "#FFFBEB",
    borderColor: "#F59E0B",
    icon: <Clock size={16} />,
  },
  CONFIRMED: {
    label: "ПОДТВЕРЖДЁН",
    color: "#2563EB",
    bg: "#EFF6FF",
    borderColor: "#3B82F6",
    icon: <CheckCircle2 size={16} />,
  },
  PAID: {
    label: "ОПЛАЧЕН",
    color: "#16A34A",
    bg: "#F0FDF4",
    borderColor: "#22C55E",
    icon: <Banknote size={16} />,
  },
  DONE: {
    label: "ВЫПОЛНЕН",
    color: "#0891B2",
    bg: "#ECFEFF",
    borderColor: "#06B6D4",
    icon: <CheckCircle2 size={16} />,
  },
  CANCELLED: {
    label: "ОТМЕНЁН",
    color: "#DC2626",
    bg: "#FEF2F2",
    borderColor: "#EF4444",
    icon: <XCircle size={16} />,
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
  onConfirm,
  onReject,
  onMarkPaid,
  onMarkDone,
  onDismiss,
  loading = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[order.status] || STATUS_CFG.NEW;

  const isTerminal = order.status === "DONE" || order.status === "CANCELLED";

  return (
    <div
      style={{
        ...s.card,
        borderLeft: `4px solid ${cfg.color}`,
      }}
    >
      {/* ── Header row ── */}
      <div style={s.header} onClick={() => setExpanded(!expanded)}>
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
          {expanded ? <ChevronUp size={16} color="#9A8A78" /> : <ChevronDown size={16} color="#9A8A78" />}
        </div>
      </div>

      {/* ── Summary (always visible) ── */}
      <div style={s.summary} onClick={() => setExpanded(!expanded)}>
        <span style={s.total}>{order.total.toLocaleString()} ฿</span>
        <span style={s.dot}>·</span>
        <span style={s.meta}>
          {order.delivery_type === "delivery" ? "Доставка" : "Самовывоз"}
        </span>
        <span style={s.dot}>·</span>
        <span style={s.meta}>
          {order.payment_method === "cash" ? "Наличные" : "QR Pay"}
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
              Клиент отметил оплату
            </span>
          </>
        )}
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div style={s.details}>
          {/* Items */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              <Utensils size={12} />
              Состав заказа
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} style={s.itemRow}>
                <span style={s.itemName}>{item.name}</span>
                <span style={s.itemQty}>×{item.qnt}</span>
                <span style={s.itemPrice}>
                  {(item.price * item.qnt).toLocaleString()} ฿
                </span>
              </div>
            ))}
          </div>

          {/* Delivery & Payment */}
          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <Truck size={14} style={{ color: "#EA580C", flexShrink: 0 }} />
              <span style={s.infoLabel}>
                {order.delivery_type === "delivery" ? "Доставка" : "Самовывоз"}
              </span>
            </div>
            <div style={s.infoItem}>
              <Wallet size={14} style={{ color: "#16A34A", flexShrink: 0 }} />
              <span style={s.infoLabel}>
                {order.payment_method === "cash" ? "Наличные" : "QR PromptPay"}
              </span>
            </div>
          </div>

          {/* Customer info */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              <User size={12} />
              Клиент
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

          {/* Payment sent indicator */}
          {order.payment_sent && (
            <div style={s.paymentSentBox}>
              <AlertCircle size={16} style={{ color: "#2563EB", flexShrink: 0 }} />
              <div>
                <div style={s.paymentSentTitle}>Клиент отметил оплату</div>
                {order.payment_sent_at && (
                  <div style={s.paymentSentTime}>
                    {fmtTime(order.payment_sent_at)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total */}
          <div style={s.totalBox}>
            <span style={s.totalLabel}>Итого</span>
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
                    Подтвердить
                  </button>
                  <button
                    style={s.btnReject}
                    onClick={() => onReject?.(order.order_id)}
                    disabled={loading}
                  >
                    <XCircle size={16} />
                    Отклонить
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
                    Оплата получена
                  </button>
                  <button
                    style={s.btnReject}
                    onClick={() => onReject?.(order.order_id)}
                    disabled={loading}
                  >
                    <XCircle size={16} />
                    Отклонить
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
                  Заказ выполнен
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
                Убрать из списка
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const BORDER = "rgba(120, 80, 30, 0.16)";

const s: Record<string, CSSProperties> = {
  card: {
    background: "#FFFFFF",
    borderRadius: 14,
    border: `1px solid ${BORDER}`,
    overflow: "hidden",
    marginBottom: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px 8px",
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
    color: "#1A1208",
    letterSpacing: -0.3,
  },
  time: {
    fontSize: 12,
    color: "#9A8A78",
    fontVariantNumeric: "tabular-nums",
  },
  summary: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 16px 10px",
    cursor: "pointer",
    flexWrap: "wrap" as const,
  },
  total: {
    fontSize: 15,
    fontWeight: 900,
    color: "#E04E1B",
  },
  dot: {
    color: "#D4C8B8",
    fontSize: 12,
  },
  meta: {
    fontSize: 12,
    color: "#7A6650",
    fontWeight: 600,
  },
  paymentSentBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    padding: "2px 8px",
    borderRadius: 6,
  },

  /* Details (expanded) */
  details: {
    padding: "0 16px 14px",
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
    color: "#7A6650",
    marginBottom: 2,
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 8px",
    borderRadius: 8,
    background: "#F7F4F0",
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: "#1A1208",
  },
  itemQty: {
    fontSize: 12,
    color: "#7A6650",
    fontWeight: 600,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: 800,
    color: "#E04E1B",
    minWidth: 60,
    textAlign: "right" as const,
  },
  infoGrid: {
    display: "flex",
    gap: 10,
  },
  infoItem: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 10,
    background: "#F7F4F0",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#3D2E1E",
  },
  customerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px",
    borderRadius: 8,
    background: "#F7F4F0",
  },
  customerName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1A1208",
  },
  customerContact: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "#7A6650",
  },
  userIdRow: {
    fontSize: 11,
    color: "#9A8A78",
    padding: "2px 8px",
  },

  /* Payment sent box */
  paymentSentBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
  },
  paymentSentTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#2563EB",
  },
  paymentSentTime: {
    fontSize: 11,
    color: "#60A5FA",
  },

  /* Total */
  totalBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: 12,
    background: "#1A1208",
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: "#C4B8A8",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 900,
    color: "#FFFFFF",
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
    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(34,197,94,0.3)",
  },
  btnPaid: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
  },
  btnDone: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    background: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(6,182,212,0.3)",
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
    color: "#9A8A78",
    border: "1px solid #D4C8B8",
    padding: "10px 16px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
