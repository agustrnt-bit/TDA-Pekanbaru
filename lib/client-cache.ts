type CacheEntry = { value: unknown; expiresAt: number };

const memoryCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

export async function getCachedJson<T>(url: string, ttlMs = 60_000, force = false): Promise<T> {
  const cached = memoryCache.get(url);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value as T;

  const pending = pendingRequests.get(url);
  if (!force && pending) return pending as Promise<T>;

  const request = fetch(url, { cache: "no-store" }).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Data belum dapat dimuat.");
    memoryCache.set(url, { value: payload, expiresAt: Date.now() + ttlMs });
    return payload as T;
  }).finally(() => pendingRequests.delete(url));

  pendingRequests.set(url, request);
  return request;
}

export function prefetchJson(url: string, ttlMs = 60_000) {
  return getCachedJson(url, ttlMs).then(() => undefined).catch(() => undefined);
}

export function setCachedJson<T>(url: string, value: T, ttlMs = 60_000) {
  memoryCache.set(url, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateClientCache(...prefixes: string[]) {
  for (const key of memoryCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) memoryCache.delete(key);
  }
}
