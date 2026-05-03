/* ============================================================
   RESTAURANT COLOR THEMES
   Каждая тема — полный набор токенов той же структуры,
   что и C из theme.tsx. Подменяется через ThemeContext.
   ============================================================ */

export type ThemeKey = "warm" | "dark" | "forest" | "ocean" | "slate";

export type ThemeColors = {
  /** Основной фон страницы / модалок */
  bg: string;
  /** Фон карточек, инпутов, «тёплый» подклад */
  cream: string;
  /** Фон страницы (дашборд) */
  pageBg: string;
  /** Общая поверхность */
  surface: string;
  /** Мягкая подложка (строки, чипы) */
  soft: string;
  /** Тёмный панель / основной текст */
  dark: string;

  /** Основной текст */
  text: string;
  /** Вторичный текст */
  textSoft: string;
  /** Приглушённый текст */
  muted: string;

  /** Главный акцент (кнопки, бейджи, иконки) */
  accent: string;
  /** Тёмный акцент (цены, hover) */
  accentDeep: string;
  /** Мягкий фон акцента */
  accentSoft: string;
  /** Градиент акцентной кнопки */
  accentGradient: string;

  /** Основная граница */
  border: string;
  /** Светлая граница (#EDE8E0 аналоги) */
  borderLight: string;

  /** Белый (всегда #FFFFFF) */
  white: string;
  /** Градиент тёмной панели */
  darkGradient: string;

  /** Зелёный — успех/checkout */
  green: string;
  /** Тёмно-зелёный */
  greenDeep: string;
  /** Зелёный градиент */
  greenGradient: string;

  /** Фон sticky-хедера (с прозрачностью) */
  headerBg: string;
  /** Граница хедера снизу */
  headerBorder: string;
  /** Фон нижней навигации */
  bottomNavBg: string;
  /** Граница нижней навигации */
  bottomNavBorder: string;
  /** Фон боковой панели корзины */
  sidePanelBg: string;
  /** Граница боковой панели */
  sidePanelBorder: string;
  /** Фон/градиент нижнего sheet */
  sheetBg: string;
  /** Фон оверлея (затемнение) */
  overlay: string;
};

/* ──────────────────────────────────────────────────────────
   WARM — текущая оранжевая палитра (дефолт)
   ────────────────────────────────────────────────────────── */
const warm: ThemeColors = {
  bg: "#FFFFFF",
  cream: "#FFFAF2",
  pageBg: "#FFF6EC",
  surface: "#FFFFFF",
  soft: "#F7F4F0",
  dark: "#1A1208",

  text: "#1A1208",
  textSoft: "#3D2E1E",
  muted: "#7A6650",

  accent: "#FF6B35",
  accentDeep: "#E04E1B",
  accentSoft: "#FFF1E6",
  accentGradient: "linear-gradient(135deg, #FF8A4C 0%, #FF6B35 50%, #E04E1B 100%)",

  border: "rgba(120, 80, 30, 0.12)",
  borderLight: "#EDE8E0",

  white: "#FFFFFF",
  darkGradient: "linear-gradient(135deg, #2A1A0C 0%, #15100A 100%)",

  green: "#22C55E",
  greenDeep: "#16A34A",
  greenGradient: "linear-gradient(135deg, #4ADE80 0%, #22C55E 50%, #16A34A 100%)",

  headerBg: "rgba(255, 255, 255, 0.95)",
  headerBorder: "#F0EBE3",
  bottomNavBg: "rgba(255, 255, 255, 0.97)",
  bottomNavBorder: "#EDE8E0",
  sidePanelBg: "#FFFFFF",
  sidePanelBorder: "#EDE8E0",
  sheetBg: "linear-gradient(180deg, #FFFAF2 0%, #FFF1DC 100%)",
  overlay: "rgba(20, 10, 5, 0.55)",
};

/* ──────────────────────────────────────────────────────────
   DARK — ночная тема с амбер-акцентом
   ────────────────────────────────────────────────────────── */
const dark: ThemeColors = {
  bg: "#141414",
  cream: "#1E1E1E",
  pageBg: "#0A0A0A",
  surface: "#1A1A1A",
  soft: "#252525",
  dark: "#F5F5F5",

  text: "#F5F5F5",
  textSoft: "#D4D4D4",
  muted: "#9CA3AF",

  accent: "#F59E0B",
  accentDeep: "#D97706",
  accentSoft: "#2D2006",
  accentGradient: "linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #D97706 100%)",

  border: "rgba(255, 255, 255, 0.08)",
  borderLight: "#2A2A2A",

  white: "#FFFFFF",
  darkGradient: "linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)",

  green: "#22C55E",
  greenDeep: "#16A34A",
  greenGradient: "linear-gradient(135deg, #4ADE80 0%, #22C55E 50%, #16A34A 100%)",

  headerBg: "rgba(20, 20, 20, 0.95)",
  headerBorder: "rgba(255, 255, 255, 0.08)",
  bottomNavBg: "rgba(20, 20, 20, 0.97)",
  bottomNavBorder: "rgba(255, 255, 255, 0.08)",
  sidePanelBg: "#1A1A1A",
  sidePanelBorder: "rgba(255, 255, 255, 0.08)",
  sheetBg: "linear-gradient(180deg, #1E1E1E 0%, #141414 100%)",
  overlay: "rgba(0, 0, 0, 0.70)",
};

