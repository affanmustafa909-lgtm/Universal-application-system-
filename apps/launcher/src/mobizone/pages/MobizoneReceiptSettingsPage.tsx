import { useEffect, useMemo, useState } from "react";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneBranchCode, useMobizoneDb } from "../hooks/useMobizone";
import {
  DEFAULT_MOBIZONE_RECEIPT_SETTINGS,
  MOBIZONE_RECEIPT_FIELD_LABELS,
  RECEIPT_DESIGN_PRESETS,
  loadMobizoneReceiptSettings,
  type MobizoneReceiptDesign,
  type MobizoneReceiptFields,
  type MobizoneReceiptSettings,
} from "../lib/mobizoneReceiptSettings";
import { publishMobizoneShopControl } from "../lib/mobizoneShopControlApi";
import { buildSaleReceiptHtml, formatPkr, printHtmlPage } from "../lib/mobizoneStore";
import {
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzScreenTitle,
  MzSecondaryButton,
  MzSection,
  MzSelect,
  MzStickyActions,
} from "../ui/MobizoneUi";

const FIELD_GROUPS: { title: string; keys: (keyof MobizoneReceiptFields)[] }[] = [
  {
    title: "Shop header",
    keys: ["shopName", "shopPhone", "shopAddress", "documentTitle", "timestamp"],
  },
  // Customer name/phone/CNIC/address always print on the bill (not toggleable).
  {
    title: "Device",
    keys: ["device", "imei", "warranty"],
  },
  {
    title: "Payment",
    keys: ["salePrice", "cash", "bank", "bankDetails", "remaining", "dueDate"],
  },
  {
    title: "Footer",
    keys: ["footer"],
  },
];

