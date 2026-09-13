import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  buildLocalTemplateCsv,
  downloadTextFile,
  ioApi,
  LOCAL_IO_MODULES,
  type IoFieldDef,
  type IoValidateResult,
} from "../../pharmacy/api/pharmacy-io";
import { fetchPharmacyCompanies, fetchPharmacyTradeCustomers } from "../../pharmacy/api/pharmacy-erp";
import { fetchPharmacyMedicines } from "../../pharmacy/api/pharmacy";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistPageShell,
  DistPanel,
  DistSelect,
} from "../ui/DistUi";

function detectDelimiter(sampleLine: string): string {
  const counts = [
    { d: ",", n: (sampleLine.match(/,/g) ?? []).length },
    { d: ";", n: (sampleLine.match(/;/g) ?? []).length },
    { d: "\t", n: (sampleLine.match(/\t/g) ?? []).length },
  ];
  counts.sort((a, b) => b.n - a.n);
  return counts[0] && counts[0].n > 0 ? counts[0].d : ",";
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rawLines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const lines = rawLines.filter((l) => {
    const t = l.trim();
    return t && !t.startsWith("#");
  });
  if (lines.length === 0) return { headers: [], rows: [] };
  const delimiter = detectDelimiter(lines[0] ?? "");
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === delimiter && !inQ) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0] ?? "").filter((h) => h.length > 0);
  const rows = lines
    .slice(1)
    .map(split)
    .filter((r) => r.some((c) => String(c).trim() !== ""));
  return { headers, rows };
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[%()]/g, " ")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

const FIELD_ALIASES: Record<string, string[]> = {
  sku: ["sku", "productcode", "itemcode", "code", "medicinecode"],
  name: ["name", "productname", "itemname", "medicinename"],
  genericName: ["generic", "genericname"],
  companyCode: ["companycode", "company", "mfrcode"],
  barcode: ["barcode", "ean", "upc"],
  unit: ["unit", "uom"],
  taxPct: ["tax", "taxpct", "taxpercent", "gst"],
  purchasePrice: ["purchaseprice", "cost", "costprice", "buyprice"],
  sellingPrice: ["saleprice", "sellingprice", "mrp", "retailprice"],
  wholesalePrice: ["wholesaleprice", "tp", "tradeprice", "dealerprice"],
  status: ["status", "active"],
  code: ["code", "customercode", "companycode"],
  businessName: ["businessname", "shopname"],
  customerType: ["type", "customertype"],
  phone: ["phone", "mobile", "contact"],
  creditLimitPkr: ["creditlimit", "limit"],
  creditDays: ["creditdays", "days"],
  priceLevel: ["pricelevel", "pricetier"],
  warehouseCode: ["warehousecode", "warehouse", "wh"],
  batchNumber: ["batch", "batchnumber", "batchno"],
  expiryDate: ["expiry", "expirydate", "exp"],
  quantity: ["quantity", "qty", "stock"],
  purchaseCost: ["purchasecost", "cost"],
};

function autoMap(headers: string[], fields: IoFieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of fields) {
    const aliases = new Set([
      normHeader(f.key),
      normHeader(f.label),
      ...(FIELD_ALIASES[f.key] ?? []),
    ]);
    const hit = headers.find((h) => {
      if (used.has(h)) return false;
      return aliases.has(normHeader(h));
    });
    if (hit) {
      map[f.key] = hit;
      used.add(hit);
    }
  }
  return map;
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const EXPORTABLE = new Set(["medicines", "customers", "suppliers", "companies", "invoices"]);

