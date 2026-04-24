import { useEffect, useState, type CSSProperties } from "react";
import {
  Receipt,
  MessageCircle,
  QrCode,
  CheckCircle2,
  Clock,
  Utensils,
  Truck,
  Wallet,
  X,
  XCircle,
  Send,
  CheckCheck,
} from "lucide-react";
import { useOrder, type ActiveOrder, type ClientOrderStatus } from "@/contexts/OrderContext";

/* ============================================================
   TRANSLATION KEYS (no hardcoded strings in UI)
   ============================================================ */

const T = {
  orderNumber: "order.number",
  orderStatus: "order.status",
  orderItems: "order.items",
  orderTotal: "order.total",
  btnClose: "order.btnClose",
  btnContactManager: "order.btnContactManager",
  btnGotIt: "order.btnGotIt",
  btnPaymentSent: "order.btnPaymentSent",
  btnPaymentSentDone: "order.btnPaymentSentDone",
  btnCompleteOrder: "order.btnCompleteOrder",
  statusWork_title: "order.statusWork.title",
  statusWork_desc: "order.statusWork.desc",
  statusWork_action: "order.statusWork.action",
  statusPbook_title: "order.statusPbook.title",
  statusPbook_desc: "order.statusPbook.desc",
  statusPbook_timer: "order.statusPbook.timer",
  statusPbook_qrHint: "order.statusPbook.qrHint",
  statusPbook_paymentSentNote: "order.statusPbook.paymentSentNote",
  statusBook_title: "order.statusBook.title",
  statusBook_desc: "order.statusBook.desc",
  statusBook_cooking: "order.statusBook.cooking",
  statusDone_title: "order.statusDone.title",
  statusDone_desc: "order.statusDone.desc",
  deliveryPickup: "order.delivery.pickup",
  deliveryDelivery: "order.delivery.delivery",
  paymentCash: "order.payment.cash",
  paymentQr: "order.payment.qr",
  timerExpired: "order.timer.expired",
  btnCancelOrder: "order.btnCancelOrder",
  cancelConfirm: "order.cancelConfirm",
};

/* ============================================================
   DEFAULT RU TRANSLATIONS (swap for i18n later)
   ============================================================ */

const RU: Record<string, string> = {
  [T.orderNumber]: "Заказ",
  [T.orderStatus]: "Статус",
  [T.orderItems]: "Состав заказа",
  [T.orderTotal]: "Итого",
  [T.btnClose]: "Закрыть",
  [T.btnContactManager]: "Связаться с менеджером",
  [T.btnGotIt]: "Понятно",
  [T.btnPaymentSent]: "Отправил",
  [T.btnPaymentSentDone]: "Оплата отмечена",
  [T.btnCompleteOrder]: "Заказ завершён",
  [T.statusWork_title]: "Ожидание подтверждения",
  [T.statusWork_desc]: "Для подтверждения заказа свяжитесь с менеджером",
  [T.statusWork_action]: "Нажмите кнопку ниже, чтобы менеджер подтвердил заказ",
  [T.statusPbook_title]: "Ожидание оплаты",
  [T.statusPbook_desc]: "Оплатите заказ для начала готовки",
  [T.statusPbook_timer]: "Время на оплату",
  [T.statusPbook_qrHint]: "Отсканируйте QR-код для оплаты",
  [T.statusPbook_paymentSentNote]: "Вы отметили оплату. Менеджер проверит и подтвердит заказ.",
  [T.statusBook_title]: "Заказ подтверждён",
  [T.statusBook_desc]: "Ваш заказ готовится!",
  [T.statusBook_cooking]: "Обычно мы справляемся за 15–20 минут. Мы сообщим Вам о готовности.",
  [T.statusDone_title]: "Заказ готов",
  [T.statusDone_desc]: "Забирайте! Ваш заказ готов к получению!",
  [T.deliveryPickup]: "Самовывоз",
  [T.deliveryDelivery]: "Доставка",
  [T.paymentCash]: "Наличные",
  [T.paymentQr]: "QR Prompt Pay",
  [T.timerExpired]: "Время истекло",
  [T.btnCancelOrder]: "Отменить заказ",
  [T.cancelConfirm]: "Вы уверены, что хотите отменить заказ?",
};

function t(key: string): string {
  return RU[key] || key;
}

/* ============================================================
   STATUS CONFIG
   ============================================================ */

type StatusConfig = {
  icon: React.ReactNode;
  color: string;
  bg: string;
  borderColor: string;
  label: string;
};

