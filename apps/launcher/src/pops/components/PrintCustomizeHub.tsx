/** One place for receipt / KOT / paper customization — per business system, no duplicates. */

import { useEffect, useState } from "react";
import { BillCustomizationPanel } from "./BillCustomizationPanel";
import { KotCustomizationPanel } from "./KotCustomizationPanel";
import { ThermalPrintSettingsPanel } from "./ThermalPrintSettingsPanel";
import { DistPrintCustomizePanel } from "../../distribution/components/DistPrintCustomizePanel";
import { IconPalette, IconPrinter, IconReceipt } from "./printerUiIcons";
import { usePopsStore } from "../../stores/popsStore";
import { useActiveSystemId } from "../../hooks/useActiveSystemId";
import {
  BILL_PRINT_SETTINGS_CHANGED_EVENT,
  loadBillPrintSettings,
  saveBillPrintSettings,
  type BillPrintSettings,
} from "../lib/billPrintSettings";
import { isRestaurantFamilySystem } from "../../lib/businessSystems";

export type CustomizeSub = "receipt" | "kot" | "paper";

type SubDef = { id: CustomizeSub; label: string; hint: string; Icon: typeof IconReceipt };

function subsForSystem(systemId: string): SubDef[] {
  if (systemId === "ice-cream-bar") {
    return [
      { id: "receipt", label: "Receipt / Bill", hint: "Customer parlour slip", Icon: IconReceipt },
      { id: "kot", label: "Station ticket", hint: "Scoop / parlour station", Icon: IconPrinter },
      { id: "paper", label: "Paper & preview", hint: "Width, margins, test", Icon: IconPalette },
    ];
  }
  if (systemId === "restaurant") {
    return [
      { id: "receipt", label: "Receipt / Bill", hint: "Customer bill layout", Icon: IconReceipt },
      { id: "kot", label: "Kitchen (KOT)", hint: "Kitchen / bar ticket", Icon: IconPrinter },
      { id: "paper", label: "Paper & preview", hint: "Width, margins, test", Icon: IconPalette },
    ];
  }
  if (systemId === "general-store") {
    return [
      { id: "receipt", label: "Sales slip", hint: "POS order / pay slip", Icon: IconReceipt },
      { id: "paper", label: "Paper & preview", hint: "Width, margins, test", Icon: IconPalette },
    ];
  }
  if (systemId === "pharmacy") {
    return [
      { id: "receipt", label: "Pharmacy invoice", hint: "Rx / counter invoice", Icon: IconReceipt },
      { id: "paper", label: "Paper & preview", hint: "Width, margins, test", Icon: IconPalette },
    ];
  }
  if (systemId === "distribution") {
    return [
      {
        id: "receipt",
        label: "A4 documents",
        hint: "Booking / invoice / challan / reports",
        Icon: IconReceipt,
      },
    ];
  }
  if (systemId === "education") {
    return [
      { id: "receipt", label: "Fee receipt", hint: "Fee / payment slip", Icon: IconReceipt },
      { id: "paper", label: "Paper & preview", hint: "Width, margins, test", Icon: IconPalette },
    ];
  }
  return [
    { id: "receipt", label: "Invoice / slip", hint: "Document layout", Icon: IconReceipt },
    { id: "paper", label: "Paper & preview", hint: "Width, margins, test", Icon: IconPalette },
  ];
}

function hubBlurb(systemId: string): string {
  switch (systemId) {
    case "restaurant":
      return "Restaurant only — customer bill + kitchen KOT. Other systems keep their own templates.";
    case "ice-cream-bar":
      return "Ice Cream Bar only — parlour receipt + station ticket (not restaurant kitchen).";
    case "general-store":
      return "General Store only — one sales slip. No kitchen / cafe options.";
    case "pharmacy":
      return "Pharmacy only — invoice templates. No table / kitchen / service charge.";
    case "distribution":
      return "Distribution only — A4 report / wholesale invoice design (not thermal restaurant slips).";
    case "education":
      return "Education only — fee receipt. No restaurant print options.";
    default:
      return "Print layout for this business system only.";
  }
}

type Props = {
  branchCode: string;
  notify?: (message: string) => void;
  initialSub?: CustomizeSub;
};

export function PrintCustomizeHub({ branchCode, notify, initialSub = "receipt" }: Props): JSX.Element {
  const [sub, setSub] = useState<CustomizeSub>(initialSub);
  const branchName = usePopsStore((s) => s.branch?.name) ?? branchCode;
  const systemId = useActiveSystemId();
  const restaurantUi = isRestaurantFamilySystem(systemId);
  const subs = subsForSystem(systemId);
  const useStoreSlipEditor = systemId === "general-store";
  const useDistReportEditor = systemId === "distribution";
  const kotVariant: "restaurant" | "store" | "ice-cream-bar" =
    systemId === "general-store"
      ? "store"
      : systemId === "ice-cream-bar"
        ? "ice-cream-bar"
        : "restaurant";
  const [billSettings, setBillSettings] = useState<BillPrintSettings>(() =>
    loadBillPrintSettings(branchCode, systemId),
  );

  useEffect(() => {
    setBillSettings(loadBillPrintSettings(branchCode, systemId));
    const allowed = new Set(subs.map((s) => s.id));
    setSub(allowed.has(initialSub) ? initialSub : "receipt");
  }, [branchCode, initialSub, systemId]);

  useEffect(() => {
    function onBillChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!detail?.branchCode || detail.branchCode === branchCode) {
        setBillSettings(loadBillPrintSettings(branchCode, systemId));
      }
    }
    window.addEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onBillChanged);
    return () => window.removeEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onBillChanged);
  }, [branchCode, systemId]);

  function persistBill(next: BillPrintSettings): void {
    saveBillPrintSettings(branchCode, next, systemId);
    setBillSettings(next);
    notify?.("Receipt layout saved for this system.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 to-slate-950/60 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
            <IconPalette className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Print customization</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{hubBlurb(systemId)}</p>
          </div>
        </div>
      </div>

      <div className={`grid gap-2 ${subs.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {subs.map(({ id, label, hint, Icon }) => {
          const on = sub === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                on
                  ? "border-amber-500/50 bg-amber-500/10 shadow-sm shadow-amber-900/20"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  on ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className={`block text-sm font-medium ${on ? "text-amber-100" : "text-slate-200"}`}>
                  {label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[12rem]">
        {sub === "receipt" && useDistReportEditor ? (
          <DistPrintCustomizePanel
            branchName={branchName}
            branchCode={branchCode}
            notify={notify}
          />
        ) : null}
        {sub === "receipt" && useStoreSlipEditor ? (
          <KotCustomizationPanel
            branchCode={branchCode}
            branchName={branchName}
            variant="store"
            onNotice={notify}
          />
        ) : null}
        {sub === "receipt" && !useStoreSlipEditor && !useDistReportEditor ? (
          <BillCustomizationPanel
            branchName={branchName}
            branchCode={branchCode}
            settings={billSettings}
            onChange={setBillSettings}
            onSave={(next) => {
              persistBill(next);
            }}
            onNotice={notify}
          />
        ) : null}
        {sub === "kot" && restaurantUi ? (
          <KotCustomizationPanel
            branchCode={branchCode}
            branchName={branchName}
            variant={kotVariant}
            onNotice={notify}
          />
        ) : null}
        {sub === "paper" ? (
          <ThermalPrintSettingsPanel branchCode={branchCode} notify={notify} variant="paper" />
        ) : null}
      </div>
    </div>
  );
}
