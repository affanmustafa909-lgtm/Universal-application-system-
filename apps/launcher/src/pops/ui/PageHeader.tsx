import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--ink)] dark:text-white">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)] dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