const STATUS_CONFIG: Record<ClientOrderStatus, StatusConfig> = {
  Work: {
    icon: <Clock size={28} />,
    color: "#D97706",
    bg: "#FFFBEB",
    borderColor: "#F59E0B",
    label: "WORK",
  },
  Pbook: {
    icon: <QrCode size={28} />,
    color: "#EA580C",
    bg: "#FFF7ED",
    borderColor: "#F97316",
    label: "PBOOK",
  },
  Book: {
    icon: <CheckCircle2 size={28} />,
    color: "#16A34A",
    bg: "#F0FDF4",
    borderColor: "#22C55E",
    label: "BOOK",
  },
  Done: {
    icon: <CheckCircle2 size={28} />,
    color: "#0891B2",
    bg: "#ECFEFF",
    borderColor: "#06B6D4",
    label: "DONE",
  },
};

/* ============================================================
   TIMER HOOK (15 min from createdAt, survives reload)
   ============================================================ */

const TIMER_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function useCountdown(createdAt: string | undefined): {
  mm: string;
  ss: string;
  expired: boolean;
} {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!createdAt) return { mm: "15", ss: "00", expired: false };

  const createdMs = new Date(createdAt).getTime();
  const elapsed = now - createdMs;
  const remaining = Math.max(0, TIMER_DURATION_MS - elapsed);
  const expired = remaining <= 0;

  const totalSec = Math.floor(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  return { mm, ss, expired };
}

/* ============================================================
   PROPS
   ============================================================ */

type Props = {
  /** QR code image URL from restaurant config */
  paymentQrUrl?: string;
  /** Telegram @username of the restaurant manager for "Contact Manager" */
  managerUsername?: string;
};

/* ============================================================
   COMPONENT
   ============================================================ */

const API_URL =
  import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

