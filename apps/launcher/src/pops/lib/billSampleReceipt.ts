import type { PrintTicketInput } from "./printTicket";
import { billChannelLabel } from "./orderSales";
import { effectiveTaxPct, loadPosSettings } from "./posSettings";
import { computeTicketTotals } from "./posDiscount";
import { resolvePrintSystemId } from "./printSystemScope";

type SampleLine = { label: string; qty: number; unitPrice: number };

type SystemSample = {
  modeLabel: string;
  tableLabel?: string;
  waiterName: string;
  lines: SampleLine[];
  orderRef: string;
  billRef: string;
  notes?: string;
  /** Distinct item string used by self-tests to prove the right system sample rendered. */
  fingerprintItem: string;
};

function restaurantSample(): SystemSample {
  return {
    modeLabel: billChannelLabel("Takeaway"),
    tableLabel: "Takeaway",
    waiterName: "Ali (cashier)",
    orderRef: "ORD-SAMPLE",
    billRef: "BILL-TEST",
    fingerprintItem: "Soft drink",
    lines: [
      { label: "Soft drink", qty: 3, unitPrice: 120 },
      { label: "Chicken Karahi (Full)", qty: 1, unitPrice: 2850 },
      { label: "Family Combo 4", qty: 1, unitPrice: 4850 },
    ],
  };
}

function sampleForSystem(systemId: string): SystemSample {
  switch (systemId) {
    case "pharmacy":
      return {
        modeLabel: "Counter",
        tableLabel: "Counter · Main",
        waiterName: "Sara (pharmacist)",
        orderRef: "RX-SAMPLE",
        billRef: "PH-INV-1001",
        notes: "Customer: Walk-in",
        fingerprintItem: "Panadol 500mg",
        lines: [
          { label: "Panadol 500mg · Batch A12", qty: 2, unitPrice: 45 },
          { label: "Augmentin 625mg", qty: 1, unitPrice: 380 },
          { label: "ORS Sachet", qty: 5, unitPrice: 35 },
        ],
      };
    case "general-store":
      return {
        modeLabel: "Walk-in",
        tableLabel: "Till 1",
        waiterName: "Ahmed (cashier)",
        orderRef: "SALE-SAMPLE",
        billRef: "ST-INV-2201",
        notes: "Customer: Walk-in",
        fingerprintItem: "Cooking oil",
        lines: [
          { label: "Cooking oil 1L", qty: 2, unitPrice: 620 },
          { label: "Basmati rice 5kg", qty: 1, unitPrice: 1850 },
          { label: "Tea bags 100s", qty: 1, unitPrice: 450 },
        ],
      };
    case "distribution":
      return {
        modeLabel: "Booking",
        tableLabel: undefined,
        waiterName: "Imran (order desk)",
        orderRef: "BK-SAMPLE",
        billRef: "DI-INV-4401",
        notes: "Trade customer: City Medical Store",
        fingerprintItem: "Panadol Extra",
        lines: [
          { label: "Panadol Extra 24s (box)", qty: 10, unitPrice: 420 },
          { label: "Disprin Tabs (carton)", qty: 5, unitPrice: 980 },
          { label: "ORS Sachet (outer)", qty: 20, unitPrice: 185 },
        ],
      };
    case "education":
      return {
        modeLabel: "Fee",
        tableLabel: undefined,
        waiterName: "Office staff",
        orderRef: "FEE-SAMPLE",
        billRef: "ED-RCP-1101",
        notes: "Student: Ali Khan · Class 8-A",
        fingerprintItem: "Tuition fee",
        lines: [
          { label: "Tuition fee — Oct 2026", qty: 1, unitPrice: 8500 },
          { label: "Lab fee", qty: 1, unitPrice: 1200 },
        ],
      };
    case "ice-cream-bar":
      return {
        modeLabel: billChannelLabel("Takeaway"),
        tableLabel: "Station 2",
        waiterName: "Noor (cashier)",
        orderRef: "IC-SAMPLE",
        billRef: "IC-BILL-301",
        fingerprintItem: "Chocolate scoop",
        lines: [
          { label: "Chocolate scoop", qty: 2, unitPrice: 250 },
          { label: "Vanilla waffle", qty: 1, unitPrice: 450 },
          { label: "Mango shake", qty: 1, unitPrice: 380 },
        ],
      };
    default:
      return restaurantSample();
  }
}

