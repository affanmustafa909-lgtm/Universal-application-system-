import * as SecureStore from "expo-secure-store";

/** Android SecureStore rejects values over ~2048 bytes — chunk large JWTs. */
const CHUNK_SIZE = 1800;
/** Some OEMs hang forever on SecureStore — never block app boot. */
const STORE_TIMEOUT_MS = 1500;

const memory = new Map<string, string>();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[secureStorage] timeout ${ms}ms: ${label}`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function storeGet(key: string): Promise<string | null> {
  return withTimeout(SecureStore.getItemAsync(key), STORE_TIMEOUT_MS, `get:${key}`);
}

async function storeSet(key: string, value: string): Promise<void> {
  await withTimeout(SecureStore.setItemAsync(key, value), STORE_TIMEOUT_MS, `set:${key}`);
}

async function storeDelete(key: string): Promise<void> {
  await withTimeout(SecureStore.deleteItemAsync(key), STORE_TIMEOUT_MS, `del:${key}`).catch(
    () => undefined,
  );
}

async function deleteChunked(key: string): Promise<void> {
  const meta = await storeGet(`${key}__chunks`).catch(() => null);
  const chunks = meta ? Number(meta) : 0;
  if (Number.isFinite(chunks) && chunks > 0) {
    await Promise.all(
      Array.from({ length: chunks }, (_, i) => storeDelete(`${key}__${i}`)),
    );
  }
  await storeDelete(`${key}__chunks`);
  await storeDelete(key);
  memory.delete(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    if (value.length <= CHUNK_SIZE) {
      await deleteChunked(key);
      memory.set(key, value);
      await storeSet(key, value);
      return;
    }
    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    await storeSet(`${key}__chunks`, String(chunkCount));
    for (let i = 0; i < chunkCount; i += 1) {
      const part = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await storeSet(`${key}__${i}`, part);
    }
    await storeDelete(key);
  } catch (err) {
    console.warn(`[secureStorage] set failed for ${key}:`, err);
  }
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    const meta = await storeGet(`${key}__chunks`);
    const chunks = meta ? Number(meta) : 0;
    if (Number.isFinite(chunks) && chunks > 0) {
      const parts: string[] = [];
      for (let i = 0; i < chunks; i += 1) {
        const part = await storeGet(`${key}__${i}`);
        if (part == null) {
          return memory.get(key) ?? null;
        }
        parts.push(part);
      }
      const joined = parts.join("");
      memory.set(key, joined);
      return joined;
    }
    const value = await storeGet(key);
    if (value != null) {
      memory.set(key, value);
      return value;
    }
  } catch (err) {
    console.warn(`[secureStorage] get failed for ${key}:`, err);
  }
  return memory.get(key) ?? null;
}

export async function secureDelete(key: string): Promise<void> {
  memory.delete(key);
  try {
    await deleteChunked(key);
  } catch (err) {
    console.warn(`[secureStorage] delete failed for ${key}:`, err);
  }
}
