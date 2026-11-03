import type { SearchFilters } from "../types";
import type {
  MarketplaceProvider,
  ProviderConfigStatus,
  ProviderSearchResult,
} from "./types";

/**
 * Facebook Marketplace has no public consumer search API.
 * Meta Content Library Marketplace endpoints are research-only (approved orgs).
 * Marketplace Partnerships APIs are for distributing seller inventory, not search.
 * Automated scraping requires login and is blocked by Meta ToS / CAPTCHA —
 * we do not bypass access controls.
 *
 * This adapter therefore returns `unavailable` with a verified fallback search URL.
 * Verified URL shape (2026): https://www.facebook.com/marketplace/search/?query=...
 * Location/price/radius are applied in the Facebook UI; they are not documented
 * as stable public query parameters, so we only encode the keyword query.
 */
export const facebookProvider: MarketplaceProvider = {
  id: "facebook",
  displayName: "Facebook Marketplace",
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
        "No public Facebook Marketplace search API is available for this app. Meta Content Library access is limited to approved research organizations. Live listing retrieval is unavailable.",
    };
  },

  buildFallbackSearchUrl(filters: SearchFilters): string {
    const params = new URLSearchParams();
    params.set("query", filters.query);
    // Only the `query` parameter is verified on public Marketplace search URLs.
    return `https://www.facebook.com/marketplace/search/?${params.toString()}`;
  },

  async search(filters: SearchFilters): Promise<ProviderSearchResult> {
    const fallbackSearchUrl = this.buildFallbackSearchUrl(filters);
    return {
      listings: [],
      status: "unavailable",
      message:
        "Facebook Marketplace live search is unavailable: there is no approved public API for consumer listing search, and scraping that requires login or CAPTCHA bypass is not implemented.",
      appliedFilters: [
        {
          filter: "price",
          applied: false,
          detail: "Not applied — open Facebook and set price filters there",
        },
        {
          filter: "condition",
          applied: false,
          detail: "Not applied — no live retrieval",
        },
        {
          filter: "distance",
          applied: false,
          detail:
            "Not applied — Marketplace uses account/browser location; ZIP/radius are not encoded in the fallback URL",
        },
      ],
      fallbackSearchUrl,
      warning:
        "Fallback link opens Facebook Marketplace with your keywords only. Set location, distance, and price on Facebook.",
      nextCursor: null,
      latencyMs: 0,
    };
  },
};
