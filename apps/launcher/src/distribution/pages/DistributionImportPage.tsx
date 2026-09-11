import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { downloadTextFile, ioApi } from "../../pharmacy/api/pharmacy-io";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  DistButton,
  DistDataTable,
  DistPageShell,
  DistPanel,
  DistSelect,
} from "../ui/DistUi";

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length === 0) return { headers: [], rows: [] };
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
      } else if (ch === "," && !inQ) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  return { headers: split(lines[0] ?? ""), rows: lines.slice(1).map(split) };
}

function autoMap(headers: string[], fields: Array<{ key: string; label: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    const hit = headers.find(
      (h) =>
        h.toLowerCase() === f.key.toLowerCase() ||
        h.toLowerCase().replace(/\s+/g, "") === f.key.toLowerCase() ||
        h.toLowerCase() === f.label.toLowerCase(),
    );
    if (hit) map[f.key] = hit;
  }
  return map;
}

export function DistributionImportPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [module, setModule] = useState("medicines");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importValidOnly, setImportValidOnly] = useState(false);

  const modules = useQuery({ queryKey: ["distribution", "io", "modules"], queryFn: ioApi.modules });
  const jobs = useQuery({ queryKey: ["distribution", "io", "jobs"], queryFn: () => ioApi.jobs(1) });
  const fields = useMemo(
    () => modules.data?.find((m) => m.id === module)?.fields ?? [],
    [modules.data, module],
  );

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
    if (!/\.(csv|txt)$/i.test(file.name)) {
      validate.reset();
      throw new Error("Only CSV is supported. Download the template (Excel can save as CSV).");
    }
    if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB.");
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(autoMap(parsed.headers, fields));
    validate.reset();
    commit.reset();
  };

  const preview = (validate.data?.preview ?? []) as Array<Record<string, unknown>>;

  return (
    <DistPageShell
      title="Import / Export"
      subtitle="One import engine: template → map → validate → preview → confirm. Invalid rows are never inserted silently."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Import" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <DistButton
            variant="secondary"
            onClick={async () => {
              const t = await ioApi.template(module);
              downloadTextFile(t.filename, t.csv);
            }}
          >
            Download template
          </DistButton>
          <DistButton
            variant="secondary"
            onClick={async () => {
              if (!branch?.code) return;
              const exp = await ioApi.exportCsv({ branchCode: branch.code, module: module === "opening_stock" ? "medicines" : module });
              downloadTextFile(exp.filename, exp.csv);
            }}
          >
            Export filtered
          </DistButton>
        </div>
      }
    >
      <DistPanel title="1. File">
        <div className="grid gap-2 sm:grid-cols-3">
          <DistSelect
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setHeaders([]);
              setRows([]);
              setMapping({});
              validate.reset();
            }}
          >
            {(modules.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.id.replace("_", " ")}
              </option>
            ))}
          </DistSelect>
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file).catch((err) => window.alert((err as Error).message));
            }}
          />
          <p className="text-xs text-slate-500">{rows.length ? `${rows.length} data rows from ${fileName}` : "CSV only. XLSX is not installed."}</p>
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
                >
                  <option value="">— unmapped —</option>
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
        <div className="mt-3">
          <DistButton disabled={!headers.length || !branch} onClick={() => validate.mutate()}>
            Validate
          </DistButton>
        </div>
        {validate.isError ? <p className="mt-2 text-sm text-red-700">{(validate.error as Error).message}</p> : null}
      </DistPanel>

      {validate.data ? (
        <DistPanel
          title="3. Preview"
          subtitle={`Total ${String(validate.data.totalRows)} · Valid ${String(validate.data.validRows)} · Invalid ${String(validate.data.invalidRows)} · Duplicates ${String(validate.data.duplicates)}`}
        >
          <DistDataTable
            columns={[
              { key: "row", header: "Row" },
              { key: "status", header: "Status" },
              {
                key: "values",
                header: "Values",
                render: (r) => JSON.stringify(r.values ?? {}),
              },
              {
                key: "issues",
                header: "Issue",
                render: (r) => (Array.isArray(r.issues) ? (r.issues as string[]).join("; ") : "—"),
              },
            ]}
            rows={preview}
            rowKey={(r) => String(r.row)}
            empty="No preview rows."
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={importValidOnly} onChange={(e) => setImportValidOnly(e.target.checked)} />
            Import valid rows only (leave invalid rows out — they are not inserted silently)
          </label>
          <div className="mt-3 flex gap-2">
            <DistButton disabled={commit.isPending} onClick={() => commit.mutate()}>
              Confirm import
            </DistButton>
            {Number(validate.data.invalidRows) > 0 ? (
              <DistButton
                variant="secondary"
                onClick={() => {
                  const errors = (validate.data?.errors ?? []) as Array<{ row: number; message: string }>;
                  downloadTextFile(
                    "import-errors.csv",
                    ["Row,Issue", ...errors.map((e) => `${e.row},"${e.message.replace(/"/g, '""')}"`)].join("\n"),
                  );
                }}
              >
                Download error report
              </DistButton>
            ) : null}
          </div>
          {commit.isError ? <p className="mt-2 text-sm text-red-700">{(commit.error as Error).message}</p> : null}
          {commit.data ? (
            <p className="mt-2 text-sm text-emerald-800">
              Imported {String(commit.data.importedRows)} · Failed {String(commit.data.failedRows)} · Skipped{" "}
              {String(commit.data.skippedRows)}
            </p>
          ) : null}
        </DistPanel>
      ) : null}

      <DistPanel title="Import history">
        <DistDataTable
          columns={[
            { key: "module", header: "Module" },
            { key: "kind", header: "Kind" },
            { key: "fileName", header: "File" },
            { key: "status", header: "Status" },
            { key: "importedRows", header: "Imported" },
            { key: "failedRows", header: "Failed" },
            { key: "createdAt", header: "When" },
          ]}
          rows={(jobs.data?.items ?? []) as Array<Record<string, unknown>>}
          rowKey={(r) => String(r.id)}
          loading={jobs.isLoading}
          empty="No import or export jobs yet."
        />
      </DistPanel>
    </DistPageShell>
  );
}
