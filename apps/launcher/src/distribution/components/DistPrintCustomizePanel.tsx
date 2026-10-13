/** Distribution print customization — A4 report / wholesale documents (not thermal POS). */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@platform/ui";
import {
  DIST_DOCUMENT_TEMPLATES,
  buildDistDocumentPreviewHtml,
  loadActiveDistDocumentTemplateId,
  saveActiveDistDocumentTemplateId,
  type DistDocumentTemplateId,
} from "../lib/distDocumentTemplates";
import {
  DEFAULT_DIST_PRINT_DESIGN,
  loadDistPrintDesign,
  saveDistPrintDesign,
  type DistPrintDesignSettings,
} from "../lib/distPrintDesign";
import {
  DEFAULT_DIST_REPORT_PRINT,
  DIST_REPORT_LOOKS,
  formatReportNumber,
  loadDistReportPrintSettings,
  saveDistReportPrintSettings,
  type DistReportLookId,
  type DistReportPrintSettings,
} from "../lib/distReportSettings";
import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import { buildDistDocumentHtml } from "../lib/printDistOrder";

type Props = {
  branchName: string;
  branchCode: string;
  notify?: (message: string) => void;
};

function ToggleRow(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
      <span className="text-slate-700 dark:text-slate-200">{props.label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-cyan-600"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {props.label}
      </span>
      <input
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
  );
}

