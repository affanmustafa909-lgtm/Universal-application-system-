import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  billFieldGroupsForSystem,
  defaultBillPrintSettingsFor,
  loadBillPrintSettings,
  saveBillPrintSettings,
} from "../billPrintSettings";
import { starterBillPrintTemplates } from "../billPrintTemplates";
import {
  defaultSlipPrintSettings,
  slipPresetForSystem,
} from "../kotPrintSettings";
import {
  defaultPrinterSectionsFor,
  printerSectionPresetForSystem,
} from "../printerSections";
import {
  printScopedKey,
  receiptMetaLabelsFor,
} from "../printSystemScope";
import {
  sampleBillPrintInput,
  sampleFingerprintItem,
  sampleKotPrintInput,
} from "../billSampleReceipt";
import { buildPrintPreviewHtml } from "../printTicket";
import {
  DIST_DOCUMENT_TEMPLATES,
  buildDistDocumentPreviewHtml,
} from "../../../distribution/lib/distDocumentTemplates";

function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", {
    localStorage: storage,
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
}

describe("print system segregation", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it("scopes storage keys by system so suite systems do not share", () => {
    expect(printScopedKey("MAIN", "restaurant")).toBe("restaurant::MAIN");
    expect(printScopedKey("MAIN", "pharmacy")).toBe("pharmacy::MAIN");
    expect(printScopedKey("MAIN", "restaurant")).not.toBe(printScopedKey("MAIN", "pharmacy"));
  });

  it("uses distinct default receipt titles per system", () => {
    const titles = {
      restaurant: defaultBillPrintSettingsFor("restaurant").documentTitle,
      pharmacy: defaultBillPrintSettingsFor("pharmacy").documentTitle,
      store: defaultBillPrintSettingsFor("general-store").documentTitle,
      distribution: defaultBillPrintSettingsFor("distribution").documentTitle,
      education: defaultBillPrintSettingsFor("education").documentTitle,
      ice: defaultBillPrintSettingsFor("ice-cream-bar").documentTitle,
    };
    expect(titles.pharmacy).toMatch(/pharmacy/i);
    expect(titles.store).toMatch(/sales/i);
    expect(titles.distribution).toMatch(/booking|invoice/i);
    expect(titles.education).toMatch(/fee/i);
    expect(titles.ice).toMatch(/receipt/i);
    // Pharmacy must never look like restaurant tax invoice by default title alone + kitchen fields
    expect(defaultBillPrintSettingsFor("pharmacy").fields.service).toBe(false);
    expect(defaultBillPrintSettingsFor("pharmacy").fields.delivery).toBe(false);
    expect(defaultBillPrintSettingsFor("restaurant").fields.service).toBe(true);
  });

  it("does not leak restaurant bill settings into pharmacy on the same branch", () => {
    saveBillPrintSettings(
      "DEMO",
      {
        ...defaultBillPrintSettingsFor("restaurant"),
        documentTitle: "CAFE GUEST CHECK",
        footerText: "Dine-in thank you",
      },
      "restaurant",
    );
    const pharmacy = loadBillPrintSettings("DEMO", "pharmacy");
    expect(pharmacy.documentTitle).not.toBe("CAFE GUEST CHECK");
    expect(pharmacy.documentTitle).toMatch(/pharmacy/i);
    expect(pharmacy.footerText).not.toMatch(/dine-in/i);
  });

  it("each system has ~7 separate starter designs (no kitchen leak)", () => {
    const systems = [
      "restaurant",
      "ice-cream-bar",
      "pharmacy",
      "general-store",
      "distribution",
      "education",
    ] as const;

    for (const sys of systems) {
      const starters = starterBillPrintTemplates(sys);
      expect(starters.length, `${sys} starter count`).toBeGreaterThanOrEqual(7);
      expect(new Set(starters.map((t) => t.name)).size).toBe(starters.length);
    }

    const restaurantNames = starterBillPrintTemplates("restaurant").map((t) => t.name);
    const pharmacyNames = starterBillPrintTemplates("pharmacy").map((t) => t.name);
    const storeNames = starterBillPrintTemplates("general-store").map((t) => t.name);
    const distNames = starterBillPrintTemplates("distribution").map((t) => t.name);

    expect(restaurantNames.some((n) => /cafe|guest check|takeaway/i.test(n))).toBe(true);
    expect(pharmacyNames.some((n) => /cafe|guest check|kitchen/i.test(n))).toBe(false);
    expect(storeNames.some((n) => /cafe|guest check|kitchen/i.test(n))).toBe(false);
    expect(distNames.some((n) => /cafe|guest check|kitchen|karahi/i.test(n))).toBe(false);
    expect(pharmacyNames.some((n) => /pharmacy|rx|instation|dispense/i.test(n))).toBe(true);
    expect(storeNames.some((n) => /retail|sales|tax|return|credit/i.test(n))).toBe(true);
    expect(distNames.some((n) => /booking|challan|trade/i.test(n))).toBe(true);
  });

  it("KOT / slip presets are separate wording", () => {
    expect(slipPresetForSystem("restaurant")).toBe("restaurant");
    expect(slipPresetForSystem("general-store")).toBe("general-store");
    expect(slipPresetForSystem("ice-cream-bar")).toBe("ice-cream-bar");
    expect(slipPresetForSystem("pharmacy")).toBe("pharmacy");

    expect(defaultSlipPrintSettings("restaurant").documentTitle).toMatch(/kitchen/i);
    expect(defaultSlipPrintSettings("general-store").documentTitle).toMatch(/sales/i);
    expect(defaultSlipPrintSettings("ice-cream-bar").documentTitle).toMatch(/station/i);
    expect(defaultSlipPrintSettings("pharmacy").documentTitle).toMatch(/pharmacy/i);
  });

  it("printer sections: pharmacy/store have no kitchen/bar/waiter system sections", () => {
    const restaurantIds = defaultPrinterSectionsFor("restaurant").map((s) => s.id);
    const pharmacyIds = defaultPrinterSectionsFor(
      printerSectionPresetForSystem("pharmacy"),
    ).map((s) => s.id);
    const storeIds = defaultPrinterSectionsFor(
      printerSectionPresetForSystem("general-store"),
    ).map((s) => s.id);

    expect(restaurantIds).toContain("kitchen");
    expect(pharmacyIds).not.toContain("kitchen");
    expect(pharmacyIds).not.toContain("bar");
    expect(storeIds).not.toContain("kitchen");
    expect(storeIds).toContain("receipt");
  });

  it("receipt meta labels differ (Table vs Station vs Till)", () => {
    expect(receiptMetaLabelsFor("restaurant").station).toBe("Table");
    expect(receiptMetaLabelsFor("pharmacy").station).toBe("Station");
    expect(receiptMetaLabelsFor("general-store").station).toBe("Till");
    expect(receiptMetaLabelsFor("ice-cream-bar").station).toBe("Station");
  });

  it("field checklist hides restaurant-only service/delivery outside restaurant family", () => {
    const pharmacyKeys = billFieldGroupsForSystem("pharmacy").flatMap((g) => g.keys);
    const restaurantKeys = billFieldGroupsForSystem("restaurant").flatMap((g) => g.keys);
    expect(pharmacyKeys).not.toContain("service");
    expect(pharmacyKeys).not.toContain("delivery");
    expect(restaurantKeys).toContain("service");
    expect(restaurantKeys).toContain("delivery");
  });

  it("preview samples are distinct per system (no kitchen food in distribution)", () => {
    const dist = sampleBillPrintInput("Dist HQ", "DEMO", "distribution");
    const pharm = sampleBillPrintInput("Rx Shop", "DEMO", "pharmacy");
    const store = sampleBillPrintInput("Mart", "DEMO", "general-store");
    const rest = sampleBillPrintInput("Cafe", "DEMO", "restaurant");
    const ice = sampleBillPrintInput("Scoops", "DEMO", "ice-cream-bar");
    const edu = sampleBillPrintInput("School", "DEMO", "education");

    expect(dist.modeLabel).toBe("Booking");
    expect(dist.lines.some((l) => /karahi|combo|soft drink/i.test(l.label))).toBe(false);
    expect(dist.lines.some((l) => /panadol|disprin/i.test(l.label))).toBe(true);

    expect(pharm.lines.some((l) => /karahi|combo/i.test(l.label))).toBe(false);
    expect(sampleFingerprintItem("pharmacy")).toMatch(/panadol/i);
    expect(pharm.lines.some((l) => l.label.includes(sampleFingerprintItem("pharmacy")))).toBe(true);

    expect(store.modeLabel).toBe("Walk-in");
    expect(store.lines.some((l) => /oil|rice|tea/i.test(l.label))).toBe(true);

    expect(rest.lines.some((l) => /karahi|soft drink/i.test(l.label))).toBe(true);
    expect(ice.lines.some((l) => /scoop|waffle|shake/i.test(l.label))).toBe(true);
    expect(edu.lines.some((l) => /tuition|lab fee/i.test(l.label))).toBe(true);

    const distHtml = buildPrintPreviewHtml({ ...dist, kind: "receipt" });
    expect(distHtml).toMatch(/Panadol Extra|Booking/i);
    expect(distHtml).not.toMatch(/Chicken Karahi|On Card Payment/i);

    const kotRest = sampleKotPrintInput("Cafe", "DEMO", "restaurant");
    const kotIce = sampleKotPrintInput("Scoops", "DEMO", "ice-cream-bar");
    expect(kotRest.lines.some((l) => /malai|combo/i.test(l.label))).toBe(true);
    expect(kotIce.lines.some((l) => /scoop|waffle/i.test(l.label))).toBe(true);
    expect(kotIce.lines.some((l) => /malai|karahi/i.test(l.label))).toBe(false);
  });

  it("distribution uses A4 report documents (not thermal restaurant slips)", () => {
    expect(DIST_DOCUMENT_TEMPLATES.length).toBeGreaterThanOrEqual(7);
    const html = buildDistDocumentPreviewHtml({
      templateId: "booking-invoice",
      branchName: "Distribution HQ",
      branchCode: "LAH",
    });
    expect(html).toMatch(/A4|Booking Invoice|Trade customer/i);
    expect(html).toMatch(/Panadol Extra|City Medical Store/i);
    expect(html).not.toMatch(/Chicken Karahi|On Card Payment|Kitchen Order/i);
    expect(html).toMatch(/Prepared by|Checked \/ Authorized|Received by/);
  });
});
