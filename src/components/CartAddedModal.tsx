import { useMemo, type CSSProperties } from "react";
import { ShoppingCart, CreditCard, UtensilsCrossed } from "lucide-react";
import { useCart, type CartLine } from "@/contexts/CartContext";
import { useTheme, type ThemeColors } from "@/contexts/ThemeContext";

type Props = {
  /** Название блюда, которое только что добавили */
  addedItemName: string | null;
  /** Закрыть модалку */
  onClose: () => void;
  /** Перейти к оформлению заказа */
  onCheckout: () => void;
};

export default function CartAddedModal({ addedItemName, onClose, onCheckout }: Props) {
  const C = useTheme();
  const s = useMemo(() => buildStyles(C), [C]);
  const { cart, cartTotal, cartCount } = useCart();

  if (!addedItemName) return null;

  const handleCheckout = () => {
    onClose();
    onCheckout();
  };

  return (
    <>
      {/* Overlay */}
      <div style={s.overlay} onClick={onClose} />
      {/* Modal */}
      <div style={s.modal} role="dialog" aria-modal="true" aria-label="Added to cart">
        {/* Header */}
        <div style={s.header}>
          <div style={s.checkCircle}>
            <ShoppingCart size={22} />
          </div>
          <div style={s.headerText}>
            <div style={s.headerTitle}>Добавлено в корзину</div>
            <div style={s.headerItemName}>{addedItemName}</div>
          </div>
        </div>

        {/* Cart items list */}
        <div style={s.listWrap}>
          <div style={s.listLabel}>Ваша корзина ({cartCount})</div>
          <div style={s.list}>
            {cart.map((line: CartLine) => (
              <div key={line.uid} style={s.line}>
                <div style={s.lineInfo}>
                  <span style={s.lineName}>{line.item.name}</span>
                  {line.selectedIngredients.length > 0 && (
                    <span style={s.lineIngs}>
                      + {line.selectedIngredients.map((i) => i.name).join(", ")}
                    </span>
                  )}
                </div>
                <div style={s.lineRight}>
                  {line.qty > 1 && <span style={s.lineQty}>×{line.qty}</span>}
                  <span style={s.linePrice}>{line.total} ฿</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div style={s.totalRow}>
          <span style={s.totalLabel}>Итого</span>
          <span style={s.totalValue}>{cartTotal} ฿</span>
        </div>

        {/* Buttons */}
        <div style={s.buttons}>
          <button style={s.continueBtn} onClick={onClose}>
            <UtensilsCrossed size={18} />
            <span>Продолжить</span>
          </button>
          <button style={s.checkoutBtn} onClick={handleCheckout}>
            <CreditCard size={18} />
            <span>Оформить</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
function buildStyles(C: ThemeColors): Record<string, CSSProperties> {
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
      width: "min(380px, calc(100vw - 32px))",
      maxHeight: "calc(100vh - 40px)",
      background: C.bg,
      borderRadius: 24,
      overflow: "hidden",
      zIndex: 310,
      boxShadow: "0 24px 80px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.15)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },

    /* Header */
    header: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "20px 20px 16px",
    },
    checkCircle: {
      width: 48,
      height: 48,
      borderRadius: 16,
      background: C.greenGradient,
      color: C.white,
      display: "grid",
      placeItems: "center",
      flexShrink: 0,
      boxShadow: "0 4px 14px rgba(34,197,94,0.4)",
    },
    headerText: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      minWidth: 0,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: 800,
      color: C.text,
    },
    headerItemName: {
      fontSize: 13,
      fontWeight: 600,
      color: C.accentDeep,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },

    /* Cart list */
    listWrap: {
      flex: 1,
      overflowY: "auto",
      padding: "0 20px",
      minHeight: 0,
    },
    listLabel: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
      color: C.muted,
      marginBottom: 8,
    },
    list: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    line: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 12,
      background: C.soft,
      border: `1px solid ${C.borderLight}`,
    },
    lineInfo: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2,
    },
    lineName: {
      fontSize: 13,
      fontWeight: 700,
      color: C.text,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    lineIngs: {
      fontSize: 11,
      color: C.muted,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    lineRight: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
    },
    lineQty: {
      fontSize: 11,
      fontWeight: 700,
      color: C.muted,
    },
    linePrice: {
      fontSize: 13,
      fontWeight: 800,
      color: C.accentDeep,
    },

    /* Total */
    totalRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 20px",
      borderTop: `1px solid ${C.borderLight}`,
      marginTop: 12,
    },
    totalLabel: {
      fontSize: 13,
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
      color: C.muted,
    },
    totalValue: {
      fontSize: 22,
      fontWeight: 900,
      color: C.text,
    },

    /* Buttons */
    buttons: {
      display: "flex",
      gap: 10,
      padding: "0 20px 20px",
    },
    continueBtn: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "14px 16px",
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      background: C.cream,
      color: C.text,
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      transition: "background 0.2s ease",
    },
    checkoutBtn: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "14px 16px",
      borderRadius: 14,
      border: "none",
      background: C.greenGradient,
      color: C.white,
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      boxShadow: "0 6px 16px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
      transition: "background 0.2s ease",
    },
  };
}