/** Fingerprint item for the active system sample (self-tests / assertions). */
export function sampleFingerprintItem(systemId?: string | null | undefined): string {
  return sampleForSystem(resolvePrintSystemId(systemId)).fingerprintItem;
}

/** Sample receipt data for bill customization preview — matches active business system. */
export function sampleBillPrintInput(
  branchName: string,
  branchCode: string,
  systemId?: string | null | undefined,
): Omit<PrintTicketInput, "kind"> {
  const sys = resolvePrintSystemId(systemId);
  const sample = sampleForSystem(sys);
  const settings = loadPosSettings(branchCode);
  const subtotal = sample.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const taxPct = sys === "education" ? 0 : effectiveTaxPct(settings);
  const servicePct =
    sys === "restaurant" || sys === "ice-cream-bar" ? settings.servicePct : 0;
  const totals = computeTicketTotals(subtotal, 0, servicePct, taxPct);

  return {
    systemId: sys,
    branchName,
    branchCode,
    orderRef: sample.orderRef,
    billRef: sample.billRef,
    modeLabel: sample.modeLabel,
    tableLabel: sample.tableLabel,
    waiterName: sample.waiterName,
    notes: sample.notes,
    lines: sample.lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    service: totals.service,
    tax: totals.tax,
    deliveryCharge: undefined,
    total: totals.total,
    servicePct,
    taxPct,
    discountPct: totals.discountPct,
  };
}

/**
 * Kitchen / station / store slip sample for KOT customization preview.
 * Never uses restaurant food items outside restaurant family.
 */
export function sampleKotPrintInput(
  branchName: string,
  branchCode: string,
  systemId?: string | null | undefined,
): Omit<PrintTicketInput, "kind"> {
  const sys = resolvePrintSystemId(systemId);
  const base = sampleBillPrintInput(branchName, branchCode, sys);

  if (sys === "general-store") {
    return {
      ...base,
      systemId: sys,
      printerName: "Receipt",
      lines: [
        { label: "Lux Soap Bar 130g", qty: 2, unitPrice: 85 },
        { label: "Dettol Antiseptic 500ml", qty: 1, unitPrice: 420 },
        { label: "Surf Excel 1kg", qty: 1, unitPrice: 650 },
        { label: "Nestle Milk Pack 1L", qty: 3, unitPrice: 210 },
      ],
      subtotal: 1870,
      discount: 50,
      service: 0,
      tax: 0,
      total: 1820,
      servicePct: 0,
      discountPct: 0,
    };
  }

  if (sys === "ice-cream-bar") {
    return {
      ...base,
      systemId: sys,
      printerName: "Station 1",
      lines: base.lines.map((line) => ({ ...line, unitPrice: 0 })),
      subtotal: 0,
      discount: 0,
      service: 0,
      tax: 0,
      total: 0,
      servicePct: 0,
      discountPct: 0,
    };
  }

  if (sys === "pharmacy") {
    return {
      ...base,
      systemId: sys,
      printerName: "Counter",
      lines: base.lines.map((line) => ({ ...line, unitPrice: 0 })),
      subtotal: 0,
      discount: 0,
      service: 0,
      tax: 0,
      total: 0,
      servicePct: 0,
      discountPct: 0,
    };
  }

  // Restaurant kitchen ticket — food items, no money.
  return {
    ...base,
    systemId: "restaurant",
    orderRef: "ORD-3",
    modeLabel: "Takeaway",
    tableLabel: "Takeaway",
    waiterName: "Owner",
    printerName: "Kitchen1",
    lines: [
      { label: "Family Combo 4", qty: 1, unitPrice: 0 },
      { label: "Malai Boti", qty: 1, unitPrice: 0 },
      { label: "Mint Margarita", qty: 1, unitPrice: 0 },
      { label: "Mutton Handi (Half)", qty: 1, unitPrice: 0 },
    ],
    subtotal: 0,
    discount: 0,
    service: 0,
    tax: 0,
    total: 0,
    servicePct: 0,
    discountPct: 0,
  };
}
