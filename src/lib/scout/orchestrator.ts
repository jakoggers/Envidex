import { dedupeListings, passesClientFilters } from "./listing";
import { log } from "./logger";
import { applyRelevance } from "./relevance";
import { attachSortMetadata } from "./ranking";
import { demoSearch } from "./providers/demo";
import { getProvider } from "./providers";
import type {
  Listing,
  MarketplaceId,
  SearchFilters,
  SearchResponse,
  SourceStatus,
} from "./types";
import type { ProviderSearchResult } from "./providers/types";

const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 12_000);
const MAX_CONCURRENCY = 3;

export async function runSearch(
  filters: SearchFilters,
  options?: {
    cursors?: Partial<Record<MarketplaceId, string | null>>;
  },
): Promise<SearchResponse> {
  if (filters.demoMode) {
    const demo = demoSearch(filters);
    const listings = postProcess(demo.listings, filters);
    const { listings: sorted, sortScope } = attachSortMetadata(listings, filters);
    return {
      listings: sorted,
      sources: [
        {
          marketplace: "ebay",
          status: "success",
          message: demo.message,
          appliedFilters: demo.appliedFilters,
          fallbackSearchUrl: null,
          warning: demo.warning,
          resultCount: sorted.filter((l) => l.marketplace === "ebay").length,
          latencyMs: 0,
        },
        {
          marketplace: "facebook",
          status: "success",
          message: "Demo fixtures include Facebook-labeled rows",
          appliedFilters: demo.appliedFilters,
          fallbackSearchUrl: getProvider("facebook").buildFallbackSearchUrl(filters),
          warning: demo.warning,
          resultCount: sorted.filter((l) => l.marketplace === "facebook").length,
          latencyMs: 0,
        },
        {
          marketplace: "offerup",
          status: "success",
          message: "Demo fixtures include OfferUp-labeled rows",
          appliedFilters: demo.appliedFilters,
          fallbackSearchUrl: getProvider("offerup").buildFallbackSearchUrl(filters),
          warning: demo.warning,
          resultCount: sorted.filter((l) => l.marketplace === "offerup").length,
          latencyMs: 0,
        },
      ],
      nextCursors: {},
      sortScope,
      cached: false,
      query: filters,
    };
  }

  const selected = filters.marketplaces;
  const results = await mapPool(selected, MAX_CONCURRENCY, async (id) => {
    return searchOne(id, filters, options?.cursors?.[id] ?? null);
  });

  const listings: Listing[] = [];
  const sources: SourceStatus[] = [];
  const nextCursors: Partial<Record<MarketplaceId, string | null>> = {};

  for (const { id, result } of results) {
    listings.push(...result.listings);
    nextCursors[id] = result.nextCursor;
    sources.push({
      marketplace: id,
      status: result.status,
      message: result.message,
      appliedFilters: result.appliedFilters,
      fallbackSearchUrl: result.fallbackSearchUrl,
      warning: result.warning,
      resultCount: result.listings.length,
      latencyMs: result.latencyMs,
    });
  }

  // Include skipped marketplaces for UI clarity
  for (const id of ["ebay", "facebook", "offerup"] as MarketplaceId[]) {
    if (!selected.includes(id) && !sources.some((s) => s.marketplace === id)) {
      sources.push({
        marketplace: id,
        status: "skipped",
        message: "Not selected for this search",
        appliedFilters: [],
        fallbackSearchUrl: getProvider(id).buildFallbackSearchUrl(filters),
        warning: null,
        resultCount: 0,
        latencyMs: null,
      });
    }
  }

  const processed = postProcess(listings, filters);
  const { listings: sorted, sortScope } = attachSortMetadata(processed, filters);

  return {
    listings: sorted,
    sources,
    nextCursors,
    sortScope,
    cached: false,
    query: filters,
  };
}

async function searchOne(
  id: MarketplaceId,
  filters: SearchFilters,
  cursor: string | null,
): Promise<{ id: MarketplaceId; result: ProviderSearchResult }> {
  const provider = getProvider(id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const result = await provider.search(filters, {
      cursor,
      signal: controller.signal,
    });
    return { id, result };
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") ||
      controller.signal.aborted;
    log("warn", "provider.search_exception", {
      provider: id,
      message: error instanceof Error ? error.message.slice(0, 200) : "error",
      status: aborted ? "timeout" : "error",
    });
    return {
      id,
      result: {
        listings: [],
        status: aborted ? "timeout" : "error",
        message: aborted
          ? `${provider.displayName} timed out after ${PROVIDER_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : "Provider error",
        appliedFilters: [],
        fallbackSearchUrl: provider.buildFallbackSearchUrl(filters),
        warning: null,
        nextCursor: null,
        latencyMs: PROVIDER_TIMEOUT_MS,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function postProcess(listings: Listing[], filters: SearchFilters): Listing[] {
  const filtered = listings.filter((listing) =>
    passesClientFilters(listing, {
      requiredTerms: filters.requiredTerms,
      excludedTerms: filters.excludedTerms,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      currency: filters.currency,
    }),
  );
  const deduped = dedupeListings(filtered);
  return applyRelevance(deduped, filters);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
