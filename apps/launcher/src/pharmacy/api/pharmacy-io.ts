import { authFetch } from "../../lib/authFetch";

const BASE = "/v1/pharmacy/io";

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = Array.isArray(err?.message) ? err.message.join("; ") : err?.message;
  throw new Error(message ?? `${fallback}: ${res.status}`);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) await parseError(res, "IO request failed");
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, "IO request failed");
  return res.json() as Promise<T>;
}

export const ioApi = {
  modules: () => getJson<Array<{ id: string; fields: Array<{ key: string; label: string; required: boolean; example: string; notes?: string }>; transactional?: boolean }>>(`${BASE}/modules`),
  template: (module: string) => getJson<{ filename: string; csv: string; fields: Array<{ key: string; label: string; required: boolean }> }>(`${BASE}/templates/${module}`),
  validate: (body: Record<string, unknown>) => postJson<Record<string, unknown>>(`${BASE}/validate`, body),
  commit: (body: Record<string, unknown>) => postJson<Record<string, unknown>>(`${BASE}/commit`, body),
  jobs: (page = 1) => getJson<{ items: Array<Record<string, unknown>>; total: number }>(`${BASE}/jobs?page=${page}`),
  job: (id: string) => getJson<Record<string, unknown>>(`${BASE}/jobs/${id}`),
  exportCsv: (body: Record<string, unknown>) => postJson<{ filename: string; csv: string; rows: number }>(`${BASE}/export`, body),
  audit: (page = 1) => getJson<{ items: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>(`${BASE}/audit?page=${page}`),
};

export function downloadTextFile(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
