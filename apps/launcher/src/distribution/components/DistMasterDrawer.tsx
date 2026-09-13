import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DistButton } from "../ui/DistUi";

/** Above HistoryNavBar / ConnectivityBanner (z-100). */
const DRAWER_Z = "z-[110]";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`dist-drawer-root fixed inset-0 ${DRAWER_Z} flex items-stretch justify-end bg-transparent`}
    >
      {/* div (not button) — native <button> paints opaque white over the page */}
      <div
        role="presentation"
        aria-hidden
        className="dist-drawer-backdrop absolute inset-0"
        onClick={onClose}
      />
      <aside
        className={`dist-drawer-panel relative z-10 ml-auto flex h-full w-full ${widthClass} flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="min-w-0 pr-2">
            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
            Cancel
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-3 dark:bg-slate-950">{children}</div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <DistButton variant="secondary" onClick={onClose}>
            Cancel
          </DistButton>
          {footer}
        </footer>
      </aside>
    </div>,
    document.body,
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
