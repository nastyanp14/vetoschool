type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const values = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

export const QUERY_LIMITS = {
  smallList: 200,
  userList: 500,
  adminList: 500,
  liveEvents: 80,
} as const;

export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options: { force?: boolean } = {},
): Promise<T> {
  const now = Date.now();
  const cached = values.get(key);
  if (!options.force && cached && cached.expiresAt > now) return cached.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const requestGeneration = cacheGeneration;
  const request = load()
    .then(value => {
      if (requestGeneration === cacheGeneration) {
        values.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

export function invalidateQueryCache(prefix: string) {
  for (const key of values.keys()) {
    if (key.startsWith(prefix)) values.delete(key);
  }
}

export function clearQueryCache() {
  cacheGeneration += 1;
  values.clear();
  inFlight.clear();
}
