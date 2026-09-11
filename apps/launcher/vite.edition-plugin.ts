import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, "src", "routes");

type SystemKey = "restaurant" | "pharmacy" | "distribution" | "general-store";

const ROUTE_MODULES: Record<SystemKey, string> = {
  restaurant: path.join(routesDir, "restaurantRoutes.tsx"),
  pharmacy: path.join(routesDir, "pharmacyRoutes.tsx"),
  distribution: path.join(routesDir, "distributionRoutes.tsx"),
  "general-store": path.join(routesDir, "generalStoreRoutes.tsx"),
};

const STUBS: Record<SystemKey, string> = {
  restaurant: "export function restaurantRoutes(){return null}",
  pharmacy: "export function pharmacyRoutes(){return null}",
  distribution: "export function distributionRoutes(){return null}",
  "general-store": "export function generalStoreRoutes(){return null}",
};

function normalize(id: string): string {
  return (id.split("?")[0] ?? id).replace(/\\/g, "/");
}

/**
 * Physically excludes non-selected business systems from a locked build.
 */
export function editionExcludePlugin(edition: string): Plugin {
  const stubbed = new Map<string, string>();

  if (edition !== "suite") {
    const keepRestaurant = edition === "restaurant" || edition === "ice-cream-bar";
    (Object.keys(ROUTE_MODULES) as SystemKey[]).forEach((sys) => {
      if (sys === edition) return;
      if (sys === "restaurant" && keepRestaurant) return;
      stubbed.set(normalize(ROUTE_MODULES[sys]), STUBS[sys]);
    });
  }

  return {
    name: "platform-edition-exclude",
    enforce: "pre",
    load(id) {
      if (edition === "suite") return null;
      return stubbed.get(normalize(id)) ?? null;
    },
  };
}
