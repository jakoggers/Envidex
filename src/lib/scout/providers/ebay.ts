import { normalizeListing } from "../listing";
import { log } from "../logger";
import { cacheGet, cacheSet, cacheKey } from "../cache";
import type {
  AppliedFilterInfo,
  Listing,
  ListingCondition,
  ListingType,
  SearchFilters,
} from "../types";
import type {
  MarketplaceProvider,
  ProviderConfigStatus,
  ProviderSearchResult,
} from "./types";
import {
  EbayAuthError,
  ebayApiBase,
  getEbayApplicationToken,
  getEbayAuthConfig,
} from "./ebay-auth";

interface EbayAmount {
  value: string;
  currency: string;
}

interface EbayItemSummary {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
  price?: EbayAmount;
  shippingOptions?: Array<{
    shippingCost?: EbayAmount;
    shippingCostType?: string;
  }>;
  condition?: string;
  conditionId?: string;
  buyingOptions?: string[];
  itemLocation?: { city?: string; stateOrProvince?: string; country?: string; postalCode?: string };
  itemCreationDate?: string;
  itemAffiliateWebUrl?: string;
  currentBidPrice?: EbayAmount;
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
  total?: number;
  next?: string;
  warnings?: Array<{ message?: string }>;
  errors?: Array<{ message?: string; errorId?: number }>;
}

const PAGE_LIMIT = 50;

export const ebayProvider: MarketplaceProvider = {
  id: "ebay",
  displayName: "eBay",
  capabilities: {
    supportsPriceFilter: true,
    supportsConditionFilter: true,
    supportsLocationRadius: false,
    supportsListingDates: true,
    supportsPagination: true,
    liveRetrieval: true,
  },

  getConfigStatus(): ProviderConfigStatus {
    const config = getEbayAuthConfig();
    if (!config) {
      return {
        configured: false,
        environment: "n/a",
        message:
          "Not configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (and optional EBAY_ENV=sandbox|production). Create an app at developer.ebay.com and enable the Browse API under Buy APIs.",
      };
    }
    return {
      configured: true,
      environment: config.env,
      message: `Configured for eBay ${config.env} Browse API (OAuth client credentials).`,
    };
  },

  buildFallbackSearchUrl(filters: SearchFilters): string {
    const params = new URLSearchParams();
    params.set("_nkw", filters.query);
    if (filters.minPrice !== null) params.set("_udlo", String(filters.minPrice));
    if (filters.maxPrice !== null) params.set("_udhi", String(filters.maxPrice));
    if (filters.location) params.set("_stpos", filters.location);
    if (filters.radiusMiles !== null) {
      params.set("_sadis", String(Math.min(filters.radiusMiles, 200)));
      params.set("_fspt", "1");
    }
    // LH_ItemCondition: Used=3000, Seller refurbished=2500, etc. Keep broad for fallback.
    if (filters.condition === "used") params.set("LH_ItemCondition", "3000");
    if (filters.condition === "refurbished") params.set("LH_ItemCondition", "2000|2010|2020|2030");
    return `https://www.ebay.com/sch/i.html?${params.toString()}`;
  },

  async search(
    filters: SearchFilters,
    options?: { cursor?: string | null; signal?: AbortSignal },
  ): Promise<ProviderSearchResult> {
    const started = Date.now();
    const appliedFilters: AppliedFilterInfo[] = [];
    const fallbackSearchUrl = this.buildFallbackSearchUrl(filters);
    const configStatus = this.getConfigStatus();

    if (!configStatus.configured) {
      return {
        listings: [],
        status: "not_configured",
        message: configStatus.message,
        appliedFilters,
        fallbackSearchUrl,
        warning: null,
        nextCursor: null,
        latencyMs: Date.now() - started,
      };
    }

    const config = getEbayAuthConfig()!;
    const offset = options?.cursor ? Number(options.cursor) || 0 : 0;
    const cachePayload = {
      q: filters.query,
      min: filters.minPrice,
      max: filters.maxPrice,
      currency: filters.currency,
      condition: filters.condition,
      location: filters.location,
      sort: filters.sort,
      offset,
      env: config.env,
    };
    const key = cacheKey("ebay", cachePayload);
    const cached = cacheGet<ProviderSearchResult>(key);
    if (cached) {
      return { ...cached, latencyMs: Date.now() - started };
    }

    try {
      const result = await searchEbayWithRetry(filters, offset, config.env, options?.signal);
      const withMeta: ProviderSearchResult = {
        ...result,
        fallbackSearchUrl,
        latencyMs: Date.now() - started,
      };
      if (withMeta.status === "success" || withMeta.status === "partial") {
        cacheSet(key, withMeta, "ebay");
      }
      return withMeta;
    } catch (error) {
      const message =
        error instanceof EbayAuthError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown eBay error";
      log("error", "ebay.search_failed", {
        provider: "ebay",
        message: message.slice(0, 300),
      });
      return {
        listings: [],
        status: error instanceof EbayAuthError && error.status === 401
          ? "not_configured"
          : "error",
        message,
        appliedFilters,
        fallbackSearchUrl,
        warning: null,
        nextCursor: null,
        latencyMs: Date.now() - started,
      };
    }
  },
};

