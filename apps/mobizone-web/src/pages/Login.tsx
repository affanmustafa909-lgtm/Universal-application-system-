import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { clearBranch, clearSession, loadSession, passwordLogin } from "../lib/auth";

export function LoginPage(): React.JSX.Element {
  const navigate = useNavigate();
  const existing = loadSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (existing) {
    const system = (existing.claims.systemType ?? "").toLowerCase();
    if (!system || system === "mobizone") {
      return <Navigate to="/branch" replace />;
    }
    clearSession();
    clearBranch();
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await passwordLogin(email, password);
      const system = (session.claims.systemType ?? "").toLowerCase();
      if (system && system !== "mobizone") {
        clearSession();
        throw new Error("MobiZone accounts only — other ERP users are blocked.");
      }
      navigate("/branch", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <p className="brand">MobiZone</p>
      <p className="tag">iPhone / Safari web app — same Railway users as Android & EXE.</p>
      <form className="card" onSubmit={onSubmit}>
        <p style={{ margin: 0, fontWeight: 800 }}>Sign in</p>
        <p className="muted">Email & password — fields stay empty (no admin autofill).</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
