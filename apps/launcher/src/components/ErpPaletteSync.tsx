import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  isBusinessSystemId,
  resolveBusinessSystemFromPath,
  type BusinessSystemId,
} from "../lib/businessSystems";
import { initIceCreamScheme } from "../lib/iceCreamScheme";
import { useSystemStore } from "../stores/systemStore";

function resolveErpPalette(
  pathname: string,
  search: string,
  persisted: BusinessSystemId | null,
): BusinessSystemId | "" {
  if (pathname.startsWith("/super-admin") || pathname === "/" || pathname === "/platform") {
    return "";
  }
  const fromPath = resolveBusinessSystemFromPath(pathname);
  if (fromPath) return fromPath;
  const query = new URLSearchParams(search).get("system");
  if (query && isBusinessSystemId(query)) return query;
  if (pathname.startsWith("/pops") || pathname === "/login" || pathname === "/role") {
    return persisted ?? "";
  }
  return "";
}

/** Applies pastel tokens only when the active ERP is Ice Cream Bar. */
export function ErpPaletteSync(): null {
  const { pathname, search } = useLocation();
  const persisted = useSystemStore((s) => s.systemId);

  useLayoutEffect(() => {
    document.documentElement.dataset.erp = resolveErpPalette(pathname, search, persisted);
    initIceCreamScheme();
  }, [pathname, search, persisted]);

  return null;
}
