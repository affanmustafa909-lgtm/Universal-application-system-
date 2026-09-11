const KEY = "platform-device-id-v1";

export function getOrCreateDeviceId(): string {
  if (typeof localStorage === "undefined") return crypto.randomUUID();
  const existing = localStorage.getItem(KEY);
  if (existing && existing.length >= 8) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}
