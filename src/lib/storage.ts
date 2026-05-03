// Cloud-only "storage": in-memory cache + pub/sub.
// All persistence happens in Supabase. localStorage is NOT used for app data.

type Listener = () => void;
const listeners = new Set<Listener>();
const cache = new Map<string, unknown>();

export function cacheGet<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}
export function cacheSet<T>(key: string, value: T) {
  cache.set(key, value);
  listeners.forEach(l => l());
}
export function cacheClear() {
  cache.clear();
  listeners.forEach(l => l());
}
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Helpers for generating data URLs from files (used to preview images locally before upload)
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
