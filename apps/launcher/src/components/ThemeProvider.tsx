import { useLayoutEffect, type ReactNode } from "react";
import { initIceCreamScheme } from "../lib/iceCreamScheme";
import { applyTheme } from "../lib/theme";
import { useThemeStore } from "../stores/themeStore";

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const mode = useThemeStore((s) => s.mode);

  useLayoutEffect(() => {
    applyTheme(mode);
    initIceCreamScheme();
  }, [mode]);

  return <>{children}</>;
}
