import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearBranch,
  clearSession,
  fetchBranches,
  loadBranch,
  loadSession,
  saveBranch,
  type Branch,
} from "../lib/auth";

export function BranchPage(): React.JSX.Element {
  const navigate = useNavigate();
  const session = loadSession()!;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = loadBranch();
    if (existing) {
      navigate("/home", { replace: true });
      return;
    }
    void (async () => {
      try {
        const list = await fetchBranches(session.accessToken);
        const scope = session.claims.branchScope?.trim() ?? "";
        const scoped =
          scope && scope.toLowerCase() !== "all"
            ? list.filter((b) => b.code.toUpperCase() === scope.toUpperCase())
            : list;
        setBranches(scoped);
        if (scoped.length === 1) {
          saveBranch(scoped[0]!);
          navigate("/home", { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load branches");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, session.accessToken, session.claims.branchScope]);

  function logout(): void {
    clearSession();
    clearBranch();
    navigate("/", { replace: true });
  }

  return (
    <main>
      <p className="brand">Select branch</p>
      <p className="tag">Same shop branches as desktop EXE / Android APK.</p>
      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {branches.map((b) => (
        <button
          key={b.code}
          type="button"
          className="list-btn"
          onClick={() => {
            saveBranch(b);
            navigate("/home", { replace: true });
          }}
        >
          <strong>{b.name}</strong>
          <div className="muted">{b.code}</div>
        </button>
      ))}
      <button type="button" className="btn btn-ghost" onClick={logout}>
        Sign out
      </button>
    </main>
  );
}