export function DistPrintCustomizePanel({
  branchName,
  branchCode,
  notify,
}: Props): JSX.Element {
  const [templateId, setTemplateId] = useState<DistDocumentTemplateId>(() =>
    loadActiveDistDocumentTemplateId(branchCode),
  );
  const [design, setDesign] = useState<DistPrintDesignSettings>(() =>
    loadDistPrintDesign(branchCode, loadActiveDistDocumentTemplateId(branchCode)),
  );
  const [reportSettings, setReportSettings] = useState<DistReportPrintSettings>(() =>
    loadDistReportPrintSettings(branchCode),
  );
  const [reportDirty, setReportDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const id = loadActiveDistDocumentTemplateId(branchCode);
    setTemplateId(id);
    setDesign(loadDistPrintDesign(branchCode, id));
    setReportSettings(loadDistReportPrintSettings(branchCode));
    setDirty(false);
    setReportDirty(false);
  }, [branchCode]);

  function patchReport(partial: Partial<DistReportPrintSettings>): void {
    setReportSettings((prev) => ({
      ...prev,
      ...partial,
      number: { ...prev.number, ...(partial.number ?? {}) },
    }));
    setReportDirty(true);
  }

  const activeTemplate = DIST_DOCUMENT_TEMPLATES.find((t) => t.id === templateId);
  const previewHtml = useMemo(
    () =>
      buildDistDocumentPreviewHtml({
        templateId,
        branchName,
        branchCode,
        design,
      }),
    [templateId, branchName, branchCode, design],
  );

  function patchDesign(partial: Partial<DistPrintDesignSettings>): void {
    setDesign((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  }

  function persistCurrentDesign(id: DistDocumentTemplateId, settings: DistPrintDesignSettings): void {
    saveDistPrintDesign(branchCode, id, settings);
  }

  function selectTemplate(id: DistDocumentTemplateId): void {
    if (id === templateId) return;
    if (dirty) {
      persistCurrentDesign(templateId, design);
      notify?.(`Saved design for ${activeTemplate?.name ?? templateId}`);
    }
    setTemplateId(id);
    saveActiveDistDocumentTemplateId(branchCode, id);
    setDesign(loadDistPrintDesign(branchCode, id));
    setDirty(false);
    notify?.(
      `Editing: ${DIST_DOCUMENT_TEMPLATES.find((t) => t.id === id)?.name ?? id}`,
    );
  }

  function saveDesign(): void {
    const next = saveDistPrintDesign(branchCode, templateId, design);
    setDesign(next);
    setDirty(false);
    notify?.(
      `Saved — ${activeTemplate?.name ?? "template"} design (this template only).`,
    );
  }

  function resetDesign(): void {
    setDesign({ ...DEFAULT_DIST_PRINT_DESIGN });
    setDirty(true);
    notify?.("Reset to defaults — click Save design to apply for this template.");
  }

  async function printSample(): Promise<void> {
    setBusy(true);
    try {
      const ok = await printHtmlDocumentAndWait(
        previewHtml,
        activeTemplate?.name ?? "Distribution",
      );
      notify?.(ok ? "Sample A4 document sent to printer." : "Could not open print dialog.");
    } finally {
      setBusy(false);
    }
  }

  function saveReportSettings(): void {
    const next = saveDistReportPrintSettings(branchCode, reportSettings);
    setReportSettings(next);
    setReportDirty(false);
    notify?.(
      `Saved report print — look “${next.look}”, next # ${formatReportNumber(next.number, next.number.nextNumber)}`,
    );
  }

  const reportPreviewHtml = useMemo(
    () =>
      buildDistDocumentHtml({
        title: "Sample sales report",
        documentNumber: formatReportNumber(reportSettings.number, reportSettings.number.nextNumber),
        branchName,
        branchCode,
        templateId: "sales-register",
        partyLabel: "Report",
        partyName: "Company × SKU sales",
        partyExtra: "Preview — Customize → Report print looks",
        meta: [
          { label: "Report #", value: formatReportNumber(reportSettings.number, reportSettings.number.nextNumber) },
          { label: "Rows", value: "3" },
          { label: "Look", value: reportSettings.look },
        ],
        report: {
          columns: ["Company", "SKU", "Product", "Qty", "Bonus", "Sales PKR"],
          rows: [
            { Company: "Lamos Pharma", SKU: "LAM-500", Product: "Lamos 500mg", Qty: 120, Bonus: 6, "Sales PKR": 14400 },
            { Company: "Lamos Pharma", SKU: "FLG-400", Product: "Flagyl Dist", Qty: 80, Bonus: 0, "Sales PKR": 6400 },
            { Company: "Getz", SKU: "PAN-40", Product: "Risek Cap", Qty: 40, Bonus: 2, "Sales PKR": 5200 },
          ],
        },
        footerNote: "Distribution report — preview",
        reportPrint: reportSettings,
        design,
      }),
    [reportSettings, branchName, branchCode, design],
  );

  async function printReportSample(): Promise<void> {
    setBusy(true);
    try {
      const ok = await printHtmlDocumentAndWait(reportPreviewHtml, "Report sample");
      notify?.(ok ? "Report sample sent to printer." : "Could not open print dialog.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Distribution documents (A4 report style)
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Top se template choose karo — har document type ka <strong>alag design</strong> save hota
          hai. Neeche <strong>3 report looks</strong> + report number sequence settings hain.
        </p>
      </div>

      {/* Report looks + numbering */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Report print — 3 designs
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Har report print isi look se niklegi. Brand color + watermark Customize yahan se.
              {reportDirty ? (
                <span className="ml-2 text-amber-600 dark:text-amber-400">· Unsaved</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="text-xs" onClick={saveReportSettings} disabled={!reportDirty}>
              Save report settings
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              disabled={busy}
              onClick={() => void printReportSample()}
            >
              Preview print
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {DIST_REPORT_LOOKS.map((look) => {
            const on = reportSettings.look === look.id;
            return (
              <button
                key={look.id}
                type="button"
                onClick={() => patchReport({ look: look.id as DistReportLookId })}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  on
                    ? "border-cyan-600 bg-cyan-600/10 ring-1 ring-cyan-600/40"
                    : "border-slate-200 hover:border-cyan-400 dark:border-slate-700"
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{look.name}</div>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">{look.description}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Brand color
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={reportSettings.brandColor}
                onChange={(e) => patchReport({ brandColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white dark:border-slate-700"
              />
              <input
                type="text"
                value={reportSettings.brandColor}
                onChange={(e) => patchReport({ brandColor: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </label>
          <Field
            label="Watermark text"
            value={reportSettings.watermarkText}
            onChange={(v) => patchReport({ watermarkText: v })}
            placeholder="ZIVRA DIST"
          />
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Watermark opacity
            </span>
            <input
              type="range"
              min={0.03}
              max={0.25}
              step={0.01}
              value={reportSettings.watermarkOpacity}
              onChange={(e) => patchReport({ watermarkOpacity: Number(e.target.value) })}
              className="mt-2 w-full accent-cyan-600"
            />
          </label>
          <ToggleRow
            label="Show watermark (watermark look)"
            checked={reportSettings.showWatermark}
            onChange={(v) => patchReport({ showWatermark: v })}
          />
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-600">
          <h5 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Report number sequence
          </h5>
          <p className="mt-1 text-[11px] text-slate-500">
            Next save will get{" "}
            <strong className="font-mono text-slate-800 dark:text-slate-200">
              {formatReportNumber(reportSettings.number, reportSettings.number.nextNumber)}
            </strong>
            . Prefix / start / padding yahan set karo.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field
              label="Prefix"
              value={reportSettings.number.prefix}
              onChange={(v) => patchReport({ number: { ...reportSettings.number, prefix: v } })}
              placeholder="CR"
            />
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Next number
              </span>
              <input
                type="number"
                min={1}
                value={reportSettings.number.nextNumber}
                onChange={(e) =>
                  patchReport({
                    number: { ...reportSettings.number, nextNumber: Number(e.target.value) || 1 },
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Digits (pad)
              </span>
              <select
                value={reportSettings.number.pad}
                onChange={(e) =>
                  patchReport({
                    number: { ...reportSettings.number, pad: Number(e.target.value) },
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} digits
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="mt-2 text-[11px] text-slate-500 underline"
            onClick={() =>
              patchReport({ number: { ...DEFAULT_DIST_REPORT_PRINT.number } })
            }
          >
            Reset sequence defaults (CR / 1 / 4)
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-200/80 dark:border-slate-700 dark:bg-slate-900">
          <iframe
            title="Report print look preview"
            srcDoc={reportPreviewHtml}
            className="mx-auto block h-[min(50vh,520px)] w-full max-w-[210mm] border-0 bg-white"
            sandbox="allow-same-origin"
          />
        </div>
      </section>

      {/* Template picker — top */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Template — design kis ke liye
          </h4>
          <span className="text-[11px] text-slate-500">
            Selected: <strong className="text-slate-800 dark:text-slate-200">{activeTemplate?.name}</strong>
            {dirty ? (
              <span className="ml-2 text-amber-600 dark:text-amber-400">· Unsaved</span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DIST_DOCUMENT_TEMPLATES.map((tpl) => {
            const on = tpl.id === templateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => selectTemplate(tpl.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  on
                    ? "border-cyan-600 bg-cyan-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                }`}
              >
                {tpl.name}
              </button>
            );
          })}
        </div>
        {activeTemplate ? (
          <p className="text-[11px] text-slate-500">{activeTemplate.description}</p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/40">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Edit design — {activeTemplate?.name}
          </h4>

          <Field
            label="Company name (override)"
            value={design.companyName}
            placeholder={branchName || "Uses branch name if empty"}
            onChange={(v) => patchDesign({ companyName: v })}
          />
          <Field
            label="Subtitle / tagline"
            value={design.companySubtitle}
            placeholder="Wholesale Medical Distribution"
            onChange={(v) => patchDesign({ companySubtitle: v })}
          />
          <Field
            label="Footer note"
            value={design.footerNote}
            onChange={(v) => patchDesign({ footerNote: v })}
          />

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Font size
            </span>
            <select
              value={design.baseFontSize}
              onChange={(e) => patchDesign({ baseFontSize: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value={10}>10 — compact</option>
              <option value={11}>11 — default</option>
              <option value={12}>12 — larger</option>
              <option value={13}>13 — large</option>
            </select>
          </label>

          <div className="space-y-1.5">
            <ToggleRow
              label="Show branch code in header"
              checked={design.showBranchCode}
              onChange={(v) => patchDesign({ showBranchCode: v })}
            />
            <ToggleRow
              label="Pack column"
              checked={design.showPackColumn}
              onChange={(v) => patchDesign({ showPackColumn: v })}
            />
            <ToggleRow
              label="Bonus column"
              checked={design.showBonusColumn}
              onChange={(v) => patchDesign({ showBonusColumn: v })}
            />
            <ToggleRow
              label="Amount in words"
              checked={design.showAmountInWords}
              onChange={(v) => patchDesign({ showAmountInWords: v })}
            />
            <ToggleRow
              label="Signature lines"
              checked={design.showSignatures}
              onChange={(v) => patchDesign({ showSignatures: v })}
            />
            <ToggleRow
              label="Striped table rows"
              checked={design.stripedRows}
              onChange={(v) => patchDesign({ stripedRows: v })}
            />
          </div>

          {design.showSignatures ? (
            <div className="grid gap-2">
              <Field
                label="Sign — prepared"
                value={design.signPrepared}
                onChange={(v) => patchDesign({ signPrepared: v })}
              />
              <Field
                label="Sign — checked"
                value={design.signChecked}
                onChange={(v) => patchDesign({ signChecked: v })}
              />
              <Field
                label="Sign — received"
                value={design.signReceived}
                onChange={(v) => patchDesign({ signReceived: v })}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" className="text-xs" onClick={saveDesign} disabled={!dirty}>
              Save this template
            </Button>
            <Button type="button" variant="secondary" className="text-xs" onClick={resetDesign}>
              Reset defaults
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              disabled={busy}
              onClick={() => void printSample()}
            >
              {busy ? "Printing…" : "Print sample"}
            </Button>
          </div>
        </section>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Live A4 preview — {activeTemplate?.name}
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-200/80 dark:border-slate-700 dark:bg-slate-900">
            <iframe
              title="Distribution A4 document preview"
              srcDoc={previewHtml}
              className="mx-auto block h-[min(80vh,900px)] w-full max-w-[210mm] border-0 bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
