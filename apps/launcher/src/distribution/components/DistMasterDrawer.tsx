import type { ReactNode } from "react";
import { DistButton } from "../ui/DistUi";

export function DistMasterDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = "max-w-md",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <aside
        className={`relative z-10 flex h-full w-full ${widthClass} flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <DistButton variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </DistButton>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

export function DistDrawerField({ label, value }: { label: string; value?: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0 dark:border-slate-800">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-800 dark:text-slate-200">{value ?? "—"}</dd>
    </div>
  );
}
