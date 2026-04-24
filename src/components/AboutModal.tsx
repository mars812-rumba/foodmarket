import { type CSSProperties } from "react";
import { X, MapPin, Phone, Clock } from "lucide-react";

type Restaurant = {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  info_text?: string;
  address?: string;
  phone?: string;
};

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant | null;
}

const C = {
  bg: "#FFFFFF",
  text: "#1A1208",
  muted: "#7A6650",
  accent: "#FF6B35",
  accentDeep: "#E04E1B",
  accentGradient: "linear-gradient(135deg, #FF8A4C 0%, #FF6B35 50%, #E04E1B 100%)",
  border: "rgba(120, 80, 30, 0.12)",
  cream: "#FFFAF2",
};

export default function AboutModal({ open, onClose, restaurant }: AboutModalProps) {
  if (!open || !restaurant) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={S.overlay}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>About Restaurant</h2>
          <button
            onClick={onClose}
            style={S.closeBtn}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={S.content}>
          {/* Restaurant Name */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>{restaurant.name}</h3>
          </div>

          {/* Description */}
          {restaurant.description && (
            <div style={S.section}>
              <p style={S.description}>{restaurant.description}</p>
            </div>
          )}

          {/* Info Text */}
          {restaurant.info_text && (
            <div style={S.infoBox}>
              <Clock size={18} style={{ color: C.accent, flexShrink: 0 }} />
              <span style={S.infoText}>{restaurant.info_text}</span>
            </div>
          )}

          {/* Address */}
          {restaurant.address && (
            <div style={S.infoBox}>
              <MapPin size={18} style={{ color: C.accent, flexShrink: 0 }} />
              <a
                href={restaurant.address}
                target="_blank"
                rel="noopener noreferrer"
                style={S.infoLink}
              >
                View on Maps
              </a>
            </div>
          )}

          {/* Phone */}
          {restaurant.phone && (
            <div style={S.infoBox}>
              <Phone size={18} style={{ color: C.accent, flexShrink: 0 }} />
              <a
                href={`tel:${restaurant.phone}`}
                style={S.infoLink}
              >
                {restaurant.phone}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button
            onClick={onClose}
            style={S.closeButtonFull}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

const S: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(20, 10, 5, 0.55)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    zIndex: 200,
  },

  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "90%",
    maxWidth: 420,
    maxHeight: "85vh",
    background: C.bg,
    borderRadius: 24,
    boxShadow:
      "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.5)",
    zIndex: 210,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  header: {
    padding: "20px 24px",
    borderBottom: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: C.text,
    letterSpacing: 0.3,
  },

  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: C.cream,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: C.muted,
    transition: "all 0.2s ease",
  },

  content: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: C.text,
    letterSpacing: 0.2,
  },

  description: {
    margin: 0,
    fontSize: 14,
    color: C.muted,
    lineHeight: 1.6,
  },

  infoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: C.cream,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
  },

  infoText: {
    fontSize: 13,
    color: C.text,
    fontWeight: 600,
    lineHeight: 1.4,
  },

  infoLink: {
    fontSize: 13,
    color: C.accent,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    transition: "color 0.2s ease",
  } as CSSProperties,

  footer: {
    padding: "16px 24px 24px",
    borderTop: `1px solid ${C.border}`,
    display: "flex",
    gap: 12,
  },

  closeButtonFull: {
    flex: 1,
    background: C.accentGradient,
    color: C.bg,
    border: "none",
    padding: "12px 20px",
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: 0.3,
    cursor: "pointer",
    boxShadow:
      "0 6px 16px rgba(255, 107, 53, 0.35), 0 14px 32px -8px rgba(224, 78, 27, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
    transition: "all 0.2s ease",
  },
};
