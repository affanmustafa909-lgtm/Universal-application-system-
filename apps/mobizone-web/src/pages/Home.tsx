import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearBranch, clearSession, loadBranch, loadSession } from "../lib/auth";
import { formatPkr, loadDb, syncLedgerFromCloud, todayTotals, type WebDb } from "../lib/ledger";

export function HomePage(): React.JSX.Element {
  const navigate = useNavigate();
  const branch = loadBranch()!;
  const session = loadSession()!;
  const [db, setDb] = useState<WebDb>(() => loadDb(branch.code));

  useEffect(() => {
    void (async () => {
      const cloud = await syncLedgerFromCloud(branch.code, session.accessToken);
      if (cloud) setDb(cloud);
    })();
  }, [branch.code, session.accessToken]);

  const totals = todayTotals(db);

  function logout(): void {
    clearSession();
    clearBranch();
    navigate("/", { replace: true });
  }

  return (
    <main>
      <p className="brand">MobiZone</p>
      <p className="tag">
        {branch.name} · {branch.code}
      </p>

      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Today sales
        </p>
        <p className="stat" style={{ margin: "4px 0 0" }}>
          {formatPkr(totals.sales)}
        </p>
        <p className="muted">Buy {formatPkr(totals.purchases)} · Profit {formatPkr(totals.profit)}</p>
      </div>

      <div className="nav-row">
        <Link className="chip active" to="/sale">
          New sale
        </Link>
        <Link className="chip" to="/purchase">
          Purchase
        </Link>
        <Link className="chip" to="/receipt">
          Bill design
        </Link>
      </div>

      <div className="card">
        <p style={{ margin: 0, fontWeight: 800 }}>Recent sales</p>
        {db.sales.slice(0, 5).map((s) => (
          <div key={s.id} style={{ marginTop: 10 }}>
            <strong>
              {s.brand} {s.model}
            </strong>
            <div className="muted">
              {s.customerName || "Customer"} · {formatPkr(s.pricePkr)}
            </div>
          </div>
        ))}
        {db.sales.length === 0 ? <p className="muted">No sales yet on this device.</p> : null}
      </div>

      <button type="button" className="btn btn-ghost" onClick={logout}>
        Sign out
      </button>
    </main>
  );
}
