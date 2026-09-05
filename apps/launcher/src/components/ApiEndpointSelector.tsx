import { describeApiServer } from "../lib/apiBase";

type Props = {
  compact?: boolean;
};

export function ApiEndpointSelector({ compact = false }: Props): JSX.Element {
  const server = describeApiServer();
  const label = server.preset === "live" ? "Live API" : "Local API";

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">API server</div>
        <p className="mt-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100">{label}</p>
        <p className="mt-1 truncate text-[10px] text-slate-500" title={server.url}>
          {server.url}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-white">API server</div>
      <p className="text-xs text-slate-400">
        {label} · {server.dbLabel}
      </p>
      <p className="truncate font-mono text-[11px] text-slate-300" title={server.url}>
        {server.url}
      </p>
    </div>
  );
}
