import { useEffect, useMemo, type CSSProperties } from "react";
import { ShoppingBag, Truck, Wallet, User, Utensils, Hash, Store } from "lucide-react";
import { useTheme, type ThemeColors } from "@/contexts/ThemeContext";
import dayjs from "dayjs";

type OrderBooking = {
  booking_id: string;
  user_id?: string | number;
  status: string;
  order_type: string;
  created_at?: string;
  updated_at?: string;
  form_data?: {
    car?: { name: string; id: string | null };
    items?: Array<{ name: string; price: number; qnt: number }>;
    delivery_type?: string;
    payment_method?: string;
    restaurant_id?: string;
    contact?: { name: string; value: string };
    pricing?: { totalRental?: number; deposit?: number; delivery?: number };
    dates?: { start: string; end: string | null };
  };
};

type Props = {
  open: boolean;
  onClose: () => void;
  booking: OrderBooking | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "NEW", color: "#64748b", bg: "#f1f5f9" },
  pre_booking: { label: "PBOOK", color: "#ea580c", bg: "#fff7ed" },
  confirmed: { label: "BOOK", color: "#16a34a", bg: "#f0fdf4" },
  cancelled: { label: "CANCELLED", color: "#dc2626", bg: "#fef2f2" },
};

export default function OrderModal({ open, onClose, booking }: Props) {
  const C = useTheme();
  const s = useMemo(() => buildOrderStyles(C), [C]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !booking) return null;

  const fd = booking.form_data;
  const items = fd?.items || [];
  const total = fd?.pricing?.totalRental || 0;
  const statusInfo = STATUS_LABELS[booking.status] || STATUS_LABELS.new;
  const isTelegramUser = !String(booking.user_id || "").startsWith("web_");

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.modal} role="dialog" aria-modal="true" aria-label="Order Details">
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <ShoppingBag size={18} style={{ color: C.accent }} />
            <span style={s.headerTitle}>Order #{booking.booking_id}</span>
          </div>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">✕</button>
        </div>

        <div style={s.body}>
          {/* Status + Restaurant badge */}
          <div style={s.statusRow}>
            <span
              style={{
                ...s.statusBadge,
                backgroundColor: statusInfo.bg,
                color: statusInfo.color,
                borderColor: statusInfo.color,
              }}
            >
              {statusInfo.label}
            </span>
            {fd?.restaurant_id && (
              <span style={s.restaurantBadge}>
                <Store size={10} />
                {fd.restaurant_id}
              </span>
            )}
          </div>

          {/* Date */}
          {fd?.dates?.start && (
            <div style={s.dateRow}>
              <span style={s.dateLabel}>📅 Created:</span>
              <span style={s.dateValue}>{dayjs(fd.dates.start).format("DD.MM.YY HH:mm")}</span>
            </div>
          )}

          {/* Items table */}
          {items.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>
                <Utensils size={12} />
                Order Items
              </div>
              <table style={s.table}>
                <thead>
                  <tr style={s.tableHeadRow}>
                    <th style={{ ...s.tableHeadCell, textAlign: "left" }}>Dish</th>
                    <th style={{ ...s.tableHeadCell, textAlign: "center", width: 50 }}>Qty</th>
                    <th style={{ ...s.tableHeadCell, textAlign: "right", width: 70 }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={s.tableRow}>
                      <td style={s.tableCellName}>{item.name}</td>
                      <td style={s.tableCellCenter}>×{item.qnt}</td>
                      <td style={s.tableCellPrice}>{(item.price * item.qnt).toLocaleString()} ฿</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Delivery & Payment */}
          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <Truck size={14} style={{ color: C.accent, flexShrink: 0 }} />
              <div>
                <div style={s.infoLabel}>Pickup</div>
                <div style={s.infoValue}>
                  {fd?.delivery_type === "delivery" ? "🛵 Delivery" : "🚶 Pickup"}
                </div>
              </div>
            </div>
            <div style={s.infoItem}>
              <Wallet size={14} style={{ color: C.green, flexShrink: 0 }} />
              <div>
                <div style={s.infoLabel}>Payment</div>
                <div style={s.infoValue}>
                  {fd?.payment_method === "cash" ? "💵 Cash" : "💳 QR Prompt Pay"}
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              <User size={12} />
              Contact
            </div>
            <div style={s.contactBox}>
              {fd?.contact?.name && (
                <div style={s.contactName}>{fd.contact.name}</div>
              )}
              {isTelegramUser ? (
                <div style={s.contactMethod}>
                  <span style={s.tgIcon}>✈️</span> Contact via Telegram
                </div>
              ) : (
                fd?.contact?.value && (
                  <div style={s.contactMethod}>📱 {fd.contact.value}</div>
                )
              )}
            </div>
          </div>

          {/* Total */}
          <div style={{...s.totalBox, background: C.soft, border: `1px solid ${C.borderLight}`}}>
            <span style={{...s.totalLabel, color: C.muted}}>Total</span>
            <span style={{...s.totalValue, color: C.text}}>{total.toLocaleString()} ฿</span>
          </div>
        </div>
      </div>
    </>
  );
}