async function searchEbayWithRetry(
  filters: SearchFilters,
  offset: number,
  env: "sandbox" | "production",
  signal?: AbortSignal,
): Promise<Omit<ProviderSearchResult, "fallbackSearchUrl" | "latencyMs"> & { fallbackSearchUrl?: null }> {
  const maxAttempts = 3;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await executeEbaySearch(filters, offset, env, signal);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable =
        lastError.message.includes("429") ||
        lastError.message.includes("503") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.name === "TimeoutError";
      if (!retryable || attempt >= maxAttempts) break;
      const backoff = Math.min(2000, 250 * 2 ** (attempt - 1));
      await sleep(backoff, signal);
    }
  }

  throw lastError ?? new Error("eBay search failed");
}

async function executeEbaySearch(
  filters: SearchFilters,
  offset: number,
  env: "sandbox" | "production",
  signal?: AbortSignal,
): Promise<Omit<ProviderSearchResult, "fallbackSearchUrl" | "latencyMs">> {
  const config = getEbayAuthConfig()!;
  const token = await getEbayApplicationToken(config, signal);
  const appliedFilters: AppliedFilterInfo[] = [];

  const params = new URLSearchParams();
  params.set("q", filters.query);
  params.set("limit", String(PAGE_LIMIT));
  params.set("offset", String(offset));

  const filterParts: string[] = [];

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const min = filters.minPrice ?? 0;
    const max = filters.maxPrice ?? "";
    filterParts.push(`price:[${min}..${max}]`);
    filterParts.push(`priceCurrency:${filters.currency}`);
    appliedFilters.push({
      filter: "price",
      applied: true,
      detail: `API price filter ${min}–${max || "∞"} ${filters.currency}`,
    });
  } else {
    appliedFilters.push({
      filter: "price",
      applied: false,
      detail: "No price bounds requested",
    });
  }

  if (filters.condition === "used") {
    filterParts.push("conditions:{USED}");
    appliedFilters.push({
      filter: "condition",
      applied: true,
      detail: "conditions:{USED}",
    });
  } else if (filters.condition === "refurbished") {
    // Browse API high-level conditions are NEW|USED|UNSPECIFIED.
    // Refurbished is requested via conditionIds (seller/manufacturer refurbished).
    filterParts.push("conditionIds:{2000|2010|2020|2030}");
    appliedFilters.push({
      filter: "condition",
      applied: true,
      detail: "conditionIds for refurbished variants (2000/2010/2020/2030)",
    });
  } else {
    appliedFilters.push({
      filter: "condition",
      applied: false,
      detail: "Any condition (no API condition filter)",
    });
  }

  if (filters.location && /^\d{5}(-\d{4})?$/.test(filters.location)) {
    params.set("buyerPostalCode", filters.location.split("-")[0]!);
    appliedFilters.push({
      filter: "location",
      applied: true,
      detail:
        "buyerPostalCode set for shipping estimates; distance radius is not applied by Browse API search",
    });
  } else if (filters.location || filters.radiusMiles !== null) {
    appliedFilters.push({
      filter: "distance",
      applied: false,
      detail:
        "Browse API does not apply a seller distance radius filter in this integration. Use the eBay site fallback for local radius search.",
    });
  } else {
    appliedFilters.push({
      filter: "distance",
      applied: false,
      detail: "No location provided",
    });
  }

  if (filterParts.length) {
    params.set("filter", filterParts.join(","));
  }

  if (filters.sort === "lowest_total") {
    params.set("sort", "price");
  } else if (filters.sort === "newest") {
    params.set("sort", "newlyListed");
  }
  // relevance → omit sort (Best Match default)

  const url = `${ebayApiBase(env)}/buy/browse/v1/item_summary/search?${params}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": process.env.EBAY_MARKETPLACE_ID || "EBAY_US",
      ...(filters.location && /^\d{5}/.test(filters.location)
        ? {
            "X-EBAY-C-ENDUSERCTX": `contextualLocation=country%3DUS%2Czip%3D${filters.location.split("-")[0]}`,
          }
        : {}),
    },
    signal,
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    throw Object.assign(new Error(`429 rate limited${retryAfter ? ` retry-after=${retryAfter}` : ""}`), {
      name: "RateLimitError",
    });
  }

  if (response.status === 401 || response.status === 403) {
    const body = await response.text().catch(() => "");
    throw new EbayAuthError(
      response.status,
      response.status === 403
        ? `eBay Browse API returned 403. Production Browse API access may require eBay approval beyond basic app keys. Environment=${env}. ${body.slice(0, 180)}`
        : `eBay authorization failed (${response.status}). Verify client credentials and OAuth scope https://api.ebay.com/oauth/api_scope.`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`eBay search HTTP ${response.status}: ${body.slice(0, 240)}`);
  }

  const json = (await response.json()) as EbaySearchResponse;
  const retrievedAt = new Date().toISOString();
  const listings: Listing[] = (json.itemSummaries ?? []).map((item) =>
    mapEbayItem(item, retrievedAt),
  );

  const nextOffset = offset + PAGE_LIMIT;
  const hasMore =
    typeof json.total === "number"
      ? nextOffset < Math.min(json.total, 10_000)
      : Boolean(json.next);

  const warning =
    json.warnings?.map((w) => w.message).filter(Boolean).join("; ") || null;

  log("info", "ebay.search_ok", {
    provider: "ebay",
    status: "success",
    count: listings.length,
    offset,
    environment: env,
  });

  return {
    listings,
    status: "success",
    message: `Retrieved ${listings.length} eBay listing${listings.length === 1 ? "" : "s"} (${env}).`,
    appliedFilters,
    warning,
    nextCursor: hasMore ? String(nextOffset) : null,
  };
}

