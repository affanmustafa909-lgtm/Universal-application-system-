import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPurchaseReceiptHtml,
  buildSaleReceiptHtml,
  normalizeImeiScan,
  recordPurchase,
  recordSale,
  resetMobizoneMemoryCache,
  upsertBankAccount,
} from "../mobizoneStore";
import { saveMobizoneReceiptSettings } from "../mobizoneReceiptSettings";

const BRANCH = "MZ-IMEI-RCPT";

function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
}

beforeEach(() => {
  resetMobizoneMemoryCache();
  installMemoryLocalStorage();
});

describe("normalizeImeiScan", () => {
  it("prefers 15-digit IMEI and unwraps stars", () => {
    expect(normalizeImeiScan("*359999999999999*")).toBe("359999999999999");
    expect(normalizeImeiScan("IMEI 359999999999999 / 99")).toBe("359999999999999");
  });

  it("accepts 8–17 digit runs", () => {
    expect(normalizeImeiScan("12345678")).toBe("12345678");
    expect(normalizeImeiScan("abc 12345678901234567 xyz")).toBe("12345678901234567");
  });

  it("rejects empty and letters-only junk", () => {
    expect(normalizeImeiScan("")).toBe("");
    expect(normalizeImeiScan("   ")).toBe("");
    expect(normalizeImeiScan("not-an-imei")).toBe("");
    expect(normalizeImeiScan("****")).toBe("");
  });
});

describe("phone-shop sale receipt", () => {
  it("prints shop logo, IMEI, and no restaurant/POPS branding", () => {
    upsertBankAccount(BRANCH, {
      bankName: "HBL",
      accountTitle: "Shop",
      openingBalancePkr: 0,
    });
    const purchase = recordPurchase(BRANCH, {
      sellerName: "Seller",
      imei: "359999999999991",
      imei2: "359999999999992",
      brand: "Samsung",
      model: "A15",
      condition: "used",
      purchasePricePkr: 30000,
      payment: { cashPkr: 30000, bankPkr: 0 },
    });
    const sale = recordSale(BRANCH, {
      deviceId: purchase.deviceId,
      customerName: "Buyer",
      customerPhone: "03001112233",
      pricePkr: 40000,
      warrantyDays: 0,
      payment: { cashPkr: 40000, bankPkr: 0 },
    });
    const logo = "data:image/png;base64,aaa";
    saveMobizoneReceiptSettings(BRANCH, {
      shopName: "Hall Road Mobiles",
      shopPhone: "03001234567",
      shopAddress: "Lahore",
      whatsappNumber: "03001234567",
      whatsappDefaultOn: true,
      documentTitle: "Sale Receipt",
      footerText: "Thanks",
      paperWidthMm: 80,
      shopLogoUrl: logo,
      fields: {
        shopName: true,
        shopPhone: true,
        shopAddress: true,
        documentTitle: true,
        timestamp: true,
        customerName: true,
        customerPhone: true,
        customerCnic: true,
        customerAddress: true,
        device: true,
        imei: true,
        warranty: true,
        salePrice: true,
        cash: true,
        bank: true,
        bankDetails: true,
        remaining: true,
        dueDate: true,
        footer: true,
      },
    });
    const html = buildSaleReceiptHtml(sale, BRANCH);
    expect(html).toContain("Hall Road Mobiles");
    expect(html).toContain("IMEI 1:");
    expect(html).toContain("359999999999991");
    expect(html).toContain("IMEI 2:");
    expect(html).toContain("359999999999992");
    expect(html).toContain(logo);
    expect(html).toContain("phone shop");
    expect(html).not.toMatch(/restaurant/i);
    expect(html).not.toMatch(/pops\/printer/i);
    expect(html).not.toContain("Restaurant-style");
    expect(html).not.toMatch(/billPrintSettings|kotPrint|printTicket/i);
  });

  it("purchase receipt stays phone-shop isolated from POPS printTicket", () => {
    const purchase = recordPurchase(BRANCH, {
      sellerName: "Seller Two",
      imei: "359999999999993",
      brand: "Infinix",
      model: "Hot 40",
      condition: "used",
      purchasePricePkr: 22000,
      payment: { cashPkr: 22000, bankPkr: 0 },
    });
    const html = buildPurchaseReceiptHtml(purchase, BRANCH);
    expect(html).toContain("IMEI 1:");
    expect(html).toContain("359999999999993");
    expect(html).toContain("phone shop");
    expect(html).not.toMatch(/restaurant/i);
    expect(html).not.toMatch(/pops\/printer/i);
    expect(html).not.toMatch(/billPrintSettings|kotPrint|printTicket/i);
  });
});
