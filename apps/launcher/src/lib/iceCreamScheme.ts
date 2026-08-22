export type IceCreamScheme = "yellow-black" | "blue-sky" | "blue";

export const ICE_CREAM_SCHEME_KEY = "pops-ice-scheme";

export const ICE_CREAM_SCHEMES: {
  id: IceCreamScheme;
  label: string;
  short: string;
  swatch: string;
}[] = [
  { id: "yellow-black", label: "Yellow Black", short: "Yellow", swatch: "#f5c400" },
  { id: "blue-sky", label: "Blue Black Sky", short: "Sky", swatch: "#0ea5e9" },
  { id: "blue", label: "Blue", short: "Blue", swatch: "#2563eb" },
];

const SCHEME_IDS = new Set<string>(ICE_CREAM_SCHEMES.map((s) => s.id));

export function getStoredIceCreamScheme(): IceCreamScheme {
  try {
    const raw = localStorage.getItem(ICE_CREAM_SCHEME_KEY);
    if (raw && SCHEME_IDS.has(raw)) return raw as IceCreamScheme;
  } catch {
    /* ignore */
  }
  return "blue-sky";
}

export function applyIceCreamScheme(scheme: IceCreamScheme): void {
  document.documentElement.dataset.scoop = scheme;
  try {
    localStorage.setItem(ICE_CREAM_SCHEME_KEY, scheme);
  } catch {
    /* ignore */
  }
}

export function initIceCreamScheme(): IceCreamScheme {
  const scheme = getStoredIceCreamScheme();
  applyIceCreamScheme(scheme);
  return scheme;
}
