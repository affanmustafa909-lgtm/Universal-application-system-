import { Link } from "react-router-dom";
import { DistPageShell, DistPanel } from "../ui/DistUi";

const DIST = "/pops/distribution";

const LINKS = [
  { to: "/pops/auth", label: "Users & roles", hint: "Existing platform user admin — backend permissions still apply" },
  { to: `${DIST}/staff`, label: "Staff / employees", hint: "Field-force identity lives on employees" },
  { to: "/pops/multi-branch", label: "Branches", hint: "Company / branch network" },
  { to: `${DIST}/warehouses`, label: "Warehouses", hint: "Stock locations" },
  { to: "/pops/printer", label: "Printers", hint: "Shared print profiles — Dist documents use the same engine" },
  { to: "/pops/tax", label: "Tax authority", hint: "FBR / PRA settings" },
  { to: `${DIST}/import`, label: "Import / export jobs", hint: "Templates, validation, history" },
  { to: `${DIST}/audit`, label: "Audit log", hint: "Master and inventory mutations" },
  { to: `${DIST}/registers`, label: "Registers", hint: "Document registers → live lists" },
  { to: "/pops/notifications", label: "Notifications", hint: "Existing notification center" },
  { to: "/pops/security", label: "Security", hint: "Platform security settings" },
  { to: "/pops/settings", label: "Settings", hint: "Installer / org settings" },
];

export function DistributionAdminPage(): JSX.Element {
  return (
    <DistPageShell
      title="Administration"
      subtitle="Users, branches, printers, import jobs, and audit. Roles stay on the existing RBAC catalogue — the frontend does not grant access."
      breadcrumb={[{ label: "Distribution", to: `${DIST}/ps` }, { label: "Administration" }]}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="rounded-lg border border-slate-200 p-4 hover:border-cyan-500 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-slate-100">{l.label}</div>
            <p className="mt-1 text-xs text-slate-500">{l.hint}</p>
          </Link>
        ))}
      </div>
      <DistPanel title="Roles in this ERP" subtitle="Configurable on the user — not a second role engine">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>Admin / Manager — full Dist + finance keys</li>
          <li>Accountant — accounting + finance.view/post</li>
          <li>Sales / warehouse / recovery / delivery — existing Dist permission keys</li>
          <li>Viewer — pops.read only</li>
        </ul>
      </DistPanel>
    </DistPageShell>
  );
}
