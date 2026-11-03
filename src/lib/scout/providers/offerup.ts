import type { SearchFilters } from "../types";
import type {
  MarketplaceProvider,
  ProviderConfigStatus,
  ProviderSearchResult,
} from "./types";

/**
 * OfferUp publishes no public developer API for listing search.
 * Third-party scraper APIs are not an approved OfferUp integration.
 * Playwright scraping of OfferUp is not treated as permitted automated access here.
 *
 * Verified public search URL parameters (from public OfferUp web URLs):
 * - q (keywords)
 * - radius (miles; OfferUp commonly honours 5/10/20/30/50)
 * - PRICE_MIN / PRICE_MAX
 * - CONDITION (e.g. USED, REFURBISHED) — observed on public filtered URLs
 * - SORT (e.g. -posted, price)
 *
 * ZIP/location is typically session/geo based on the OfferUp site rather than a
 * stable documented `zipcode` query param on offerup.com/search, so we do not invent one.
 */
export const offerupProvider: MarketplaceProvider = {
  id: "offerup",
  displayName: "OfferUp",
  capabilities: {
    supportsPriceFilter: false,
    supportsConditionFilter: false,
    supportsLocationRadius: false,
    supportsListingDates: false,
    supportsPagination: false,
    liveRetrieval: false,
  },

  getConfigStatus(): ProviderConfigStatus {
    return {
      configured: false,
      environment: "n/a",
      message:
        "OfferUp has no public developer API. Live listing retrieval is unavailable in this app.",
    };
  },

  buildFallbackSearchUrl(filters: SearchFilters): string {
    const params = new URLSearchParams();
    params.set("q", filters.query);

    if (filters.radiusMiles !== null) {
      const snapped = snapOfferUpRadius(filters.radiusMiles);
      params.set("radius", String(snapped));
    }
    if (filters.minPrice !== null) {
      params.set("PRICE_MIN", String(Math.floor(filters.minPrice)));
    }
    if (filters.maxPrice !== null) {
      params.set("PRICE_MAX", String(Math.ceil(filters.maxPrice)));
    }
    if (filters.condition === "used") {
      params.set("CONDITION", "USED");
    } else if (filters.condition === "refurbished") {
      params.set("CONDITION", "REFURBISHED");
    }
    if (filters.sort === "newest") {
      params.set("SORT", "-posted");
    } else if (filters.sort === "lowest_total") {
      params.set("SORT", "price");
    }

    return `https://offerup.com/search?${params.toString()}`;
  },

  async search(filters: SearchFilters): Promise<ProviderSearchResult> {
    const fallbackSearchUrl = this.buildFallbackSearchUrl(filters);
    return {
      listings: [],
      status: "unavailable",
      message:
        "OfferUp live search is unavailable: OfferUp does not publish a public listings API, and this app does not use unofficial scrapers.",
      appliedFilters: [
        {
          filter: "price",
          applied: false,
          detail: "Encoded into the OfferUp fallback URL only (PRICE_MIN/PRICE_MAX)",
        },
        {
          filter: "condition",
          applied: false,
          detail: "Encoded into the OfferUp fallback URL only when used/refurbished",
        },
        {
          filter: "distance",
          applied: false,
          detail:
            "Radius may be present on the fallback URL; ZIP must be set in OfferUp (not a verified stable public query param)",
        },
      ],
      fallbackSearchUrl,
      warning:
        "Open OfferUp to complete location selection. Fallback URLs carry keywords and supported filter params only.",
      nextCursor: null,
      latencyMs: 0,
    };
  },
};

function snapOfferUpRadius(miles: number): number {
  const allowed = [5, 10, 20, 30, 50];
  let best = allowed[0]!;
  for (const value of allowed) {
    if (Math.abs(value - miles) < Math.abs(best - miles)) best = value;
  }
  return best;
}