export default function ClientOrderModal({
  paymentQrUrl,
  managerUsername,
}: Props) {
  const { activeOrder, modalOpen, closeModal, clearOrder, cancelOrder, completeOrder, needsAttention } =
    useOrder();
  const timer = useCountdown(activeOrder?.createdAt);
  const [paymentSent, setPaymentSent] = useState(false);
  const [sendingPayment, setSendingPayment] = useState(false);

  // ESC key
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  if (!modalOpen || !activeOrder) return null;

  const config = STATUS_CONFIG[activeOrder.status];

  const handleContactManager = () => {
    // Open manager's Telegram profile — user can message directly
    const username = managerUsername || "LoftFireBot";
    const chatLink = `https://t.me/${username}`;

    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(chatLink);
        setTimeout(() => {
          try { tg.close(); } catch { /* ignore */ }
        }, 500);
      } else {
        window.open(chatLink, "_blank");
      }
    } catch {
      window.open(chatLink, "_blank");
    }
  };

  const handlePaymentSent = async () => {
    if (!activeOrder || paymentSent || sendingPayment) return;
    setSendingPayment(true);
    try {
      await fetch(
        `${API_URL}/api/${activeOrder.restaurantId}/orders/${activeOrder.orderId}/payment-sent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_sent: true }),
        }
      );
      setPaymentSent(true);
    } catch {
      // Even on error, mark locally so user doesn't get stuck
      setPaymentSent(true);
    } finally {
      setSendingPayment(false);
    }
  };

  const handleCompleteOrder = () => {
    completeOrder();
  };

  const handleCancelOrder = () => {
    if (!activeOrder) return;
    if (!window.confirm(t(T.cancelConfirm))) return;
    cancelOrder();
  };

  return (
    <>
      {/* Overlay */}
      <div style={s.overlay} onClick={closeModal} />

      {/* Modal */}
      <div style={s.modal} role="dialog" aria-modal="true">
        {/* ── Header ── */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <Receipt size={18} style={{ color: config.color }} />
            <span style={s.headerTitle}>
              {t(T.orderNumber)} #{activeOrder.orderId}
            </span>
          </div>
          <button onClick={closeModal} style={s.closeBtn} aria-label={t(T.btnClose)}>
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={s.body}>
          {/* Status badge */}
          <div style={s.statusRow}>
            <span
              style={{
                ...s.statusBadge,
                backgroundColor: config.bg,
                color: config.color,
                borderColor: config.borderColor,
              }}
            >
              {config.icon}
              <span style={{ marginLeft: 6 }}>{config.label}</span>
            </span>
          </div>

          {/* ── Status-specific content ── */}
          {activeOrder.status === "Work" && (
            <WorkContent />
          )}
          {activeOrder.status === "Pbook" && (
            <PbookContent
              qrUrl={paymentQrUrl}
              timer={timer}
            />
          )}
          {activeOrder.status === "Book" && <BookContent />}
          {activeOrder.status === "Done" && <DoneContent />}

          {/* ── Order items ── */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              <Utensils size={12} />
              {t(T.orderItems)}
            </div>
            <div style={s.itemsList}>
              {activeOrder.items.map((item, idx) => (
                <div key={idx} style={s.itemRow}>
                  <span style={s.itemName}>{item.name}</span>
                  <span style={s.itemQty}>×{item.qnt}</span>
                  <span style={s.itemPrice}>
                    {(item.price * item.qnt).toLocaleString()} ฿
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Delivery & Payment ── */}
          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <Truck size={14} style={{ color: "#EA580C", flexShrink: 0 }} />
              <div>
                <div style={s.infoLabel}>
                  {activeOrder.deliveryType === "delivery"
                    ? t(T.deliveryDelivery)
                    : t(T.deliveryPickup)}
                </div>
              </div>
            </div>
            <div style={s.infoItem}>
              <Wallet size={14} style={{ color: "#16A34A", flexShrink: 0 }} />
              <div>
                <div style={s.infoLabel}>
                  {activeOrder.paymentMethod === "cash"
                    ? t(T.paymentCash)
                    : t(T.paymentQr)}
                </div>
              </div>
            </div>
          </div>

          {/* ── Total ── */}
          <div style={s.totalBox}>
            <span style={s.totalLabel}>{t(T.orderTotal)}</span>
            <span style={s.totalValue}>
              {activeOrder.total.toLocaleString()} ฿
            </span>
          </div>
        </div>

        {/* ── Footer action ── */}
        <div style={s.footer}>
          {activeOrder.status === "Work" && (
            <>
              <button style={s.btnContact} onClick={handleContactManager}>
                <MessageCircle size={18} />
                {t(T.btnContactManager)}
              </button>
              <button style={s.btnCancel} onClick={handleCancelOrder}>
                <XCircle size={16} />
                {t(T.btnCancelOrder)}
              </button>
            </>
          )}
          {activeOrder.status === "Pbook" && (
            <>
              <div style={s.timerFooter}>
                <Clock size={14} style={{ color: "#EA580C" }} />
                <span style={s.timerText}>
                  {timer.expired
                    ? t(T.timerExpired)
                    : `${t(T.statusPbook_timer)}: ${timer.mm}:${timer.ss}`}
                </span>
              </div>
              <button
                style={paymentSent ? s.btnPaymentSentDone : s.btnPaymentSent}
                onClick={handlePaymentSent}
                disabled={paymentSent || sendingPayment}
              >
                {paymentSent ? (
                  <>
                    <CheckCheck size={18} />
                    {t(T.btnPaymentSentDone)}
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    {sendingPayment ? "..." : t(T.btnPaymentSent)}
                  </>
                )}
              </button>
              {paymentSent && (
                <p style={s.paymentSentNote}>{t(T.statusPbook_paymentSentNote)}</p>
              )}
              <button style={s.btnCancel} onClick={handleCancelOrder}>
                <XCircle size={16} />
                {t(T.btnCancelOrder)}
              </button>
            </>
          )}
          {activeOrder.status === "Book" && (
            <>
              <button style={s.btnContact} onClick={handleContactManager}>
                <MessageCircle size={18} />
                {t(T.btnContactManager)}
              </button>
              <button style={s.btnComplete} onClick={handleCompleteOrder}>
                <CheckCircle2 size={18} />
                {t(T.btnCompleteOrder)}
              </button>
            </>
          )}
          {activeOrder.status === "Done" && (
            <button style={s.btnDone} onClick={handleCompleteOrder}>
              {t(T.btnGotIt)}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   STATUS-SPECIFIC SUB-COMPONENTS
   ============================================================ */

function WorkContent() {
  return (
    <div style={{ ...s.statusBlock, borderColor: STATUS_CONFIG.Work.borderColor }}>
      <div style={s.statusIconWrap}>
        <Clock size={32} style={{ color: STATUS_CONFIG.Work.color }} />
      </div>
      <h3 style={s.statusTitle}>{t(T.statusWork_title)}</h3>
      <p style={s.statusDesc}>{t(T.statusWork_desc)}</p>
      <p style={s.statusAction}>{t(T.statusWork_action)}</p>
    </div>
  );
}

function PbookContent({
  qrUrl,
  timer,
}: {
  qrUrl?: string;
  timer: { mm: string; ss: string; expired: boolean };
}) {
  return (
    <div style={{ ...s.statusBlock, borderColor: STATUS_CONFIG.Pbook.borderColor }}>
      <div style={s.statusIconWrap}>
        <QrCode size={32} style={{ color: STATUS_CONFIG.Pbook.color }} />
      </div>
      <h3 style={s.statusTitle}>{t(T.statusPbook_title)}</h3>
      <p style={s.statusDesc}>{t(T.statusPbook_desc)}</p>

      {/* Timer */}
      <div style={s.timerBox}>
        <Clock size={16} style={{ color: "#EA580C" }} />
        <span style={s.timerDigits}>
          {timer.expired ? t(T.timerExpired) : `${timer.mm}:${timer.ss}`}
        </span>
      </div>

      {/* QR Code image */}
      {qrUrl && (
        <div style={s.qrBox}>
          <img
            src={qrUrl}
            alt="PromptPay QR"
            style={s.qrImg}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <p style={s.qrHint}>{t(T.statusPbook_qrHint)}</p>
        </div>
      )}
    </div>
  );
}

function BookContent() {
  return (
    <div style={{ ...s.statusBlock, borderColor: STATUS_CONFIG.Book.borderColor }}>
      <div style={s.statusIconWrap}>
        <Utensils size={36} style={{ color: STATUS_CONFIG.Book.color }} />
      </div>
      <h3 style={s.statusTitle}>{t(T.statusBook_title)}</h3>
      <p style={s.statusDesc}>{t(T.statusBook_desc)}</p>
      <p style={s.cookingNote}>{t(T.statusBook_cooking)}</p>
    </div>
  );
}

function DoneContent() {
  return (
    <div style={{ ...s.statusBlock, borderColor: STATUS_CONFIG.Done.borderColor }}>
      <div style={s.statusIconWrap}>
        <CheckCircle2 size={40} style={{ color: STATUS_CONFIG.Done.color }} />
      </div>
      <h3 style={s.statusTitle}>{t(T.statusDone_title)}</h3>
      <p style={s.statusDesc}>{t(T.statusDone_desc)}</p>
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const BORDER = "rgba(120, 80, 30, 0.16)";

const s: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(20,10,5,0.55)",
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
    maxHeight: "88vh",
    background: "#FFFFFF",
    borderRadius: 20,
    zIndex: 310,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
    fontSize: 16,
    fontWeight: 900,
    color: "#1A1208",
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: `1px solid ${BORDER}`,
    background: "#FFFAF2",
    cursor: "pointer",
    color: "#7A6650",
    display: "grid",
    placeItems: "center",
  },
  body: {
    padding: "16px 20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    flex: 1,
  },

  /* Status badge */
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.8,
  },

  /* Status block (Work/Pbook/Book/Done) */
  statusBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "20px 16px",
    borderRadius: 16,
    border: "1px solid",
    background: "#FFFAF2",
    textAlign: "center" as const,
  },
  statusIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "#FFFFFF",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  statusTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#1A1208",
  },
  statusDesc: {
    margin: 0,
    fontSize: 14,
    color: "#7A6650",
    lineHeight: 1.5,
  },
  statusAction: {
    margin: 0,
    fontSize: 12,
    color: "#9A8A78",
    lineHeight: 1.4,
  },


  /* Timer */
  timerBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: 10,
    background: "#FFF7ED",
    border: "1px solid #FDBA74",
  },
  timerDigits: {
    fontSize: 20,
    fontWeight: 900,
    color: "#EA580C",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: 1,
  },

  /* QR */
  qrBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  qrImg: {
    width: 180,
    height: 180,
    objectFit: "contain",
    borderRadius: 12,
    border: "1px solid #EDE8E0",
    background: "#FFFFFF",
  },
  qrHint: {
    margin: 0,
    fontSize: 12,
    color: "#9A8A78",
  },

  /* Items */
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    color: "#7A6650",
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 10,
    background: "#F7F4F0",
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 700,
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

  /* Info grid */
  infoGrid: {
    display: "flex",
    gap: 12,
  },
  infoItem: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 12,
    background: "#F7F4F0",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#3D2E1E",
  },

  /* Total */
  totalBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderRadius: 14,
    background: "#1A1208",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: "#C4B8A8",
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 900,
    color: "#FFFFFF",
  },

  /* Footer */
  footer: {
    padding: "14px 20px 22px",
    borderTop: `1px solid ${BORDER}`,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "#FAFAF8",
  },
  btnContact: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 20px",
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(34,197,94,0.4)",
  },
  btnDone: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 20px",
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(34,197,94,0.4)",
  },
  btnCancel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "transparent",
    color: "#9A8A78",
    border: "1px solid #D4C8B8",
    padding: "10px 20px",
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnPaymentSent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 20px",
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
  },
  btnPaymentSentDone: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 20px",
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 15,
    cursor: "default",
    fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
  },
  paymentSentNote: {
    margin: 0,
    fontSize: 12,
    color: "#2563EB",
    textAlign: "center" as const,
    lineHeight: 1.4,
  },
  cookingNote: {
    margin: 0,
    fontSize: 13,
    color: "#16A34A",
    fontWeight: 600,
    textAlign: "center" as const,
    lineHeight: 1.5,
  },
  btnComplete: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "linear-gradient(135deg, #0891B2 0%, #0E7490 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 20px",
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(8,145,178,0.4)",
  },
  timerFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "8px",
  },
  timerText: {
    fontSize: 14,
    fontWeight: 800,
    color: "#EA580C",
    fontVariantNumeric: "tabular-nums",
  },
};
