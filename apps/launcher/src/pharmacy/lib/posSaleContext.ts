export const PHARMACY_POS_CHANNELS = ["counter"] as const;

export type PharmacyPosChannel = (typeof PHARMACY_POS_CHANNELS)[number];

export type PharmacyPosSaleContext = {
  channel: PharmacyPosChannel | null;
  areaId: string | null;
  areaName: string | null;
  routeId: string | null;
  stationLabel: string | null;
  employeeId: string | null;
  employeeName: string | null;
};

export const EMPTY_POS_SALE_CONTEXT: PharmacyPosSaleContext = {
  channel: null,
  areaId: null,
  areaName: null,
  routeId: null,
  stationLabel: null,
  employeeId: null,
  employeeName: null,
};

export const CHANNEL_LABELS: Record<PharmacyPosChannel, string> = {
  counter: "Counter",
};

export const CHANNEL_HINTS: Record<PharmacyPosChannel, string> = {
  counter: "Walk-in counter sale · pick employee next",
};

export function formatPharmacyPosContextLabel(ctx: PharmacyPosSaleContext): string | null {
  if (!ctx.channel || !ctx.employeeId) return null;
  const parts: string[] = [CHANNEL_LABELS[ctx.channel]];
  if (ctx.employeeName) parts.push(ctx.employeeName);
  return parts.join(" · ");
}

/** Returns an error message if context is incomplete for checkout; otherwise null. */
export function validatePharmacyPosContext(ctx: PharmacyPosSaleContext): string | null {
  if (!ctx.channel) return "Select sale channel (Counter).";
  if (!ctx.employeeId) return "Select an employee for this sale.";
  return null;
}

export function pharmacyPosContextPayload(ctx: PharmacyPosSaleContext) {
  return {
    saleChannel: ctx.channel!,
    employeeId: ctx.employeeId!,
    stationLabel: "Counter",
  };
}
