/** Shared domain types for Secondhand Scout. */

export type MarketplaceId = "ebay" | "facebook" | "offerup";

export type ConditionFilter = "any" | "used" | "refurbished";

export type ListingCondition =
  | "new"
  | "used"
  | "refurbished"
  | "open_box"
  | "for_parts"
  | "unknown";

export type ListingType = "fixed_price" | "auction" | "unknown";

export type DataOrigin = "live" | "manual" | "demo";

export type SortMode = "relevance" | "lowest_total" | "newest";

export type SourceStatusCode =
  | "success"
  | "partial"
  | "not_configured"
  | "unavailable"
  | "rate_limited"
  | "timeout"
  | "error"
  | "skipped";

export interface Money {
  amount: number;
  currency: string;
}

export interface Listing {
  marketplace: MarketplaceId;
  sourceListingId: string;
  url: string;
  title: string;
  imageUrl: string | null;
  price: Money | null;
  shippingCost: Money | null;
  /** Only set when item price + shipping are both known and same currency. */
  knownTotalPrice: Money | null;
  condition: ListingCondition;
  location: string | null;
  distanceMiles: number | null;
  listingType: ListingType;
  /** Listing publication / start date when the source provides one. */
  publishedAt: string | null;
  /** When Secondhand Scout retrieved this listing. */
  retrievedAt: string;
  dataOrigin: DataOrigin;
  /** Explainable relevance score for the active query (0–100). */
  relevanceScore?: number;
  relevanceReasons?: string[];
}

export interface SearchFilters {
  query: string;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string;
  location: string | null;
  radiusMiles: number | null;
  condition: ConditionFilter;
  marketplaces: MarketplaceId[];
  requiredTerms: string[];
  excludedTerms: string[];
  sort: SortMode;
  demoMode: boolean;
}

export interface AppliedFilterInfo {
  filter: string;
  applied: boolean;
  detail: string;
}

export interface SourceStatus {
  marketplace: MarketplaceId;
  status: SourceStatusCode;
  message: string;
  appliedFilters: AppliedFilterInfo[];
  fallbackSearchUrl: string | null;
  warning: string | null;
  resultCount: number;
  latencyMs: number | null;
}

export interface SearchResponse {
  listings: Listing[];
  sources: SourceStatus[];
  nextCursors: Partial<Record<MarketplaceId, string | null>>;
  sortScope: string;
  cached: boolean;
  query: SearchFilters;
}

export interface ManualBookmarkInput {
  url: string;
  title: string;
  priceAmount: number | null;
  currency: string;
  marketplace: MarketplaceId | null;
}
