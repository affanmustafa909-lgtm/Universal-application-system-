import { eq } from "drizzle-orm";
import { offlineIdentities } from "@platform/database-sqlite";
import type { AccessTokenClaims } from "./jwt";
import { getOrCreateDeviceId } from "./deviceId";
import { getRuntimeDb, persistRuntimeDb } from "./runtimeDb";

const PBKDF2_ITERATIONS = 120_000;
/** Offline login stays valid for 30 days after last successful online sign-in. */
const OFFLINE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function derivePasswordVerifier(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export type OfflineIdentity = {
  email: string;
  organizationId: string;
  userId: string;
  deviceId: string;
  claims: AccessTokenClaims;
  lastAccessToken: string | null;
  lastRefreshToken: string | null;
  lastOnlineAt: string;
  offlineExpiresAt: string;
  status: string;
};

export async function rememberOfflineIdentity(input: {
  email: string;
  password: string;
  claims: AccessTokenClaims;
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.claims.organizationId || !input.claims.sub) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordVerifier(input.password, salt);
  const now = new Date();
  const deviceId = getOrCreateDeviceId();
  const { db } = await getRuntimeDb();
  await db
    .insert(offlineIdentities)
    .values({
      email,
      organizationId: input.claims.organizationId,
      userId: input.claims.sub,
      deviceId,
      verifierSaltHex: toHex(salt),
      verifierHashHex: hash,
      claimsJson: JSON.stringify(input.claims),
      lastAccessToken: input.accessToken,
      lastRefreshToken: input.refreshToken,
      lastOnlineAt: now.toISOString(),
      offlineExpiresAt: new Date(now.getTime() + OFFLINE_TTL_MS).toISOString(),
      status: "active",
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: offlineIdentities.email,
      set: {
        organizationId: input.claims.organizationId,
        userId: input.claims.sub,
        deviceId,
        verifierSaltHex: toHex(salt),
        verifierHashHex: hash,
        claimsJson: JSON.stringify(input.claims),
        lastAccessToken: input.accessToken,
        lastRefreshToken: input.refreshToken,
        lastOnlineAt: now.toISOString(),
        offlineExpiresAt: new Date(now.getTime() + OFFLINE_TTL_MS).toISOString(),
        status: "active",
        updatedAt: now.toISOString(),
      },
    });
  await persistRuntimeDb();
}

export async function loadOfflineIdentity(email: string): Promise<OfflineIdentity | null> {
  try {
    const { db } = await getRuntimeDb();
    const [row] = await db
      .select()
      .from(offlineIdentities)
      .where(eq(offlineIdentities.email, email.trim().toLowerCase()))
      .limit(1);
    if (!row) return null;
    return {
      email: row.email,
      organizationId: row.organizationId,
      userId: row.userId,
      deviceId: row.deviceId,
      claims: JSON.parse(row.claimsJson) as AccessTokenClaims,
      lastAccessToken: row.lastAccessToken,
      lastRefreshToken: row.lastRefreshToken,
      lastOnlineAt: row.lastOnlineAt,
      offlineExpiresAt: row.offlineExpiresAt,
      status: row.status,
    };
  } catch {
    return null;
  }
}

export async function verifyOfflinePassword(email: string, password: string): Promise<
  | { ok: true; identity: OfflineIdentity }
  | { ok: false; reason: "never" | "expired" | "mismatch" | "revoked" | "device" }
> {
  const { db } = await getRuntimeDb();
  const [row] = await db
    .select()
    .from(offlineIdentities)
    .where(eq(offlineIdentities.email, email.trim().toLowerCase()))
    .limit(1);
  if (!row) return { ok: false, reason: "never" };
  if (row.status !== "active") return { ok: false, reason: "revoked" };
  if (Date.parse(row.offlineExpiresAt) <= Date.now()) return { ok: false, reason: "expired" };

  const hash = await derivePasswordVerifier(password, fromHex(row.verifierSaltHex));
  if (hash !== row.verifierHashHex) return { ok: false, reason: "mismatch" };

  const currentDeviceId = getOrCreateDeviceId();
  // Password matched — rebind to this device if localStorage device id was reset.
  if (row.deviceId !== currentDeviceId) {
    const now = new Date().toISOString();
    await db
      .update(offlineIdentities)
      .set({ deviceId: currentDeviceId, updatedAt: now })
      .where(eq(offlineIdentities.email, row.email));
    await persistRuntimeDb();
  }

  return {
    ok: true,
    identity: {
      email: row.email,
      organizationId: row.organizationId,
      userId: row.userId,
      deviceId: currentDeviceId,
      claims: JSON.parse(row.claimsJson) as AccessTokenClaims,
      lastAccessToken: row.lastAccessToken,
      lastRefreshToken: row.lastRefreshToken,
      lastOnlineAt: row.lastOnlineAt,
      offlineExpiresAt: row.offlineExpiresAt,
      status: row.status,
    },
  };
}

export function offlineLoginMessage(reason: "never" | "expired" | "mismatch" | "revoked" | "device"): string {
  if (reason === "never") {
    return "Is device pe pehle online login zaroori hai — ek baar internet se sign in karein taake offline profile save ho.";
  }
  if (reason === "expired") {
    return "Offline authorization expire ho gayi (30 days). Internet connect karke dubara sign in karein.";
  }
  if (reason === "revoked") return "This device is no longer authorized. Sign in online.";
  if (reason === "device") return "This login belongs to a different device profile.";
  return "Email or password offline profile se match nahi hota.";
}

/** True when this email already has a usable offline profile on this device. */
export async function hasOfflineIdentity(email: string): Promise<boolean> {
  const id = await loadOfflineIdentity(email);
  if (!id || id.status !== "active") return false;
  if (Date.parse(id.offlineExpiresAt) <= Date.now()) return false;
  return Boolean(id.lastAccessToken && id.lastRefreshToken);
}
