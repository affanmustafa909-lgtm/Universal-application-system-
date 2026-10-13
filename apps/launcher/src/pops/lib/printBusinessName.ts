import { PLATFORM_EDITION } from "../../lib/edition";
import { getBusinessSystem, isBusinessSystemId } from "../../lib/businessSystems";
import { useSystemStore } from "../../stores/systemStore";
import { resolvePrintSystemId } from "./printSystemScope";

/** Name printed at the top of KOT / bill slips — per active business system. */
export function printBusinessDisplayName(
  branchName: string | null | undefined,
  customHeader?: string | null,
): string {
  const custom = customHeader?.trim() ?? "";
  if (custom) return custom;

  const systemId = resolvePrintSystemId(
    useSystemStore.getState().systemId ??
      (isBusinessSystemId(PLATFORM_EDITION) ? PLATFORM_EDITION : null),
  );

  if (systemId === "ice-cream-bar" || PLATFORM_EDITION === "ice-cream-bar") {
    const branch = branchName?.trim() ?? "";
    return branch || "Ice Cream Bar";
  }

  const branch = branchName?.trim() ?? "";
  if (branch) return branch;

  try {
    return getBusinessSystem(systemId).shortName || getBusinessSystem(systemId).name;
  } catch {
    return "POS";
  }
}
