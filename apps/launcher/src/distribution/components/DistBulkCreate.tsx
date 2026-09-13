import { useState } from "react";
import { DistButton, DistInput, DistPanel } from "../ui/DistUi";

export type BulkMedicineDraft = {
  key: string;
  sku: string;
  name: string;
  purchasePrice: string;
  wholesalePrice: string;
  sellingPrice: string;
};

export type BulkCustomerDraft = {
  key: string;
  code: string;
  name: string;
  phone: string;
  creditLimitPkr: string;
};

function newKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyMedicineDraft(): BulkMedicineDraft {
  return {
    key: newKey(),
    sku: "",
    name: "",
    purchasePrice: "",
    wholesalePrice: "",
    sellingPrice: "",
  };
}

export function emptyCustomerDraft(): BulkCustomerDraft {
  return {
    key: newKey(),
    code: "",
    name: "",
    phone: "",
    creditLimitPkr: "0",
  };
}

/** Multi-row create for medicines (in addition to CSV import). */
export function DistBulkMedicineCreate({
  busy,
  onSave,
  onClose,
}: {
  busy?: boolean;
  onSave: (rows: BulkMedicineDraft[]) => Promise<void> | void;
  onClose: () => void;
}): JSX.Element {
  const [rows, setRows] = useState<BulkMedicineDraft[]>([
    emptyMedicineDraft(),
    emptyMedicineDraft(),
    emptyMedicineDraft(),
  ]);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<BulkMedicineDraft>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <DistPanel
      title="Add multiple medicines"
      action={
        <DistButton variant="ghost" onClick={onClose}>
          Close
        </DistButton>
      }
    >
      <p className="mb-2 text-xs text-slate-500">
        Fill several rows and save once. Empty rows are skipped. For hundreds of SKUs use Import / template.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="p-1">SKU *</th>
              <th className="p-1">Name *</th>
              <th className="p-1">Purchase</th>
              <th className="p-1">Wholesale</th>
              <th className="p-1">Sale</th>
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="p-1">
                  <DistInput value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} />
                </td>
                <td className="p-1">
                  <DistInput value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
                </td>
                <td className="p-1">
                  <DistInput
                    value={r.purchasePrice}
                    onChange={(e) => update(r.key, { purchasePrice: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <DistInput
                    value={r.wholesalePrice}
                    onChange={(e) => update(r.key, { wholesalePrice: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <DistInput
                    value={r.sellingPrice}
                    onChange={(e) => update(r.key, { sellingPrice: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <button
                    type="button"
                    className="text-rose-600"
                    onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <DistButton variant="secondary" onClick={() => setRows((prev) => [...prev, emptyMedicineDraft()])}>
          + Row
        </DistButton>
        <DistButton
          disabled={busy}
          onClick={() => {
            const ready = rows.filter((r) => r.sku.trim() && r.name.trim());
            if (!ready.length) {
              setError("Add at least one row with SKU and Name.");
              return;
            }
            setError(null);
            void Promise.resolve(onSave(ready)).catch((e) =>
              setError(e instanceof Error ? e.message : "Save failed"),
            );
          }}
        >
          Save {rows.filter((r) => r.sku.trim() && r.name.trim()).length || ""} medicines
        </DistButton>
      </div>
    </DistPanel>
  );
}

/** Multi-row create for trade customers (in addition to CSV import). */
export function DistBulkCustomerCreate({
  busy,
  onSave,
  onClose,
}: {
  busy?: boolean;
  onSave: (rows: BulkCustomerDraft[]) => Promise<void> | void;
  onClose: () => void;
}): JSX.Element {
  const [rows, setRows] = useState<BulkCustomerDraft[]>([
    emptyCustomerDraft(),
    emptyCustomerDraft(),
    emptyCustomerDraft(),
  ]);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<BulkCustomerDraft>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <DistPanel
      title="Add multiple customers"
      action={
        <DistButton variant="ghost" onClick={onClose}>
          Close
        </DistButton>
      }
    >
      <p className="mb-2 text-xs text-slate-500">
        Create several trade customers at once. For large lists use Masters → Import.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="p-1">Code *</th>
              <th className="p-1">Name *</th>
              <th className="p-1">Phone</th>
              <th className="p-1">Credit limit</th>
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="p-1">
                  <DistInput value={r.code} onChange={(e) => update(r.key, { code: e.target.value })} />
                </td>
                <td className="p-1">
                  <DistInput value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
                </td>
                <td className="p-1">
                  <DistInput value={r.phone} onChange={(e) => update(r.key, { phone: e.target.value })} />
                </td>
                <td className="p-1">
                  <DistInput
                    value={r.creditLimitPkr}
                    onChange={(e) => update(r.key, { creditLimitPkr: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <button
                    type="button"
                    className="text-rose-600"
                    onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <DistButton variant="secondary" onClick={() => setRows((prev) => [...prev, emptyCustomerDraft()])}>
          + Row
        </DistButton>
        <DistButton
          disabled={busy}
          onClick={() => {
            const ready = rows.filter((r) => r.code.trim() && r.name.trim());
            if (!ready.length) {
              setError("Add at least one row with Code and Name.");
              return;
            }
            setError(null);
            void Promise.resolve(onSave(ready)).catch((e) =>
              setError(e instanceof Error ? e.message : "Save failed"),
            );
          }}
        >
          Save {rows.filter((r) => r.code.trim() && r.name.trim()).length || ""} customers
        </DistButton>
      </div>
    </DistPanel>
  );
}
