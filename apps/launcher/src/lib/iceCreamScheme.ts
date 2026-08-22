export type IceCreamScheme = "yellow-black" | "blue-sky" | "mint";

export const ICE_CREAM_SCHEME_KEY = "pops-ice-scheme";

export const ICE_CREAM_SCHEMES: {
  id: IceCreamScheme;
  label: string;
  short: string;
  swatch: string;
}[] = [
  { id: "yellow-black", label: "Yellow Black", short: "Yellow", swatch: "#c4a35a" },
  { id: "blue-sky", label: "Blue Black Sky", short: "Sky", swatch: "#4a7c8f" },
  { id: "mint", label: "Mint", short: "Mint", swatch: "#4f7f68" },
];

const SCHEME_IDS = new Set<string>(ICE_CREAM_SCHEMES.map((s) => s.id));

export function getStoredIceCreamScheme(): IceCreamScheme {
  try {
    const raw = localStorage.getItem(ICE_CREAM_SCHEME_KEY);
    if (raw === "blue") return "mint";
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