/* ──────────────────────────────────────────────────────────
   FOREST — зелёная природная тема
   ────────────────────────────────────────────────────────── */
const forest: ThemeColors = {
  bg: "#FFFFFF",
  cream: "#F0FDF4",
  pageBg: "#ECFDF5",
  surface: "#FFFFFF",
  soft: "#F0FDF4",
  dark: "#14532D",

  text: "#14532D",
  textSoft: "#166534",
  muted: "#4D7C5F",

  accent: "#16A34A",
  accentDeep: "#15803D",
  accentSoft: "#DCFCE7",
  accentGradient: "linear-gradient(135deg, #4ADE80 0%, #22C55E 50%, #16A34A 100%)",

  border: "rgba(22, 101, 52, 0.12)",
  borderLight: "#BBF7D0",

  white: "#FFFFFF",
  darkGradient: "linear-gradient(135deg, #14532D 0%, #052E16 100%)",

  green: "#16A34A",
  greenDeep: "#15803D",
  greenGradient: "linear-gradient(135deg, #4ADE80 0%, #22C55E 50%, #16A34A 100%)",

  headerBg: "rgba(255, 255, 255, 0.95)",
  headerBorder: "#BBF7D0",
  bottomNavBg: "rgba(255, 255, 255, 0.97)",
  bottomNavBorder: "#BBF7D0",
  sidePanelBg: "#FFFFFF",
  sidePanelBorder: "#BBF7D0",
  sheetBg: "linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)",
  overlay: "rgba(5, 46, 22, 0.55)",
};

/* ──────────────────────────────────────────────────────────
   OCEAN — голубая морская тема
   ────────────────────────────────────────────────────────── */
const ocean: ThemeColors = {
  bg: "#FFFFFF",
  cream: "#F0F9FF",
  pageBg: "#EFF6FF",
  surface: "#FFFFFF",
  soft: "#F0F9FF",
  dark: "#0C4A6E",

  text: "#0C4A6E",
  textSoft: "#075985",
  muted: "#6B8FAD",

  accent: "#0EA5E9",
  accentDeep: "#0284C7",
  accentSoft: "#E0F2FE",
  accentGradient: "linear-gradient(135deg, #38BDF8 0%, #0EA5E9 50%, #0284C7 100%)",

  border: "rgba(12, 74, 110, 0.12)",
  borderLight: "#BAE6FD",

  white: "#FFFFFF",
  darkGradient: "linear-gradient(135deg, #0C4A6E 0%, #082F49 100%)",

  green: "#22C55E",
  greenDeep: "#16A34A",
  greenGradient: "linear-gradient(135deg, #4ADE80 0%, #22C55E 50%, #16A34A 100%)",

  headerBg: "rgba(255, 255, 255, 0.95)",
  headerBorder: "#BAE6FD",
  bottomNavBg: "rgba(255, 255, 255, 0.97)",
  bottomNavBorder: "#BAE6FD",
  sidePanelBg: "#FFFFFF",
  sidePanelBorder: "#BAE6FD",
  sheetBg: "linear-gradient(180deg, #F0F9FF 0%, #E0F2FE 100%)",
  overlay: "rgba(8, 47, 73, 0.55)",
};

/* ──────────────────────────────────────────────────────────
   SLATE — минималистичная серая тема
   ────────────────────────────────────────────────────────── */
const slate: ThemeColors = {
  bg: "#FFFFFF",
  cream: "#F8FAFC",
  pageBg: "#F1F5F9",
  surface: "#FFFFFF",
  soft: "#F1F5F9",
  dark: "#0F172A",

  text: "#0F172A",
  textSoft: "#1E293B",
  muted: "#64748B",

  accent: "#475569",
  accentDeep: "#334155",
  accentSoft: "#F1F5F9",
  accentGradient: "linear-gradient(135deg, #94A3B8 0%, #64748B 50%, #475569 100%)",

  border: "rgba(15, 23, 42, 0.08)",
  borderLight: "#E2E8F0",

  white: "#FFFFFF",
  darkGradient: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",

  green: "#22C55E",
  greenDeep: "#16A34A",
  greenGradient: "linear-gradient(135deg, #4ADE80 0%, #22C55E 50%, #16A34A 100%)",

  headerBg: "rgba(255, 255, 255, 0.95)",
  headerBorder: "#E2E8F0",
  bottomNavBg: "rgba(255, 255, 255, 0.97)",
  bottomNavBorder: "#E2E8F0",
  sidePanelBg: "#FFFFFF",
  sidePanelBorder: "#E2E8F0",
  sheetBg: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
  overlay: "rgba(15, 23, 42, 0.55)",
};

/* ──────────────────────────────────────────────────────────
   EXPORT
   ────────────────────────────────────────────────────────── */
export const THEMES: Record<ThemeKey, ThemeColors> = {
  warm,
  dark,
  forest,
  ocean,
  slate,
};

/** Метки тем для UI-селектора */
export const THEME_LABELS: Record<ThemeKey, { label: string; emoji: string; preview: string }> = {
  warm:   { label: "Тёплая",     emoji: "🟠", preview: "#FF6B35" },
  dark:   { label: "Тёмная",     emoji: "🌙", preview: "#F59E0B" },
  forest: { label: "Лесная",     emoji: "🟢", preview: "#16A34A" },
  ocean:  { label: "Морская",    emoji: "🔵", preview: "#0EA5E9" },
  slate:  { label: "Сланцевая",  emoji: "⚪", preview: "#64748B" },
};
