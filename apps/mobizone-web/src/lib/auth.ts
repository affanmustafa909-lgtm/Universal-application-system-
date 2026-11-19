import { apiFetch } from "./api";
import { decodeAccessToken, type AccessTokenClaims } from "./jwt";

const ACCESS_KEY = "mz-web-access";
const REFRESH_KEY = "mz-web-refresh";
const EMAIL_KEY = "mz-web-email";
const BRANCH_KEY = "mz-web-branch";

export type Branch = { id: string; code: string; name: string };

export type Session = {
  accessToken: string;
  refreshToken: string;
  email: string;
  claims: AccessTokenClaims;
};

export function loadSession(): Session | null {
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  const email = localStorage.getItem(EMAIL_KEY) || "";
  if (!accessToken || !refreshToken) return null;
  try {
    return { accessToken, refreshToken, email, claims: decodeAccessToken(accessToken) };
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  localStorage.setItem(EMAIL_KEY, session.email);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function loadBranch(): Branch | null {
  try {
    const raw = localStorage.getItem(BRANCH_KEY);
    return raw ? (JSON.parse(raw) as Branch) : null;
  } catch {
    return null;
  }
}

export function saveBranch(branch: Branch): void {
  localStorage.setItem(BRANCH_KEY, JSON.stringify(branch));
}

export function clearBranch(): void {
  localStorage.removeItem(BRANCH_KEY);
}

export async function passwordLogin(email: string, password: string): Promise<Session> {
  const res = await apiFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("Invalid email or password.");
    throw new Error(`Login failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  const claims = decodeAccessToken(data.accessToken);
  const session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    email: email.trim(),
    claims,
  };
  saveSession(session);
  return session;
}

export async function fetchBranches(token: string): Promise<Branch[]> {
  const res = await apiFetch("/v1/operations/branches", {}, token);
  if (!res.ok) throw new Error(`Branches failed: ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data.map((b) => ({
    id: String(b.id ?? b.code ?? ""),
    code: String(b.code ?? ""),
    name: String(b.name ?? b.code ?? ""),
  }));
}
