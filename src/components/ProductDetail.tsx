import { useEffect, useMemo, type CSSProperties } from "react";
import { useCart, type MenuItem } from "@/contexts/CartContext";
import { useTheme, type ThemeColors } from "@/contexts/ThemeContext";
import { toast } from "sonner";

type Props = {
  item: MenuItem | null;
  onClose: () => void;
  imageSrc?: string; // Ready URL image (with timestamp), formed by Home
};

/**
 * Minimal product detail modal:
 * photo, name, description (notes), price, "Add to Cart" button.
 * No quantity counter and no ingredient selection — as required.
 */
export default function ProductDetail({ item, onClose, imageSrc }: Props) {
  const C = useTheme();
  const s = useMemo(() => buildProductStyles(C), [C]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  const { addToCart } = useCart();

  if (!item) return null;

  const handleAdd = () => {
    addToCart(item, []);
    toast.success(`${item.name} added to cart`);
    onClose();
  };

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.modal} role="dialog" aria-modal="true" aria-label={item.name}>
        <button onClick={onClose} style={s.close} aria-label="Close">✕</button>

        <div style={s.imgWrap}>
          <img
            src={imageSrc || "/placeholder.svg"}
            alt={item.name}
            style={s.img}
            onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
          />
        </div>

        <div style={s.body}>
          <h2 style={s.name}>{item.name}</h2>
          {item.weight && <div style={s.weight}>{item.weight}</div>}
          {item.notes && <p style={s.desc}>{item.notes}</p>}

          <div style={s.footer}>
            <div style={s.price}>{item.price} ฿</div>
            <button onClick={handleAdd} style={s.addBtn}>Add to Cart</button>
          </div>
        </div>
      </div>
    </>
  );
}

function buildProductStyles(C: ThemeColors): Record<string, CSSProperties> {
  return {
  overlay: {
    position: "fixed",
    inset: 0,
    background: C.overlay,
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
    zIndex: 200,
    animation: "lfp-fade-in 0.2s ease",
  },
  modal: {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(440px, calc(100vw - 24px))",
    maxHeight: "calc(100vh - 32px)",
    background: C.bg,
    borderRadius: 24,
    overflow: "hidden",
    zIndex: 210,
    boxShadow: "0 24px 80px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  close: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 5,
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "none",
    background: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontSize: 16,
    color: C.text,
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  },
  imgWrap: {
    width: "100%",
    aspectRatio: "1/1",
    background: C.soft,
    overflow: "hidden",
    flexShrink: 0,
  },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  body: { padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" },
  name: { margin: 0, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: -0.3 },
  weight: { fontSize: 13, color: C.muted, fontWeight: 600 },
  desc: { margin: "4px 0 0", fontSize: 14, color: C.textSoft, lineHeight: 1.5 },
  footer: {
    marginTop: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  price: { fontSize: 24, fontWeight: 900, color: C.text },
  addBtn: {
    flex: "0 0 auto",
    background: C.accentGradient,
    color: C.white,
    border: "none",
    padding: "13px 22px",
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 14,
    letterSpacing: 0.4,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(255,107,53,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
  },
  };
}