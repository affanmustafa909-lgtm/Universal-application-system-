import { PLATFORM_EDITION } from "../../lib/edition";
import { useSystemStore } from "../../stores/systemStore";

/** Name printed at the top of KOT / bill slips. */
export function printBusinessDisplayName(
  branchName: string | null | undefined,
  customHeader?: string | null,
): string {
  const custom = customHeader?.trim() ?? "";
  if (custom) return custom;
  const systemId = useSystemStore.getState().systemId;
  if (PLATFORM_EDITION === "ice-cream-bar" || systemId === "ice-cream-bar") {
    return "Ice Cream Bar";
  }
  const branch = branchName?.trim() ?? "";
  return branch || "POPS";
}