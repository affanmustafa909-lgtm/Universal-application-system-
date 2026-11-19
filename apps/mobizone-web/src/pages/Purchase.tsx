import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadBranch, loadSession } from "../lib/auth";
import { loadDb, pushLedgerToCloud, saveDb, type PurchaseRow } from "../lib/ledger";

export function PurchasePage(): React.JSX.Element {
  const navigate = useNavigate();
  const branch = loadBranch()!;
  const session = loadSession()!;
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [purchasePricePkr, setPurchasePricePkr] = useState("");
  const [paidPkr, setPaidPkr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const purchase = Number(purchasePricePkr) || 0;
      const paid = Number(paidPkr) || 0;
      if (!brand.trim() || !model.trim() || purchase <= 0) {
        throw new Error("Brand, model, and purchase price are required.");
      }
      const row: PurchaseRow = {
        id: crypto.randomUUID(),
        brand: brand.trim(),
        model: model.trim(),
        imei: imei.trim(),
        sellerName: sellerName.trim(),
        sellerPhone: sellerPhone.trim(),
        purchasePricePkr: purchase,
        paidPkr: paid,
        remainingPkr: Math.max(0, purchase - paid),
        createdAt: new Date().toISOString(),
      };
      const db = loadDb(branch.code);
      db.purchases = [row, ...db.purchases];
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
      <p className="brand">Purchase</p>
      <p className="tag">Buy phone · add stock on iPhone.</p>
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
          <label>Seller name</label>
          <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
        </div>
        <div className="field">
          <label>Seller phone</label>
          <input value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Purchase price (PKR)</label>
          <input
            inputMode="numeric"
            value={purchasePricePkr}
            onChange={(e) => setPurchasePricePkr(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Paid</label>
          <input inputMode="numeric" value={paidPkr} onChange={(e) => setPaidPkr(e.target.value)} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save purchase"}
        </button>
        <Link className="btn btn-ghost" to="/home">
          Back
        </Link>
      </form>
    </main>
  );
}
