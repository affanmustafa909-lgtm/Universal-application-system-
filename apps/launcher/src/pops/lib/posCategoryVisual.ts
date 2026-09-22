/** Ice cream parlour categories (Shahryar flyer + legacy demo names). */
const ICE_CREAM_CATEGORY_NAMES = new Set([
  "flavors",
  "cones",
  "cups",
  "family packs",
  "scoops",
  "sundaes",
  "shakes",
  "cakes",
]);

export function isIceCreamMenuCategory(name: string): boolean {
  return ICE_CREAM_CATEGORY_NAMES.has(name.trim().toLowerCase());
}

export function scopeMenuForBusinessSystem<
  C extends { id: string; name: string },
  I extends { categoryId: string },
>(
  systemId: string,
  categories: readonly C[],
  items: readonly I[],
): { categories: C[]; items: I[] } {
  const wantIceCream = systemId === "ice-cream-bar";
  const scopedCats = categories.filter((c) => isIceCreamMenuCategory(c.name) === wantIceCream);
  if (scopedCats.length === 0) {
    // Ice Cream Bar must never fall back to restaurant dishes (biryani, karahi).
    if (wantIceCream) return { categories: [], items: [] };
    return { categories: [...categories], items: [...items] };
  }
  const ids = new Set(scopedCats.map((c) => c.id));
  return {
    categories: scopedCats,
    items: items.filter((item) => ids.has(item.categoryId)),
  };
}

/** Friendly category icons for POS (ice-cream-aware, then general). */
export function posCategoryEmoji(name: string): string {
  const n = name.trim().toLowerCase();
  if (!n) return "🍽️";
  if (n === "all") return "✨";
  if (n.includes("feature")) return "⭐";
  if (n.includes("flavor") || n.includes("flavour")) return "🍨";
  if (n.includes("family")) return "📦";
  if (n.includes("cup") || n.includes("scoop")) return "🍨";
  if (n.includes("sundae")) return "🍧";
  if (n.includes("shake") || n.includes("smoothie")) return "🥤";
  if (n.includes("cone")) return "🍦";
  if (n.includes("cake") || n.includes("pastry")) return "🍰";
  if (n.includes("waffle") || n.includes("crepe")) return "🧇";
  if (n.includes("topping") || n.includes("extra")) return "🍫";
  if (n.includes("beverage") || n.includes("drink") || n.includes("juice")) return "🧋";
  if (n.includes("grill")) return "🔥";
  if (n.includes("side")) return "🍟";
  if (n.includes("combo")) return "🍱";
  if (n.includes("dessert") || n.includes("sweet")) return "🧁";
  return "🍽️";
}