function buildOrderStyles(C: ThemeColors): Record<string, CSSProperties> {
  const BORDER = C.border;

  return {
    overlay: {
      position: "fixed",
      inset: 0,
      background: C.overlay,
      backdropFilter: "blur(3px)",
      WebkitBackdropFilter: "blur(3px)",
      zIndex: 300,
    },
    modal: {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(440px, 92vw)",
      maxHeight: "85vh",
      background: C.bg,
      borderRadius: 20,
      zIndex: 310,
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: "hidden",
    },
    header: {
      padding: "16px 20px 12px",
      borderBottom: `1px solid ${BORDER}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    headerTitle: {
      margin: 0,
      fontSize: 16,
      fontWeight: 900,
      color: C.text,
      letterSpacing: -0.3,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: `1px solid ${BORDER}`,
      background: C.cream,
      fontSize: 13,
      cursor: "pointer",
      color: C.muted,
      display: "grid",
      placeItems: "center",
    },
    body: {
      padding: "16px 20px 20px",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      flex: 1,
    },
    statusRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    statusBadge: {
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 0.8,
      padding: "3px 10px",
      borderRadius: 6,
      border: "1px solid",
      textTransform: "uppercase",
    },
    restaurantBadge: {
      fontSize: 9,
      fontWeight: 800,
      color: C.accent,
      background: C.accentSoft,
      border: `1px solid ${C.borderLight}`,
      padding: "2px 8px",
      borderRadius: 5,
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      textTransform: "uppercase",
    },
    dateRow: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      color: C.muted,
    },
    dateLabel: { fontWeight: 700 },
    dateValue: { fontWeight: 600, fontFamily: "monospace" },
    section: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.muted,
      display: "flex",
      alignItems: "center",
      gap: 4,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      fontSize: 12,
    },
    tableHeadRow: {
      borderBottom: `1px solid ${C.borderLight}`,
    },
    tableHeadCell: {
      fontSize: 9,
      fontWeight: 800,
      color: C.muted,
      textTransform: "uppercase",
      padding: "4px 0",
      letterSpacing: 0.5,
    },
    tableRow: {
      borderBottom: `1px solid ${C.borderLight}`,
    },
    tableCellName: {
      padding: "5px 0",
      fontWeight: 700,
      color: C.textSoft,
      fontSize: 12,
    },
    tableCellCenter: {
      padding: "5px 0",
      textAlign: "center" as const,
      color: C.muted,
      fontSize: 12,
    },
    tableCellPrice: {
      padding: "5px 0",
      textAlign: "right" as const,
      fontWeight: 800,
      color: C.text,
      fontSize: 12,
    },
    infoGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    infoItem: {
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      padding: "8px 10px",
      background: C.soft,
      borderRadius: 10,
      border: `1px solid ${C.borderLight}`,
    },
    infoLabel: {
      fontSize: 9,
      fontWeight: 800,
      color: C.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 12,
      fontWeight: 700,
      color: C.textSoft,
      marginTop: 1,
    },
    contactBox: {
      padding: "8px 12px",
      background: C.soft,
      borderRadius: 10,
      border: `1px solid ${C.borderLight}`,
    },
    contactName: {
      fontSize: 13,
      fontWeight: 800,
      color: C.text,
    },
    contactMethod: {
      fontSize: 11,
      color: C.muted,
      marginTop: 2,
      display: "flex",
      alignItems: "center",
      gap: 4,
    },
    tgIcon: {
      fontSize: 12,
    },
    totalBox: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      background: C.soft,
      borderRadius: 12,
      border: `1px solid ${C.borderLight}`,
    },
    totalLabel: {
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.muted,
    },
    totalValue: {
      fontSize: 20,
      fontWeight: 900,
      color: C.text,
    },
  };
}
