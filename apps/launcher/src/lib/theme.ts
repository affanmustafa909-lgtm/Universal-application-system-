export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "pops-theme";

export function getStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  document.body.classList.toggle("theme-light", mode === "light");
  document.body.classList.toggle("theme-dark", mode === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export function initTheme(): ThemeMode {
  const mode = getStoredTheme();
  applyTheme(mode);
  return mode;
}
