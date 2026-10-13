/**
 * Distribution report print looks + report-number sequence (Customize / settings).
 * Stored per branch in localStorage.
 */

export type DistReportLookId = "classic" | "brand" | "watermark";

export type DistReportNumberSettings = {
  /** Prefix before the padded number, e.g. CR → CR-0001 */
  prefix: string;
  /** Next number to assign (1-based). Increments on each new save. */
  nextNumber: number;
  /** Zero-pad width (2–8). */
  pad: number;
};

export type DistReportPrintSettings = {
  look: DistReportLookId;
  brandColor: string;
  watermarkText: string;
  watermarkOpacity: number;
  showWatermark: boolean;
  number: DistReportNumberSettings;
};

export const DIST_REPORT_LOOKS: Array<{
  id: DistReportLookId;
  name: string;
  description: string;
}> = [
  {
    id: "classic",
    name: "Classic register",
    description: "Black & white A4 register — clean borders, high contrast for photocopy.",
  },
  {
    id: "brand",
    name: "Brand color",
    description: "Colored header bar + accent table headers using your brand color.",
  },
  {
    id: "watermark",
    name: "Brand + watermark",
    description: "Brand colors with a diagonal watermark behind the report grid.",
  },
];

export const DEFAULT_DIST_REPORT_PRINT: DistReportPrintSettings = {
  look: "brand",
  brandColor: "#0f766e",
  watermarkText: "ZIVRA DIST",
  watermarkOpacity: 0.08,
  showWatermark: true,
  number: {
    prefix: "CR",
    nextNumber: 1,
    pad: 4,
  },
};

export const DIST_REPORT_SETTINGS_CHANGED_EVENT = "dist-report-settings-changed";

const STORAGE_KEY = "dist-report-print-settings-v1";

function clampPad(n: number): number {
  if (!Number.isFinite(n)) return 4;
  return Math.max(2, Math.min(8, Math.round(n)));
}

function clampNext(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(999_999, Math.round(n));
}

function clampOpacity(n: number): number {
  if (!Number.isFinite(n)) return 0.08;
  return Math.max(0.03, Math.min(0.25, n));
}

function normalizeColor(raw: string): string {
  const s = String(raw ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const [a, b, c] = s.slice(1);
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return DEFAULT_DIST_REPORT_PRINT.brandColor;
}

export function normalizeDistReportPrintSettings(
  input: Partial<DistReportPrintSettings> | null | undefined,
): DistReportPrintSettings {
  const d = DEFAULT_DIST_REPORT_PRINT;
  const look = (["classic", "brand", "watermark"] as const).includes(
    input?.look as DistReportLookId,
  )
    ? (input!.look as DistReportLookId)
    : d.look;
  const num = input?.number ?? d.number;
  return {
    look,
    brandColor: normalizeColor(input?.brandColor ?? d.brandColor),
    watermarkText: String(input?.watermarkText ?? d.watermarkText).trim().slice(0, 40) || d.watermarkText,
    watermarkOpacity: clampOpacity(Number(input?.watermarkOpacity ?? d.watermarkOpacity)),
    showWatermark: input?.showWatermark ?? d.showWatermark,
    number: {
      prefix: String(num?.prefix ?? d.number.prefix)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8) || d.number.prefix,
      nextNumber: clampNext(Number(num?.nextNumber ?? d.number.nextNumber)),
      pad: clampPad(Number(num?.pad ?? d.number.pad)),
    },
  };
}

function mapKey(branchCode: string): string {
  return `distribution::${branchCode}`;
}

function readMap(): Record<string, Partial<DistReportPrintSettings>> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Partial<DistReportPrintSettings>>;
  } catch {
    return {};
  }
}

export function loadDistReportPrintSettings(branchCode: string | undefined): DistReportPrintSettings {
  if (!branchCode || typeof localStorage === "undefined") {
    return { ...DEFAULT_DIST_REPORT_PRINT, number: { ...DEFAULT_DIST_REPORT_PRINT.number } };
  }
  try {
    const map = readMap();
    return normalizeDistReportPrintSettings(map[mapKey(branchCode)]);
  } catch {
    return { ...DEFAULT_DIST_REPORT_PRINT, number: { ...DEFAULT_DIST_REPORT_PRINT.number } };
  }
}

export function saveDistReportPrintSettings(
  branchCode: string,
  settings: DistReportPrintSettings,
): DistReportPrintSettings {
  const next = normalizeDistReportPrintSettings(settings);
  if (typeof localStorage === "undefined") return next;
  try {
    const map = readMap();
    map[mapKey(branchCode)] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent(DIST_REPORT_SETTINGS_CHANGED_EVENT, {
        detail: { branchCode, settings: next },
      }),
    );
  } catch {
    /* ignore */
  }
  return next;
}

/** Format e.g. CR-0001 from settings without consuming the sequence. */
export function formatReportNumber(settings: DistReportNumberSettings, n: number): string {
  const pad = clampPad(settings.pad);
  const prefix = settings.prefix || "CR";
  return `${prefix}-${String(clampNext(n)).padStart(pad, "0")}`;
}

/**
 * Allocate the next report number for a branch and persist the bumped counter.
 */
export function allocateNextReportNumber(branchCode: string | undefined): string {
  const settings = loadDistReportPrintSettings(branchCode);
  const assigned = formatReportNumber(settings.number, settings.number.nextNumber);
  if (branchCode) {
    saveDistReportPrintSettings(branchCode, {
      ...settings,
      number: {
        ...settings.number,
        nextNumber: settings.number.nextNumber + 1,
      },
    });
  }
  return assigned;
}

/** Peek at what the next number would be (does not increment). */
export function peekNextReportNumber(branchCode: string | undefined): string {
  const settings = loadDistReportPrintSettings(branchCode);
  return formatReportNumber(settings.number, settings.number.nextNumber);
}
