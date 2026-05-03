import { createContext, useContext, useMemo, type ReactNode } from "react";
import { THEMES, type ThemeKey, type ThemeColors } from "@/data/themes";
export type { ThemeColors } from "@/data/themes";

/* ============================================================
   ThemeContext — пробрасывает текущую тему через дерево React.
   Используется в Home.tsx, AboutModal, ProductDetail и др.
   ============================================================ */

const ThemeContext = createContext<ThemeColors>(THEMES.warm);

type Props = {
  theme?: ThemeKey;
  children: ReactNode;
};

export function ThemeProvider({ theme, children }: Props) {
  const colors = useMemo(
    () => THEMES[theme || "warm"] ?? THEMES.warm,
    [theme]
  );
  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Хук для получения текущей цветовой палитры */
export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}
