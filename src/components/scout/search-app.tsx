"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListingCard } from "./listing-card";
import { SourceStatusPanel } from "./source-status-panel";
import {
  filtersToSearchParams,
  searchParamsToFilters,
} from "@/lib/scout/validation";
import type {
  MarketplaceId,
  SearchFilters,
  SearchResponse,
  SourceStatus,
} from "@/lib/scout/types";

const MARKETPLACE_OPTIONS: { id: MarketplaceId; label: string }[] = [
  { id: "ebay", label: "eBay" },
  { id: "facebook", label: "Facebook Marketplace" },
  { id: "offerup", label: "OfferUp" },
];

function emptyFilters(): SearchFilters {
  return {
    query: "",
    minPrice: null,
    maxPrice: null,
    currency: "USD",
    location: null,
    radiusMiles: null,
    condition: "any",
    marketplaces: ["ebay", "facebook", "offerup"],
    requiredTerms: [],
    excludedTerms: [],
    sort: "relevance",
    demoMode: false,
  };
}

export function SearchApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SearchFilters>(() => {
    try {
      return searchParamsToFilters(searchParams);
    } catch {
      return emptyFilters();
    }
  });
  const [requiredText, setRequiredText] = useState(
    () => filters.requiredTerms.join(", "),
  );
  const [excludedText, setExcludedText] = useState(
    () => filters.excludedTerms.join(", "),
  );
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursors, setCursors] = useState<
    Partial<Record<MarketplaceId, string | null>>
  >({});
  const [isPending, startTransition] = useTransition();

  const syncUrl = useCallback(
    (next: SearchFilters) => {
      const params = filtersToSearchParams(next);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router],
  );

  const runSearch = useCallback(
    async (
      nextFilters: SearchFilters,
      nextCursors?: Partial<Record<MarketplaceId, string | null>>,
      append = false,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = filtersToSearchParams(nextFilters);
        if (nextCursors) {
          for (const [id, cursor] of Object.entries(nextCursors)) {
            if (cursor) params.set(`cursor_${id}`, cursor);
          }
        }
        const res = await fetch(`/api/search?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Search failed (${res.status})`);
        }
        const payload = data as SearchResponse;
        setResponse((prev) => {
          if (!append || !prev) return payload;
          const seen = new Set(
            prev.listings.map((l) => `${l.marketplace}:${l.sourceListingId}`),
          );
          const merged = [
            ...prev.listings,
            ...payload.listings.filter(
              (l) => !seen.has(`${l.marketplace}:${l.sourceListingId}`),
            ),
          ];
          return {
            ...payload,
            listings: merged,
            sources: mergeSources(prev.sources, payload.sources),
          };
        });
        setCursors(payload.nextCursors);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        if (!append) setResponse(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Auto-search when URL already has a query (bookmarkable searches).
  useEffect(() => {
    const q = searchParams.get("q") || searchParams.get("query");
    if (!q) return;
    try {
      const parsed = searchParamsToFilters(searchParams);
      setFilters(parsed);
      setRequiredText(parsed.requiredTerms.join(", "));
      setExcludedText(parsed.excludedTerms.join(", "));
      void runSearch(parsed);
    } catch {
      // ignore invalid URL on first paint
    }
    // intentionally once on mount for shared/bookmarked URLs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: SearchFilters = {
      ...filters,
      requiredTerms: splitTerms(requiredText),
      excludedTerms: splitTerms(excludedText),
      demoMode: Boolean(filters.demoMode),
    };
    setFilters(next);
    setCursors({});
    setResponse(null);
    syncUrl(next);
    void runSearch(next);
  };

  const hasMore = useMemo(
    () => Object.values(cursors).some((c) => Boolean(c)),
    [cursors],
  );

  const partial =
    response &&
    response.sources.some((s) =>
      ["success", "partial"].includes(s.status),
    ) &&
    response.sources.some((s) =>
      ["error", "timeout", "rate_limited", "unavailable", "not_configured"].includes(
        s.status,
      ),
    );

  return (
    <div className="space-y-10">
      <section className="animate-scout-rise max-w-3xl">
        <p className="mb-3 font-[family-name:var(--font-fraunces)] text-4xl font-semibold leading-[1.05] tracking-tight text-primary sm:text-5xl md:text-6xl">
          Secondhand Scout
        </p>
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl text-foreground sm:text-2xl">
          One search across secondhand markets.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Enter an item, set your filters, and compare live eBay results with
          honest Facebook Marketplace and OfferUp fallbacks.
        </p>
      </section>

      <form
        onSubmit={onSubmit}
        className="animate-scout-rise space-y-5 border-t border-border/70 pt-6"
        style={{ animationDelay: "80ms" }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Item keywords
            </span>
            <input
              required
              value={filters.query}
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value }))
              }
              placeholder="Sony WH-1000XM4"
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none ring-ring focus:ring-2"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Min price
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={filters.minPrice ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minPrice: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Max price
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={filters.maxPrice ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  maxPrice: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Currency
            </span>
            <input
              value={filters.currency}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  currency: e.target.value.toUpperCase().slice(0, 3),
                }))
              }
              maxLength={3}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 uppercase outline-none ring-ring focus:ring-2"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              ZIP / location
            </span>
            <input
              value={filters.location ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  location: e.target.value || null,
                }))
              }
              placeholder="94107"
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Radius (miles)
            </span>
            <input
              type="number"
              min={1}
              max={500}
              value={filters.radiusMiles ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  radiusMiles:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Condition
            </span>
            <select
              value={filters.condition}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  condition: e.target.value as SearchFilters["condition"],
                }))
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            >
              <option value="any">Any</option>
              <option value="used">Used</option>
              <option value="refurbished">Refurbished</option>
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Sort
            </span>
            <select
              value={filters.sort}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sort: e.target.value as SearchFilters["sort"],
                }))
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            >
              <option value="relevance">Relevance</option>
              <option value="lowest_total">Lowest known total</option>
              <option value="newest">Newest</option>
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Required terms (comma-separated)
            </span>
            <input
              value={requiredText}
              onChange={(e) => setRequiredText(e.target.value)}
              placeholder="XM4"
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Excluded terms (comma-separated)
            </span>
            <input
              value={excludedText}
              onChange={(e) => setExcludedText(e.target.value)}
              placeholder="case, earpads, parts"
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Marketplaces
          </legend>
          <div className="flex flex-wrap gap-4">
            {MARKETPLACE_OPTIONS.map((option) => {
              const checked = filters.marketplaces.includes(option.id);
              return (
                <label key={option.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setFilters((f) => {
                        const set = new Set(f.marketplaces);
                        if (set.has(option.id)) set.delete(option.id);
                        else set.add(option.id);
                        const marketplaces = Array.from(set) as MarketplaceId[];
                        return {
                          ...f,
                          marketplaces:
                            marketplaces.length > 0
                              ? marketplaces
                              : (["ebay"] as MarketplaceId[]),
                        };
                      });
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.demoMode}
            onChange={(e) =>
              setFilters((f) => ({ ...f, demoMode: e.target.checked }))
            }
          />
          Demo mode (explicit fixtures, clearly labeled — never used as a silent fallback)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || !filters.query.trim()}
            className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
          {isPending ? (
            <span className="text-xs text-muted-foreground">Updating URL…</span>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          <div className="h-1 w-full overflow-hidden rounded bg-secondary">
            <div className="animate-scout-pulse-bar h-full w-full bg-accent" />
          </div>
          <p className="text-sm text-muted-foreground">
            Querying selected marketplaces concurrently…
          </p>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-scout-shimmer h-24 rounded-lg" />
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-l-2 border-destructive pl-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {response ? (
        <div className="space-y-8">
          {partial ? (
            <p className="text-sm text-accent-foreground">
              Partial results — at least one source succeeded while another did
              not. Successful listings are shown below.
            </p>
          ) : null}

          <SourceStatusPanel sources={response.sources} />

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
              <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold">
                Results
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({response.listings.length})
                </span>
              </h2>
              <p className="max-w-xl text-xs text-muted-foreground">
                {response.sortScope}
              </p>
            </div>

            {response.listings.length === 0 ? (
              <div className="py-10 text-muted-foreground">
                <p className="font-medium text-foreground">No listings matched.</p>
                <p className="mt-2 text-sm">
                  Try widening price bounds, clearing required/excluded terms, or
                  opening a marketplace fallback link above.
                </p>
              </div>
            ) : (
              <div>
                {response.listings.map((listing) => (
                  <ListingCard
                    key={`${listing.marketplace}-${listing.sourceListingId}-${listing.dataOrigin}`}
                    listing={listing}
                  />
                ))}
              </div>
            )}

            {hasMore ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void runSearch(filters, cursors, true)}
                className="mt-4 inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Load more from sources with additional pages
              </button>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function splitTerms(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function mergeSources(
  previous: SourceStatus[],
  next: SourceStatus[],
): SourceStatus[] {
  const map = new Map(previous.map((s) => [s.marketplace, s]));
  for (const source of next) {
    const existing = map.get(source.marketplace);
    if (!existing) {
      map.set(source.marketplace, source);
      continue;
    }
    map.set(source.marketplace, {
      ...source,
      resultCount: existing.resultCount + source.resultCount,
    });
  }
  return Array.from(map.values());
}
