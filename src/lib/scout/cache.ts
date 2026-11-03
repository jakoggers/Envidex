import type { MarketplaceId } from "./types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Short-lived in-memory cache. TTLs stay conservative and per-source.
 * Not a durable store — process-local only.
 */
const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS: Record<MarketplaceId | "default", number> = {
  ebay: 60_000,
  facebook: 30_000,
  offerup: 30_000,
  default: 45_000,
};

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(
  key: string,
  value: T,
  marketplace?: MarketplaceId,
  ttlMs?: number,
): void {
  const ttl =
    ttlMs ??
    (marketplace ? DEFAULT_TTL_MS[marketplace] : DEFAULT_TTL_MS.default);
  store.set(key, { value, expiresAt: Date.now() + ttl });
}

export function cacheKey(
  marketplace: MarketplaceId,
  payload: Record<string, unknown>,
): string {
  return `${marketplace}:${stableStringify(payload)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Test helper */
export function cacheClear(): void {
  store.clear();
}