export function MobizoneReceiptSettingsPage(): JSX.Element {
  const branchCode = useMobizoneBranchCode();
  const { db } = useMobizoneDb();
  const [settings, setSettings] = useState<MobizoneReceiptSettings>(DEFAULT_MOBIZONE_RECEIPT_SETTINGS);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!branchCode) return;
    setSettings(loadMobizoneReceiptSettings(branchCode));
  }, [branchCode]);

  const sampleSale = useMemo(() => {
    const last = db.sales.find((s) => !s.returnedAt && !s.deletedAt);
    if (last) return last;
    return {
      id: "00000000-0000-4000-8000-000000000001",
      deviceId: "00000000-0000-4000-8000-000000000002",
      customerId: null,
      shopkeeperId: null,
      customerName: "Ali Khan",
      customerPhone: "03001234567",
      customerAddress: "Main Bazaar, Lahore",
      customerCnic: "35202-1234567-1",
      customerPhotoDataUrl: null,
      cnicFrontDataUrl: null,
      cnicBackDataUrl: null,
      imei: "359999999999999",
      brand: "Samsung",
      model: "A15",
      pricePkr: 45000,
      receivedPkr: 40000,
      remainingPkr: 5000,
      dueDate: "2026-11-01",
      warrantyDays: 30,
      returnedAt: null,
      payment: {
        cashPkr: 20000,
        bankPkr: 20000,
        bankLabel: "HBL",
        bank: {
          bankAccountId: null,
          bankName: "HBL",
          accountTitle: "Shop",
          accountNumber: null,
          iban: null,
          txnRef: "TXN-123",
          verified: true,
        },
      },
      costPkr: 38000,
      profitPkr: 7000,
      createdAt: new Date().toISOString(),
    };
  }, [db.sales]);

  const previewHtml = useMemo(
    () => buildSaleReceiptHtml(sampleSale, branchCode ?? "MAIN", settings),
    [sampleSale, branchCode, settings],
  );

  function patchField(key: keyof MobizoneReceiptFields, value: boolean): void {
    setSettings((s) => ({ ...s, fields: { ...s.fields, [key]: value } }));
    setMsg(null);
  }

  async function onSave(): Promise<void> {
    if (!branchCode) return;
    try {
      await publishMobizoneShopControl(branchCode, settings);
      setMsg(
        "Saved & published to live — mobile apps will use this shop phone, WhatsApp number, and printer receipt.",
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  function onReset(): void {
    setSettings(DEFAULT_MOBIZONE_RECEIPT_SETTINGS);
    setMsg(null);
  }

  function onPreviewPrint(): void {
    printHtmlPage("Receipt preview", previewHtml);
  }

  return (
    <MzPage>
      <MzScreenTitle
        title="MobiZone bill print"
        subtitle="Phone-shop receipts only — shop logo, IMEI, KYC. Desktop is master and syncs to the mobile app."
      />
      <p className={`text-sm ${mutedClass}`}>
        Layout: shop header · customer/seller · phone (IMEI) · payment · TOTAL. Uses Windows print dialog for the thermal
        printer — restaurant POS printer settings are not used here.
      </p>
      {msg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <MzSection title="Shop & WhatsApp (controls mobile)">
            <div className="grid gap-3 sm:grid-cols-2">
              <MzField label="Shop name">
                <MzInput
                  value={settings.shopName}
                  onChange={(e) => setSettings((s) => ({ ...s, shopName: e.target.value }))}
                />
              </MzField>
              <MzField label="Shop phone (on bill)">
                <MzInput
                  value={settings.shopPhone}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      shopPhone: e.target.value,
                      whatsappNumber: s.whatsappNumber || e.target.value,
                    }))
                  }
                  placeholder="03XXXXXXXXX"
                />
              </MzField>
              <MzField label="WhatsApp number (send from mobile)">
                <MzInput
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings((s) => ({ ...s, whatsappNumber: e.target.value }))}
                  placeholder="03XXXXXXXXX or 923…"
                />
              </MzField>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={settings.whatsappDefaultOn}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, whatsappDefaultOn: e.target.checked }))
                  }
                />
                Mobile: default “Share on WhatsApp” after sale / purchase
              </label>
              <div className="sm:col-span-2">
                <MzField label="Shop address">
                  <MzInput
                    value={settings.shopAddress}
                    onChange={(e) => setSettings((s) => ({ ...s, shopAddress: e.target.value }))}
                  />
                </MzField>
              </div>
              <div className="sm:col-span-2">
                <MzField label="Shop logo (MobiZone bills only)">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:text-slate-300"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 400_000) {
                        setMsg("Logo too large — use under 400 KB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = typeof reader.result === "string" ? reader.result : "";
                        setSettings((s) => ({ ...s, shopLogoUrl: dataUrl }));
                        setMsg(null);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {settings.shopLogoUrl ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={settings.shopLogoUrl}
                        alt="Shop logo"
                        className="h-14 w-14 rounded border border-slate-200 object-contain dark:border-slate-700"
                      />
                      <button
                        type="button"
                        className="text-xs text-rose-600 underline"
                        onClick={() => setSettings((s) => ({ ...s, shopLogoUrl: "" }))}
                      >
                        Remove logo
                      </button>
                    </div>
                  ) : (
                    <p className={`mt-1 text-[11px] ${mutedClass}`}>
                      Optional — never pulls restaurant / POS Content Updation logos.
                    </p>
                  )}
                </MzField>
              </div>
              <MzField label="Document title">
                <MzInput
                  value={settings.documentTitle}
                  onChange={(e) => setSettings((s) => ({ ...s, documentTitle: e.target.value }))}
                />
              </MzField>
              <MzField label="Paper width">
                <MzSelect
                  value={String(settings.paperWidthMm)}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      paperWidthMm: e.target.value === "58" ? 58 : 80,
                    }))
                  }
                >
                  <option value="80">80mm thermal</option>
                  <option value="58">58mm thermal</option>
                </MzSelect>
              </MzField>
              <MzField label="Slip size (font)">
                <MzSelect
                  value={String(settings.fontScale)}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, fontScale: Number(e.target.value) || 1 }))
                  }
                >
                  <option value="0.85">Smaller</option>
                  <option value="1">Normal</option>
                  <option value="1.15">Larger</option>
                  <option value="1.3">Largest</option>
                </MzSelect>
              </MzField>
              <MzField label="Slip length">
                <MzSelect
                  value={settings.density}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      density: e.target.value === "comfortable" ? "comfortable" : "compact",
                    }))
                  }
                >
                  <option value="compact">Short / compact</option>
                  <option value="comfortable">Tall / comfortable</option>
                </MzSelect>
              </MzField>
              <MzField label="Slip look">
                <MzSelect
                  value={settings.slipTheme}
                  onChange={(e) => {
                    const slipTheme = e.target.value === "classic" ? "classic" : "dark";
                    setSettings((s) => ({
                      ...s,
                      slipTheme,
                      design:
                        slipTheme === "dark"
                          ? { ...RECEIPT_DESIGN_PRESETS.navy }
                          : { ...RECEIPT_DESIGN_PRESETS.teal },
                    }));
                  }}
                >
                  <option value="dark">Full black (both sides)</option>
                  <option value="classic">White paper</option>
                </MzSelect>
              </MzField>
              <div className="sm:col-span-2">
                <MzField label="Footer message">
                  <MzInput
                    value={settings.footerText}
                    onChange={(e) => setSettings((s) => ({ ...s, footerText: e.target.value }))}
                  />
                </MzField>
              </div>
            </div>
          </MzSection>

          <MzSection title="Design colors (preview)">
            <p className={`mb-2 text-xs ${mutedClass}`}>
              On-screen / share preview colors. Thermal print stays black on white.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ["Teal", RECEIPT_DESIGN_PRESETS.teal],
                  ["Classic", RECEIPT_DESIGN_PRESETS.classic],
                  ["Navy", RECEIPT_DESIGN_PRESETS.navy],
                ] as const
              ).map(([label, preset]) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-600"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      design: { ...preset },
                      slipTheme: label === "Navy" ? "dark" : "classic",
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["accent", "Accent"],
                  ["text", "Text"],
                  ["muted", "Muted"],
                  ["border", "Border"],
                  ["background", "Background"],
                ] as const
              ).map(([key, label]) => (
                <MzField key={key} label={label}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.design[key]}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          design: { ...s.design, [key]: e.target.value } as MobizoneReceiptDesign,
                        }))
                      }
                      className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-600"
                    />
                    <MzInput
                      value={settings.design[key]}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          design: { ...s.design, [key]: e.target.value } as MobizoneReceiptDesign,
                        }))
                      }
                    />
                  </div>
                </MzField>
              ))}
            </div>
          </MzSection>

          {FIELD_GROUPS.map((group) => (
            <MzSection key={group.title} title={group.title}>
              <ul className="space-y-2">
                {group.keys.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-3 text-sm">
                    <label className="flex cursor-pointer items-center gap-2 text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={settings.fields[key]}
                        onChange={(e) => patchField(key, e.target.checked)}
                      />
                      {MOBIZONE_RECEIPT_FIELD_LABELS[key]}
                    </label>
                  </li>
                ))}
              </ul>
            </MzSection>
          ))}

          <MzStickyActions>
            <MzPrimaryButton onClick={onSave} disabled={!branchCode}>
              Save settings
            </MzPrimaryButton>
            <MzSecondaryButton onClick={onPreviewPrint}>Print preview</MzSecondaryButton>
            <MzSecondaryButton onClick={onReset}>Reset defaults</MzSecondaryButton>
          </MzStickyActions>
        </div>

        <MzSection title="Live preview">
          <p className={`mb-2 text-xs ${mutedClass}`}>
            Sample / last sale · total {formatPkr(sampleSale.pricePkr)}
          </p>
          <div
            className="overflow-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            style={{
              maxWidth: settings.paperWidthMm === 58 ? 260 : 340,
              background: settings.design.background,
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </MzSection>
      </div>
    </MzPage>
  );
}
