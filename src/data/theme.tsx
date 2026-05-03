/* ============================================================
   SHARED DESIGN TOKENS — Pizza Loft / Food Market style
   Используется во всех модалках и дашборде для общего вида.
   Все компоненты ссылаются на эти токены через объект C / R / SH / FONT.
   
   C теперь реэкспортируется из themes.ts (warm = дефолт).
   Для динамической темы используйте useTheme() из ThemeContext.
   ============================================================ */

import { THEMES } from "@/data/themes";

/** Цветовая палитра — дефолт (warm). Для динамики — useTheme() */
export const C = THEMES.warm;

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