function mapEbayItem(item: EbayItemSummary, retrievedAt: string): Listing {
  const buying = item.buyingOptions ?? [];
  const isAuction = buying.includes("AUCTION") && !buying.includes("FIXED_PRICE");
  const listingType: ListingType = buying.includes("FIXED_PRICE")
    ? "fixed_price"
    : buying.includes("AUCTION")
      ? "auction"
      : "unknown";

  const priceAmount = isAuction && item.currentBidPrice
    ? parseAmount(item.currentBidPrice)
    : parseAmount(item.price);

  const shippingOption = item.shippingOptions?.[0];
  const shippingCost = shippingOption?.shippingCost
    ? parseAmount(shippingOption.shippingCost)
    : null;
  const shippingKnown = Boolean(shippingOption?.shippingCost);

  const locationParts = [
    item.itemLocation?.city,
    item.itemLocation?.stateOrProvince,
    item.itemLocation?.country,
  ].filter(Boolean);

  return normalizeListing({
    marketplace: "ebay",
    sourceListingId: item.itemId || item.itemWebUrl || `unknown-${retrievedAt}`,
    url: item.itemWebUrl || item.itemAffiliateWebUrl || "https://www.ebay.com",
    title: item.title || "Untitled eBay listing",
    imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || null,
    price: priceAmount,
    shippingCost,
    shippingKnown,
    condition: mapEbayCondition(item.condition, item.conditionId),
    location: locationParts.length ? locationParts.join(", ") : null,
    distanceMiles: null,
    listingType,
    publishedAt: item.itemCreationDate || null,
    retrievedAt,
    dataOrigin: "live",
    isAuctionBid: isAuction,
  });
}

function parseAmount(amount?: EbayAmount | null): { amount: number; currency: string } | null {
  if (!amount?.value) return null;
  const n = Number(amount.value);
  if (!Number.isFinite(n)) return null;
  return { amount: n, currency: amount.currency || "USD" };
}

function mapEbayCondition(
  condition?: string,
  conditionId?: string,
): ListingCondition {
  const text = `${condition ?? ""} ${conditionId ?? ""}`.toLowerCase();
  if (text.includes("refurb")) return "refurbished";
  if (text.includes("new")) return "new";
  if (text.includes("parts") || conditionId === "7000") return "for_parts";
  if (text.includes("used") || text.includes("pre-owned") || text.includes("good") || text.includes("acceptable")) {
    return "used";
  }
  // Common condition IDs: 1000 new, 1500 open box, 2000-2030 refurbished, 3000 used
  if (conditionId === "1000") return "new";
  if (conditionId === "1500") return "open_box";
  if (["2000", "2010", "2020", "2030"].includes(conditionId ?? "")) return "refurbished";
  if (conditionId === "3000") return "used";
  return "unknown";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
