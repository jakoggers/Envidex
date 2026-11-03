import type {
  AppliedFilterInfo,
  Listing,
  MarketplaceId,
  SearchFilters,
  SourceStatusCode,
} from "../types";

export interface ProviderCapabilities {
  supportsPriceFilter: boolean;
  supportsConditionFilter: boolean;
  supportsLocationRadius: boolean;
  supportsListingDates: boolean;
  supportsPagination: boolean;
  liveRetrieval: boolean;
}

export interface ProviderConfigStatus {
  configured: boolean;
  environment?: "sandbox" | "production" | "n/a";
  message: string;
}

export interface ProviderSearchResult {
  listings: Listing[];
  status: SourceStatusCode;
  message: string;
  appliedFilters: AppliedFilterInfo[];
  fallbackSearchUrl: string | null;
  warning: string | null;
  nextCursor: string | null;
  latencyMs: number;
}

export interface MarketplaceProvider {
  id: MarketplaceId;
  displayName: string;
  capabilities: ProviderCapabilities;
  getConfigStatus(): ProviderConfigStatus;
  buildFallbackSearchUrl(filters: SearchFilters): string;
  search(
    filters: SearchFilters,
    options?: { cursor?: string | null; signal?: AbortSignal },
  ): Promise<ProviderSearchResult>;
}
