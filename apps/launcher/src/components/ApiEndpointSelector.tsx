import { LOCAL_API_URL } from "../lib/apiBase";

type Props = {
  compact?: boolean;
};

export function ApiEndpointSelector({ compact = false }: Props): JSX.Element {
  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">API server</div>
        <p className="mt-2 truncate text-[10px] text-slate-500" title={LOCAL_API_URL}>
          Local: {LOCAL_API_URL}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-white">API server</div>
      <p className="text-xs text-slate-400">
        This app talks only to the local API and local Postgres at{" "}
        <span className="font-mono text-slate-300">{LOCAL_API_URL}</span>.
      </p>
    </div>
  );
}
