import { useEffect, useState, useMemo, type CSSProperties } from "react";
import { useCart } from "@/contexts/CartContext";
import { useTelegramContext } from "@/contexts/TelegramContext";
import { useOrder, type ClientOrderStatus } from "@/contexts/OrderContext";
import { toast } from "sonner";
import { CreditCard, Banknote, CheckCircle2, Send, Truck, MapPin } from "lucide-react";
import { useTheme, type ThemeColors } from "@/contexts/ThemeContext";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
};

type Delivery = "pickup" | "delivery";
type Payment = "qr_prompt_pay" | "cash";

export default function CheckoutModal({ open, onClose, restaurantId }: Props) {
  const C = useTheme();
  const s = useMemo(() => buildCheckoutStyles(C), [C]);
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

  // Validation is informational only — order submits regardless
  const isValid =
    cart.length > 0 &&
    name.trim().length >= 2 &&
    (isTg || phone.trim().length >= 6) &&
    (delivery === "pickup" || address.trim().length >= 3);

  const handleSubmit = async () => {
    if (submitting) return;
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
      toast.error("Failed to place order", { description: res.error });
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
      <div style={s.modal} role="dialog" aria-modal="true" aria-label="Checkout">
        <div style={s.header}>
          <h2 style={s.title}>Checkout</h2>
          <button onClick={onClose} style={s.close} aria-label="Close">✕</button>
        </div>

        <div style={s.body}>
          {/* Cart lines */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Your Order</div>
            {cart.length === 0 ? (
              <div style={s.emptyCart}>Cart is empty</div>
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
                      <button style={s.qtyBtn} onClick={() => decQty(l.uid)} aria-label="Decrease">−</button>
                      <span style={s.qtyVal}>{l.qty}</span>
                      <button style={s.qtyBtn} onClick={() => incQty(l.uid)} aria-label="Increase">+</button>
                    </div>
                    <div style={s.linePrice}>{l.total} ฿</div>
                    <button style={s.lineDel} onClick={() => removeFromCart(l.uid)} aria-label="Remove">✕</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Customer */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Contacts</div>
            {isTg && (
              <div style={s.tgContactBadge}>
                <Send size={14} style={{display:"inline",verticalAlign:"middle",marginRight:4}} /> Contact via Telegram
                {tgUsername && <span style={s.tgContactName}>{tgUsername}</span>}
              </div>
            )}
            <input
              style={s.input}
              placeholder={isTg ? "Name (auto-filled from Telegram)" : "Name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {!isTg && (
              <input
                style={s.input}
                placeholder="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </section>

          {/* Delivery */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Pickup</div>
            <div style={s.segmented}>
              <button
                style={{ ...s.segBtn, ...(delivery === "pickup" ? s.segBtnActive : {}) }}
                onClick={() => setDelivery("pickup")}
                type="button"
              >
                <MapPin size={16} style={{display:"inline",verticalAlign:"middle",marginRight:4}} /> Pickup
              </button>
              <button
                style={{ ...s.segBtn, ...(delivery === "delivery" ? s.segBtnActive : {}) }}
                onClick={() => setDelivery("delivery")}
                type="button"
              >
                <Truck size={16} style={{display:"inline",verticalAlign:"middle",marginRight:4}} /> Delivery (Grab)
              </button>
            </div>
            {delivery === "delivery" && (
              <input
                style={{ ...s.input, marginTop: 8 }}
                placeholder="Delivery address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            )}
          </section>

          {/* Payment */}
          <section style={s.section}>
            <div style={s.sectionLabel}>Payment</div>
            <div style={s.segmented}>
              <button
                style={{ ...s.segBtn, ...(payment === "qr_prompt_pay" ? s.segBtnActive : {}) }}
                onClick={() => setPayment("qr_prompt_pay")}
                type="button"
              >
                <CreditCard size={16} style={{display:"inline",verticalAlign:"middle",marginRight:4}} /> QR Prompt Pay
              </button>
              <button
                style={{ ...s.segBtn, ...(payment === "cash" ? s.segBtnActive : {}) }}
                onClick={() => setPayment("cash")}
                type="button"
              >
                <Banknote size={16} style={{display:"inline",verticalAlign:"middle",marginRight:4}} /> Cash
              </button>
            </div>
          </section>
        </div>

        <div style={s.footer}>
          <div style={s.totalRow}>
            <span style={s.totalLabel}>Total</span>
            <span style={s.totalValue}>{cartTotal} ฿</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...s.submit, opacity: submitting ? 0.55 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Submitting..." : "Place Order"}
          </button>
        </div>
      </div>

      {/* Success popup */}
      {showSuccess && (
        <>
          <div style={s.overlay} onClick={handleCloseSuccess} />
          <div style={s.successModal} role="dialog" aria-modal="true" aria-label="Order placed">
            <div style={s.successIcon}><CheckCircle2 size={48} style={{color:"#16A34A"}} /></div>
            <h2 style={s.successTitle}>Order Placed!</h2>
            {successOrderId && (
              <div style={s.successOrderId}>Order #: <strong>{successOrderId}</strong></div>
            )}
            <div style={s.successInfo}>
              Waiting for restaurant confirmation!<br />
              Cooking time ~15 minutes after confirmation.
            </div>
            {payment === "cash" && (
              <div style={s.successCash}>
                <Banknote size={16} style={{display:"inline",verticalAlign:"middle",marginRight:4}} /> Cash payment — click "Chat with Manager" in Telegram
              </div>
            )}
            <button style={s.successBtn} onClick={handleCloseSuccess}>
              Got it!
            </button>
          </div>
        </>
      )}
    </>
  );
}

const BORDER = "rgba(120, 80, 30, 0.16)";

function buildCheckoutStyles(C: ThemeColors): Record<string, CSSProperties> {
  const BORDER = C.border;
  return {
  overlay: { position: "fixed", inset: 0, background: C.overlay, backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 220 },
  modal: {
    position: "fixed",
    left: "50%",
    bottom: 0,
    transform: "translateX(-50%)",
    width: "min(520px, 100vw)",
    maxHeight: "92vh",
    background: C.bg,
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
  title: { margin: 0, fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: -0.3 },
  close: {
    width: 32, height: 32, borderRadius: 10, border: `1px solid ${BORDER}`,
    background: C.cream, fontSize: 14, cursor: "pointer", color: C.muted,
    display: "grid", placeItems: "center",
  },
  body: { padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, flex: 1 },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: "uppercase", color: C.muted,
  },
  emptyCart: { padding: "16px", textAlign: "center", color: C.muted, fontSize: 14, background: C.soft, borderRadius: 12 },
  lines: { display: "flex", flexDirection: "column", gap: 8 },
  line: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 14,
    background: C.soft, border: `1px solid ${C.borderLight}`,
  },
  lineName: { fontWeight: 800, fontSize: 14, color: C.text },
  lineIngs: { fontSize: 11, color: C.muted, marginTop: 2 },
  linePrice: { fontWeight: 800, fontSize: 14, color: C.accentDeep, flexShrink: 0, minWidth: 60, textAlign: "right" as const },
  lineDel: {
    width: 26, height: 26, borderRadius: 8, border: `1px solid ${BORDER}`,
    background: C.cream, cursor: "pointer", fontSize: 11, color: C.muted, flexShrink: 0,
  },
  qtyBox: {
    display: "flex", alignItems: "center", gap: 4,
    background: C.bg, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "2px",
  },
  qtyBtn: {
    width: 26, height: 26, border: "none", background: "transparent",
    cursor: "pointer", fontSize: 16, fontWeight: 900, color: C.text, lineHeight: 1,
  },
  qtyVal: { minWidth: 18, textAlign: "center" as const, fontWeight: 800, fontSize: 13, color: C.text },
  input: {
    width: "100%", padding: "12px 14px", border: `1px solid ${BORDER}`, borderRadius: 12,
    fontSize: 14, fontFamily: "inherit", color: C.text, background: C.bg,
    outline: "none", boxSizing: "border-box",
  },
  segmented: { display: "flex", gap: 8 },
  segBtn: {
    flex: 1, padding: "11px 10px", border: `1px solid ${BORDER}`,
    background: C.cream, borderRadius: 12, fontSize: 13, fontWeight: 700,
    color: C.textSoft, cursor: "pointer", fontFamily: "inherit",
  },
  segBtnActive: {
    background: C.text, color: C.bg, borderColor: C.text,
  },
  footer: {
    padding: "14px 20px 22px", borderTop: `1px solid ${BORDER}`,
    display: "flex", flexDirection: "column", gap: 10, background: C.cream,
  },
  totalRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: C.muted },
  totalValue: { fontSize: 22, fontWeight: 900, color: C.text, background: "transparent" },
  submit: {
    background: C.greenGradient,
    color: C.white, border: "none",
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
    background: C.bg,
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
  successTitle: { margin: 0, fontSize: 22, fontWeight: 900, color: C.text },
  successOrderId: { fontSize: 15, fontWeight: 600, color: C.textSoft },
  successInfo: { fontSize: 14, color: C.muted, lineHeight: 1.6 },
  successCash: { fontSize: 13, color: C.accentDeep, fontWeight: 700, padding: "8px 12px", background: C.accentSoft, borderRadius: 10 },
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
    background: C.greenGradient,
    color: C.white, border: "none",
    padding: "14px 32px", borderRadius: 14, fontWeight: 900, fontSize: 15,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(34,197,94,0.4)",
  },
  };
}
