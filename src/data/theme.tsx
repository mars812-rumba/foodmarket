/* ============================================================
   SHARED DESIGN TOKENS — Pizza Loft / Food Market style
   Используется во всех модалках и дашборде для общего вида.
   Все компоненты ссылаются на эти токены через объект C / R / SH / FONT.
   ============================================================ */

/** Цветовая палитра */
export const C = {
  // Поверхности
  bg: "#FFFFFF",
  cream: "#FFFAF2",        // основной "тёплый" фон карточек/инпутов
  pageBg: "#FFF6EC",       // фон страницы дашборда
  surface: "#FFFFFF",
  soft: "#FBF5EC",         // мягкая подложка для строк/чипов
  dark: "#1A1208",         // почти-чёрный, основной текст и тёмная панель Total

  // Текст
  text: "#1A1208",
  textSoft: "#3D2E1E",
  muted: "#7A6650",
  faint: "#9A8A78",
  hint: "#C4B8A8",

  // Акценты (оранжевый — главный бренд)
  accent: "#FF6B35",
  accentDeep: "#E04E1B",
  accentSoft: "#FFF1E6",
  accentBorder: "#FFD4B8",
  accentGradient:
    "linear-gradient(135deg, #FF8A4C 0%, #FF6B35 50%, #E04E1B 100%)",

  // Линии
  border: "rgba(120, 80, 30, 0.12)",
  borderStrong: "rgba(120, 80, 30, 0.18)",

  // Семантика статусов (мягкие, в одном "тёплом" регистре)
  warn: "#D97706",
  warnBg: "#FFF7EA",
  warnBorder: "#F5C77A",

  info: "#2563EB",
  infoBg: "#EEF4FF",
  infoBorder: "#BFD4F7",

  ok: "#16A34A",
  okBg: "#EEFBF2",
  okBorder: "#A7E3BC",
  okGradient: "linear-gradient(135deg, #34D27A 0%, #16A34A 100%)",

  done: "#0891B2",
  doneBg: "#E8FAFC",
  doneBorder: "#9FE0EA",

  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FCA5A5",
} as const;

/** Радиусы — единая шкала */
export const R = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  pill: 999,
  modal: 24,
} as const;

/** Тени */
export const SH = {
  card: "0 1px 2px rgba(20, 10, 5, 0.04), 0 4px 14px rgba(20, 10, 5, 0.05)",
  cardHover: "0 2px 6px rgba(20, 10, 5, 0.06), 0 10px 28px rgba(20, 10, 5, 0.08)",
  modal: "0 24px 64px rgba(20, 10, 5, 0.28)",
  accent:
    "0 6px 16px rgba(255, 107, 53, 0.32), 0 14px 32px -8px rgba(224, 78, 27, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
  ok: "0 6px 16px rgba(22,163,74,0.32), inset 0 1px 0 rgba(255,255,255,0.35)",
  info: "0 6px 16px rgba(37,99,235,0.30), inset 0 1px 0 rgba(255,255,255,0.35)",
} as const;

/** Системный стек шрифтов как в скриншотах */
export const FONT =
  "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif";
