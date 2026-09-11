import {
  businessSystems,
  businessSystemList,
  isBusinessSystemId,
  type BusinessSystem,
  type BusinessSystemId,
} from "./businessSystems";

/**
 * Edition = the business module baked into this build/installer.
 *
 * - A specific id produces a single-system installer that boots straight into that system.
 * - `"suite"` keeps every system available behind the picker (dev + admin build).
 */
export type PlatformEdition = BusinessSystemId | "suite";

declare const __PLATFORM_EDITION__: string;

function normalizeEdition(raw: string): PlatformEdition {
  if (!raw || raw === "suite" || raw === "all") return "suite";
  return isBusinessSystemId(raw) ? raw : "suite";
}

export const PLATFORM_EDITION: PlatformEdition = normalizeEdition(
  typeof __PLATFORM_EDITION__ === "string" ? __PLATFORM_EDITION__ : "suite",
);

export const IS_SUITE = PLATFORM_EDITION === "suite";
export const HAS_RESTAURANT =
  PLATFORM_EDITION === "suite" ||
  PLATFORM_EDITION === "restaurant" ||
  PLATFORM_EDITION === "ice-cream-bar";
export const HAS_ICE_CREAM_BAR =
  PLATFORM_EDITION === "suite" ||
  PLATFORM_EDITION === "ice-cream-bar" ||
  PLATFORM_EDITION === "restaurant";
export const HAS_PHARMACY =
  PLATFORM_EDITION === "suite" || PLATFORM_EDITION === "pharmacy";
export const HAS_DISTRIBUTION =
  PLATFORM_EDITION === "suite" || PLATFORM_EDITION === "distribution";
export const HAS_GENERAL_STORE =
  PLATFORM_EDITION === "suite" || PLATFORM_EDITION === "general-store";

/** True when this build ships a single locked business system. */
export function isSingleSystemEdition(): boolean {
  return !IS_SUITE;
}

/** The locked system id for single-system editions, else null. */
export function getLockedSystemId(): BusinessSystemId | null {
  if (IS_SUITE) return null;
  return isBusinessSystemId(PLATFORM_EDITION) ? PLATFORM_EDITION : null;
}

/** Business systems visible in this edition (one for locked builds, all for suite). */
export function getAvailableSystems(): BusinessSystem[] {
  const locked = getLockedSystemId();
  if (locked === "ice-cream-bar") return [businessSystems["ice-cream-bar"]];
  if (locked === "restaurant") {
    return [businessSystems.restaurant, businessSystems["ice-cream-bar"]];
  }
  if (locked) return [businessSystems[locked]];
  return businessSystemList.filter((s) => isSystemAvailable(s.id));
}

/** True when `id` is installed/available in this edition. */
export function isSystemAvailable(id: BusinessSystemId): boolean {
  if (id === "restaurant") return HAS_RESTAURANT && PLATFORM_EDITION !== "ice-cream-bar";
  if (id === "ice-cream-bar") return HAS_ICE_CREAM_BAR;
  if (id === "pharmacy") return HAS_PHARMACY;
  if (id === "distribution") return HAS_DISTRIBUTION;
  if (id === "general-store") return HAS_GENERAL_STORE;
  return false;
}