export function DistributionImportPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const fileRef = useRef<HTMLInputElement>(null);
  const [module, setModule] = useState("medicines");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importValidOnly, setImportValidOnly] = useState(false);
  const [ioError, setIoError] = useState<string | null>(null);
  const [ioNotice, setIoNotice] = useState<string | null>(null);
  const [ioBusy, setIoBusy] = useState(false);

  const modules = useQuery({
    queryKey: ["distribution", "io", "modules"],
    queryFn: ioApi.modules,
    retry: 1,
  });
  const jobs = useQuery({ queryKey: ["distribution", "io", "jobs"], queryFn: () => ioApi.jobs(1) });

  const moduleList = modules.data?.length ? modules.data : LOCAL_IO_MODULES;
  const fields = useMemo(
    () => moduleList.find((m) => m.id === module)?.fields ?? LOCAL_IO_MODULES[0]?.fields ?? [],
    [moduleList, module],
  );

  const applyParsed = (parsed: { headers: string[]; rows: string[][] }, name: string, notice?: string) => {
    if (!parsed.headers.length) throw new Error("CSV has no header row.");
    setFileName(name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(autoMap(parsed.headers, fields));
    setIoError(null);
    setIoNotice(
      notice ??
        `Loaded ${parsed.headers.length} columns · ${parsed.rows.length} data row(s) from ${name}. Mapping auto-filled — check step 2, then Validate.`,
    );
    validate.reset();
    commit.reset();
  };

  const validate = useMutation({
    mutationFn: () =>
      ioApi.validate({
        branchCode: branch!.code,
        module,
        headers,
        rows,
        mapping,
      }),
  });
  const commit = useMutation({
    mutationFn: () =>
      ioApi.commit({
        branchCode: branch!.code,
        module,
        headers,
        rows,
        mapping,
        fileName,
        importValidOnly,
      }),
    onSuccess: () => void jobs.refetch(),
  });

  const onFile = async (file: File) => {
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      throw new Error(
        "Excel workbook (.xlsx) is not supported. Open the file → Save As → CSV (Comma delimited) → choose that CSV here.",
      );
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      throw new Error("Only CSV is supported. Download the template, fill it, Save As CSV, then choose the file.");
    }
    if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB.");
    const text = await file.text();
    applyParsed(parseCsv(text), file.name);
  };

  const downloadTemplate = async () => {
    setIoError(null);
    setIoBusy(true);
    try {
      let csv = "";
      let filename = `${module}-import-template.csv`;
      try {
        const t = await ioApi.template(module);
        if (!t?.csv?.trim()) throw new Error("Template was empty.");
        csv = t.csv;
        filename = t.filename || filename;
      } catch {
        const local = buildLocalTemplateCsv(module, fields);
        csv = local.csv;
        filename = local.filename;
      }
      downloadTextFile(filename, csv);
      // Also load into the page so mapping dropdowns fill immediately.
      applyParsed(parseCsv(csv), filename, `Template ready (${filename}). Fill more rows in Excel, Save As CSV, or Validate the sample row.`);
    } catch (e) {
      setIoError(e instanceof Error ? e.message : "Template download failed");
    } finally {
      setIoBusy(false);
    }
  };

  const exportLocalFallback = async (): Promise<{ filename: string; csv: string; rows: number }> => {
    if (!branch?.code) throw new Error("Select a branch before exporting.");
    if (module === "medicines") {
      const list = (await fetchPharmacyMedicines(branch.code)) as Array<Record<string, unknown>>;
      const header =
        "Product Code,Product Name,Generic,Company Code,Barcode,Unit,Tax %,Purchase Price,Sale Price,Wholesale Price,Status";
      const lines = list.map((r) =>
        [
          r.sku,
          r.name,
          r.genericName ?? "",
          r.companyCode ?? "",
          r.barcode ?? "",
          r.unit ?? "",
          r.taxPct ?? 0,
          r.purchasePricePkr ?? r.purchasePrice ?? 0,
          r.sellingPricePkr ?? r.sellingPrice ?? 0,
          r.wholesalePricePkr ?? r.wholesalePrice ?? 0,
          r.status ?? "active",
        ]
          .map(csvEscape)
          .join(","),
      );
      return {
        filename: "medicines-export.csv",
        csv: [header, ...lines].join("\r\n"),
        rows: lines.length,
      };
    }
    if (module === "customers") {
      const list = (await fetchPharmacyTradeCustomers(branch.code)) as Array<Record<string, unknown>>;
      const header = "Customer Code,Customer Name,Outstanding,Credit Limit";
      const lines = list.map((r) =>
        [r.code, r.name, r.outstandingPkr ?? 0, r.creditLimitPkr ?? 0].map(csvEscape).join(","),
      );
      return {
        filename: "customers-export.csv",
        csv: [header, ...lines].join("\r\n"),
        rows: lines.length,
      };
    }
    if (module === "companies") {
      const list = (await fetchPharmacyCompanies()) as Array<Record<string, unknown>>;
      const header = "Company Code,Company Name,Manufacturer,Status";
      const lines = list.map((r) =>
        [r.code, r.name, r.manufacturerName ?? "", r.status ?? ""].map(csvEscape).join(","),
      );
      return {
        filename: "companies-export.csv",
        csv: [header, ...lines].join("\r\n"),
        rows: lines.length,
      };
    }
    throw new Error(`Local export fallback is not available for “${module}”.`);
  };

  const exportCsv = async () => {
    setIoError(null);
    setIoNotice(null);
    if (!branch?.code) {
      setIoError("Select a branch before exporting.");
      return;
    }
    if (module === "opening_stock") {
      setIoError("Opening stock has no export dump. Download the opening_stock template, or export medicines.");
      return;
    }
    if (!EXPORTABLE.has(module)) {
      setIoError(`Export is not available for “${module}”.`);
      return;
    }
    setIoBusy(true);
    try {
      let exp: { filename: string; csv: string; rows: number };
      let notice: string | null = null;
      try {
        exp = await ioApi.exportCsv({ branchCode: branch.code, module });
        if (!exp?.csv) throw new Error("Export returned empty file.");
      } catch (apiErr) {
        exp = await exportLocalFallback();
        notice = `Server export unavailable (${apiErr instanceof Error ? apiErr.message : "error"}). Used live data export instead.`;
      }
      downloadTextFile(exp.filename || `${module}-export.csv`, exp.csv);
      if ((exp.rows ?? 0) === 0) {
        setIoError("Export completed with 0 data rows (header only). Add masters first, then export again.");
      } else {
        setIoNotice(notice ?? `Exported ${exp.rows} row(s) → ${exp.filename}`);
      }
    } catch (e) {
      setIoError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIoBusy(false);
    }
  };

  const validateData = validate.data as IoValidateResult | undefined;
  const preview = validateData?.preview ?? [];
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <DistPageShell
      title="Import / Export"
      subtitle="Template → fill CSV → map columns → validate → confirm. Excel must be saved as CSV."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Import" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <DistButton variant="secondary" disabled={ioBusy} onClick={() => void downloadTemplate()}>
            Download template
          </DistButton>
          <DistButton variant="secondary" disabled={ioBusy} onClick={() => void exportCsv()}>
            Export CSV
          </DistButton>
        </div>
      }
    >
      {ioError ? <DistErrorBanner message={ioError} onRetry={() => setIoError(null)} /> : null}
      {ioNotice ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {ioNotice}
        </div>
      ) : null}
      {modules.isError ? (
        <DistErrorBanner
          message={`Could not load import modules from server (${(modules.error as Error).message}). Using built-in field list.`}
          onRetry={() => void modules.refetch()}
        />
      ) : null}

      <DistPanel title="1. File">
        <div className="grid gap-2 sm:grid-cols-3">
          <DistSelect
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setHeaders([]);
              setRows([]);
              setMapping({});
              setFileName("");
              setIoError(null);
              setIoNotice(null);
              validate.reset();
              commit.reset();
            }}
          >
            {moduleList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id.replace("_", " ")}
              </option>
            ))}
          </DistSelect>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void onFile(file).catch((err) => {
                    setIoError((err as Error).message);
                    setIoNotice(null);
                  });
                }
                e.target.value = "";
              }}
            />
            <DistButton variant="secondary" onClick={() => fileRef.current?.click()}>
              Choose CSV
            </DistButton>
            {headers.length > 0 ? (
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => {
                  setHeaders([]);
                  setRows([]);
                  setMapping({});
                  setFileName("");
                  setIoNotice(null);
                  validate.reset();
                  commit.reset();
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {rows.length || headers.length
              ? `${headers.length} columns · ${rows.length} data rows${fileName ? ` · ${fileName}` : ""}`
              : "1) Download template  2) Fill in Excel  3) Save As CSV  4) Choose CSV here."}
          </p>
        </div>
      </DistPanel>

      <DistPanel title="2. Column mapping">
        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">Loading field definitions…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="text-xs text-slate-500">
                {f.label}
                {f.required ? " *" : ""}
                <DistSelect
                  className="mt-1"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  disabled={headers.length === 0}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </DistSelect>
              </label>
            ))}
          </div>
        )}
        {fields.length > 0 && headers.length === 0 ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Mapping is empty until a CSV is loaded. Click <strong>Download template</strong> (loads mapping
            automatically) or <strong>Choose CSV</strong>.
          </p>
        ) : headers.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Auto-mapped {mappedCount}/{fields.length} fields
            {mappedCount < fields.filter((f) => f.required).length
              ? " — map required (*) columns before Validate."
              : "."}
          </p>
        ) : null}
      </DistPanel>

      <DistPanel
        title="3. Validate & preview"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={importValidOnly}
                onChange={(e) => setImportValidOnly(e.target.checked)}
              />
              Import valid only
            </label>
            <DistButton
              variant="secondary"
              disabled={!branch?.code || rows.length === 0 || validate.isPending}
              onClick={() => validate.mutate()}
            >
              Validate
            </DistButton>
            <DistButton
              disabled={!branch?.code || !validate.data || commit.isPending}
              onClick={() => commit.mutate()}
            >
              Confirm import
            </DistButton>
          </div>
        }
      >
        {!branch?.code ? (
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">Select a branch to validate / import.</p>
        ) : null}
        {validate.isError ? (
          <DistErrorBanner message={(validate.error as Error).message} />
        ) : null}
        {commit.isError ? <DistErrorBanner message={(commit.error as Error).message} /> : null}
        {commit.isSuccess ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Import committed.</p>
        ) : null}
        {validateData ? (
          <p className="mb-2 text-xs text-slate-500">
            Valid {validateData.validRows ?? 0} · invalid {validateData.invalidRows ?? 0} · duplicates{" "}
            {validateData.duplicates ?? 0}
            {validateData.errors?.length
              ? ` · first error: ${validateData.errors[0]?.message ?? ""} (row ${validateData.errors[0]?.row ?? "?"})`
              : ""}
          </p>
        ) : null}
        <DistDataTable
          loading={validate.isPending}
          empty={
            headers.length === 0
              ? "Load a CSV first (Download template or Choose CSV)"
              : "Validate to preview rows"
          }
          rowKey={(r) => String((r as { _i?: number })._i ?? JSON.stringify(r).slice(0, 40))}
          rows={preview.map((r, i) => ({
            _i: i,
            _status: r.status,
            _issues: (r.issues ?? []).join("; "),
            ...(r.values ?? {}),
          }))}
          columns={[
            {
              key: "_status",
              header: "Status",
              render: (r: Record<string, unknown>) => String(r._status ?? ""),
            },
            ...(fields.length
              ? fields.slice(0, 5).map((f) => ({
                  key: f.key,
                  header: f.label,
                  render: (r: Record<string, unknown>) => String(r[f.key] ?? ""),
                }))
              : []),
            {
              key: "_issues",
              header: "Issues",
              render: (r: Record<string, unknown>) => String(r._issues ?? "") || "—",
            },
          ]}
        />
      </DistPanel>

      <DistPanel title="Import history">
        <DistDataTable
          loading={jobs.isLoading}
          empty="No import jobs yet"
          rowKey={(r) => String(r.id)}
          rows={(jobs.data?.items ?? []) as Array<Record<string, unknown>>}
          columns={[
            { key: "module", header: "Module", render: (r) => String(r.module ?? "") },
            { key: "kind", header: "Kind", render: (r) => String(r.kind ?? "") },
            { key: "status", header: "Status", render: (r) => String(r.status ?? "") },
            { key: "fileName", header: "File", render: (r) => String(r.fileName ?? "") },
            {
              key: "createdAt",
              header: "When",
              render: (r) => String(r.createdAt ?? "").slice(0, 19).replace("T", " "),
            },
          ]}
        />
      </DistPanel>
    </DistPageShell>
  );
}
