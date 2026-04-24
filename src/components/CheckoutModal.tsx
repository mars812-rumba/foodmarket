import { useEffect, useState, type CSSProperties } from "react";
import { useCart } from "@/contexts/CartContext";
import { useTelegramContext } from "@/contexts/TelegramContext";
import { useOrder, type ClientOrderStatus } from "@/contexts/OrderContext";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
};

type Delivery = "pickup" | "delivery";
type Payment = "qr_prompt_pay" | "cash";

export default function CheckoutModal({ open, onClose, restaurantId }: Props) {
  const { cart, cartTotal, incQty, decQty, removeFromCart, clearCart, submitOrder } = useCart();
  const { user: tgUser, isTelegramEnvironment } = useTelegramContext();
  const { setActiveOrder, openModal: openOrderModal } = useOrder();

  const isTg = isTelegramEnvironment && !!tgUser;
  const tgUsername = tgUser?.username ? `@${tgUser.username}` : "";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<Payment>("qr_prompt_pay");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState("");

  // Auto-fill from Telegram when modal opens
  useEffect(() => {
    if (open && isTg && tgUsername) {
      setName(tgUsername);
    }
  }, [open, isTg, tgUsername]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Telegram users: phone is optional (contact via Telegram); web users: phone required
  const isValid =
    cart.length > 0 &&
    name.trim().length >= 2 &&
    (isTg || phone.trim().length >= 6) &&
    (delivery === "pickup" || address.trim().length >= 3);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    const res = await submitOrder(
      {
        name: name.trim(),
        phone: phone.trim(),
        delivery_type: delivery,
        address: delivery === "delivery" ? address.trim() : undefined,
        payment,
      },
      restaurantId
    );
    setSubmitting(false);

    if (res.ok) {
      setSuccessOrderId(res.orderId || "");
      setShowSuccess(true);
      clearCart();

      // Set active order in OrderContext so ClientOrderModal can track it
      const orderStatus: ClientOrderStatus = payment === "cash" ? "Work" : "Pbook";
      setActiveOrder({
        orderId: res.orderId || `local_${Date.now()}`,
        restaurantId,
        status: orderStatus,
        items: cart.map(l => ({
          name: l.item.name,
          price: l.item.price + l.selectedIngredients.reduce((s, i) => s + i.price, 0),
          qnt: l.qty,
        })),
        total: cartTotal,
        paymentMethod: payment,
        deliveryType: delivery,
        createdAt: new Date().toISOString(),
      });
    } else {
      toast.error("Не удалось оформить заказ", { description: res.error });
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    onClose();
    // Open the ClientOrderModal so user sees their order status
    openOrderModal();
  };

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.modal} role="dialog" aria-modal="true" aria-label="Оформление заказа">
        <div style={s.header}>
          <h2 style={s.title}>Оформление заказа</h2>
          <button onClick={onClose} style={s.close} aria-label="Закрыть">✕</button>
        </div>

        <div style={s.body}>
          {/* Cart lines */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Ваш заказ</div>
            {cart.length === 0 ? (
              <div style={s.emptyCart}>Корзина пуста</div>
            ) : (
              <div style={s.lines}>
                {cart.map((l) => (
                  <div key={l.uid} style={s.line}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.lineName}>{l.item.name}</div>
                      {l.selectedIngredients.length > 0 && (
                        <div style={s.lineIngs}>+ {l.selectedIngredients.map((i) => i.name).join(", ")}</div>
                      )}
                    </div>
                    <div style={s.qtyBox}>
                      <button style={s.qtyBtn} onClick={() => decQty(l.uid)} aria-label="Меньше">−</button>
                      <span style={s.qtyVal}>{l.qty}</span>
                      <button style={s.qtyBtn} onClick={() => incQty(l.uid)} aria-label="Больше">+</button>
                    </div>
                    <div style={s.linePrice}>{l.total} ₽</div>
                    <button style={s.lineDel} onClick={() => removeFromCart(l.uid)} aria-label="Удалить">✕</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Customer */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Контакты</div>
            {isTg && (
              <div style={s.tgContactBadge}>
                ✈️ Связь через Telegram
                {tgUsername && <span style={s.tgContactName}>{tgUsername}</span>}
              </div>
            )}
            <input
              style={s.input}
              placeholder={isTg ? "Имя (автозаполнено из Telegram)" : "Имя"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {!isTg && (
              <input
                style={s.input}
                placeholder="Телефон"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </section>

          {/* Delivery */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Получение</div>
            <div style={s.segmented}>
              <button
                style={{ ...s.segBtn, ...(delivery === "pickup" ? s.segBtnActive : {}) }}
                onClick={() => setDelivery("pickup")}
                type="button"
              >
                🚶 Самовывоз
              </button>
              <button
                style={{ ...s.segBtn, ...(delivery === "delivery" ? s.segBtnActive : {}) }}
                onClick={() => setDelivery("delivery")}
                type="button"
              >
                🛵 Доставка (Grab)
              </button>
            </div>
            {delivery === "delivery" && (
              <input
                style={{ ...s.input, marginTop: 8 }}
                placeholder="Адрес доставки"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            )}
          </section>

          {/* Payment */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Оплата</div>
            <div style={s.segmented}>
              <button
                style={{ ...s.segBtn, ...(payment === "qr_prompt_pay" ? s.segBtnActive : {}) }}
                onClick={() => setPayment("qr_prompt_pay")}
                type="button"
              >
                💳 QR Prompt Pay
              </button>
              <button
                style={{ ...s.segBtn, ...(payment === "cash" ? s.segBtnActive : {}) }}
                onClick={() => setPayment("cash")}
                type="button"
              >
                💵 Наличные
              </button>
            </div>
          </section>
        </div>

        <div style={s.footer}>
          <div style={s.totalRow}>
            <span style={s.totalLabel}>Итого</span>
            <span style={s.totalValue}>{cartTotal} ₽</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{ ...s.submit, opacity: !isValid || submitting ? 0.55 : 1, cursor: !isValid || submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Отправка..." : "Оформить заказ"}
          </button>
        </div>
      </div>

      {/* Success popup */}
      {showSuccess && (
        <>
          <div style={s.overlay} onClick={handleCloseSuccess} />
          <div style={s.successModal} role="dialog" aria-modal="true" aria-label="Заказ оформлен">
            <div style={s.successIcon}>✅</div>
            <h2 style={s.successTitle}>Заказ оформлен!</h2>
            {successOrderId && (
              <div style={s.successOrderId}>Номер заказа: <strong>{successOrderId}</strong></div>
            )}
            <div style={s.successInfo}>
              ⏳ Ожидайте подтверждения от ресторана!<br />
              🕐 Время готовки ~15 минут после подтверждения.
            </div>
            {payment === "cash" && (
              <div style={s.successCash}>
                💵 Оплата наличными — нажмите «Чат с Менеджером» в Telegram
              </div>
            )}
            <button style={s.successBtn} onClick={handleCloseSuccess}>
              Отлично!
            </button>
          </div>
        </>
      )}
    </>
  );
}

const BORDER = "rgba(120, 80, 30, 0.16)";

const s: Record<string, CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(20,10,5,0.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 220 },
  modal: {
    position: "fixed",
    left: "50%",
    bottom: 0,
    transform: "translateX(-50%)",
    width: "min(520px, 100vw)",
    maxHeight: "92vh",
    background: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 230,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 -24px 80px rgba(0,0,0,0.35)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    padding: "18px 20px 12px",
    borderBottom: `1px solid ${BORDER}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 900, color: "#1A1208", letterSpacing: -0.3 },
  close: {
    width: 32, height: 32, borderRadius: 10, border: `1px solid ${BORDER}`,
    background: "#FFFAF2", fontSize: 14, cursor: "pointer", color: "#7A6650",
    display: "grid", placeItems: "center",
  },
  body: { padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, flex: 1 },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: "uppercase", color: "#7A6650",
  },
  emptyCart: { padding: "16px", textAlign: "center", color: "#7A6650", fontSize: 14, background: "#F7F4F0", borderRadius: 12 },
  lines: { display: "flex", flexDirection: "column", gap: 8 },
  line: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 14,
    background: "#F7F4F0", border: "1px solid #EDE8E0",
  },
  lineName: { fontWeight: 800, fontSize: 14, color: "#1A1208" },
  lineIngs: { fontSize: 11, color: "#7A6650", marginTop: 2 },
  linePrice: { fontWeight: 800, fontSize: 14, color: "#E04E1B", flexShrink: 0, minWidth: 60, textAlign: "right" as const },
  lineDel: {
    width: 26, height: 26, borderRadius: 8, border: `1px solid ${BORDER}`,
    background: "#FFFAF2", cursor: "pointer", fontSize: 11, color: "#7A6650", flexShrink: 0,
  },
  qtyBox: {
    display: "flex", alignItems: "center", gap: 4,
    background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "2px",
  },
  qtyBtn: {
    width: 26, height: 26, border: "none", background: "transparent",
    cursor: "pointer", fontSize: 16, fontWeight: 900, color: "#1A1208", lineHeight: 1,
  },
  qtyVal: { minWidth: 18, textAlign: "center" as const, fontWeight: 800, fontSize: 13, color: "#1A1208" },
  input: {
    width: "100%", padding: "12px 14px", border: `1px solid ${BORDER}`, borderRadius: 12,
    fontSize: 14, fontFamily: "inherit", color: "#1A1208", background: "#FFFFFF",
    outline: "none", boxSizing: "border-box",
  },
  segmented: { display: "flex", gap: 8 },
  segBtn: {
    flex: 1, padding: "11px 10px", border: `1px solid ${BORDER}`,
    background: "#FFFAF2", borderRadius: 12, fontSize: 13, fontWeight: 700,
    color: "#3D2E1E", cursor: "pointer", fontFamily: "inherit",
  },
  segBtnActive: {
    background: "#1A1208", color: "#FFFFFF", borderColor: "#1A1208",
  },
  footer: {
    padding: "14px 20px 22px", borderTop: `1px solid ${BORDER}`,
    display: "flex", flexDirection: "column", gap: 10, background: "#FAFAF8",
  },
  totalRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#7A6650" },
  totalValue: { fontSize: 22, fontWeight: 900, color: "#1A1208" },
  submit: {
    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 50%, #15803D 100%)",
    color: "#FFFFFF", border: "none",
    padding: "15px 20px", borderRadius: 16, fontWeight: 900, fontSize: 15,
    letterSpacing: 0.4, width: "100%", fontFamily: "inherit",
    boxShadow: "0 6px 16px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
  },
  // Success popup styles
  successModal: {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(380px, 90vw)",
    background: "#FFFFFF",
    borderRadius: 24,
    zIndex: 250,
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    textAlign: "center" as const,
  },
  successIcon: { fontSize: 48, lineHeight: 1 },
  successTitle: { margin: 0, fontSize: 22, fontWeight: 900, color: "#1A1208" },
  successOrderId: { fontSize: 15, fontWeight: 600, color: "#3D2E1E" },
  successInfo: { fontSize: 14, color: "#7A6650", lineHeight: 1.6 },
  successCash: { fontSize: 13, color: "#E04E1B", fontWeight: 700, padding: "8px 12px", background: "#FFF7ED", borderRadius: 10 },
  tgContactBadge: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 14px", borderRadius: 12,
    background: "#E8F5FE", border: "1px solid #B3D9F7",
    fontSize: 13, fontWeight: 700, color: "#1A6DB5",
  },
  tgContactName: {
    fontWeight: 800, color: "#0D5A9E", fontSize: 12,
  },
  successBtn: {
    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
    color: "#FFFFFF", border: "none",
    padding: "14px 32px", borderRadius: 14, fontWeight: 900, fontSize: 15,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(34,197,94,0.4)",
  },
};
