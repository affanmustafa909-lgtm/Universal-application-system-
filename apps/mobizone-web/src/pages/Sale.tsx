import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadBranch, loadSession } from "../lib/auth";
import { loadDb, pushLedgerToCloud, saveDb, type SaleRow } from "../lib/ledger";

export function SalePage(): React.JSX.Element {
  const navigate = useNavigate();
  const branch = loadBranch()!;
  const session = loadSession()!;
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pricePkr, setPricePkr] = useState("");
  const [cashPkr, setCashPkr] = useState("");
  const [bankPkr, setBankPkr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const price = Number(pricePkr) || 0;
      const cash = Number(cashPkr) || 0;
      const bank = Number(bankPkr) || 0;
      if (!brand.trim() || !model.trim() || price <= 0) {
        throw new Error("Brand, model, and price are required.");
      }
      const remaining = Math.max(0, price - cash - bank);
      const row: SaleRow = {
        id: crypto.randomUUID(),
        brand: brand.trim(),
        model: model.trim(),
        imei: imei.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        pricePkr: price,
        cashPkr: cash,
        bankPkr: bank,
        remainingPkr: remaining,
        createdAt: new Date().toISOString(),
      };
      const db = loadDb(branch.code);
      db.sales = [row, ...db.sales];
      saveDb(branch.code, db);
      void pushLedgerToCloud(branch.code, session.accessToken, db);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <p className="brand">New sale</p>
      <p className="tag">Quick phone sale entry for iPhone Safari.</p>
      <form className="card" onSubmit={onSubmit}>
        <div className="field">
          <label>Brand</label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} required />
        </div>
        <div className="field">
          <label>Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} required />
        </div>
        <div className="field">
          <label>IMEI</label>
          <input value={imei} onChange={(e) => setImei(e.target.value)} />
        </div>
        <div className="field">
          <label>Customer name</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="field">
          <label>Customer phone</label>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Sale price (PKR)</label>
          <input inputMode="numeric" value={pricePkr} onChange={(e) => setPricePkr(e.target.value)} required />
        </div>
        <div className="field">
          <label>Cash</label>
          <input inputMode="numeric" value={cashPkr} onChange={(e) => setCashPkr(e.target.value)} />
        </div>
        <div className="field">
          <label>Bank</label>
          <input inputMode="numeric" value={bankPkr} onChange={(e) => setBankPkr(e.target.value)} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save sale"}
        </button>
        <Link className="btn btn-ghost" to="/home">
          Back
        </Link>
      </form>
    </main>
  );
}
