import { Navigate, Route, Routes } from "react-router-dom";
import { loadBranch, loadSession } from "./lib/auth";
import { BranchPage } from "./pages/Branch";
import { HomePage } from "./pages/Home";
import { LoginPage } from "./pages/Login";
import { PurchasePage } from "./pages/Purchase";
import { ReceiptSettingsPage } from "./pages/ReceiptSettings";
import { SalePage } from "./pages/Sale";

function RequireAuth({ children }: { children: React.ReactNode }): React.ReactNode {
  const session = loadSession();
  if (!session) return <Navigate to="/" replace />;
  const system = (session.claims.systemType ?? "").toLowerCase();
  if (system && system !== "mobizone") {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireBranch({ children }: { children: React.ReactNode }): React.ReactNode {
  if (!loadBranch()) return <Navigate to="/branch" replace />;
  return children;
}

export function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/branch"
          element={
            <RequireAuth>
              <BranchPage />
            </RequireAuth>
          }
        />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <RequireBranch>
                <HomePage />
              </RequireBranch>
            </RequireAuth>
          }
        />
        <Route
          path="/sale"
          element={
            <RequireAuth>
              <RequireBranch>
                <SalePage />
              </RequireBranch>
            </RequireAuth>
          }
        />
        <Route
          path="/purchase"
          element={
            <RequireAuth>
              <RequireBranch>
                <PurchasePage />
              </RequireBranch>
            </RequireAuth>
          }
        />
        <Route
          path="/receipt"
          element={
            <RequireAuth>
              <RequireBranch>
                <ReceiptSettingsPage />
              </RequireBranch>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
