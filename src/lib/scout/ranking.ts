import type { Listing, SearchFilters, SortMode } from "./types";

/**
 * Sort only the fetched result set. Callers must label this scope in the UI.
 * When sorting by total price: known totals first (same currency), then
 * fixed-price with unknown shipping, then auctions / cross-currency / missing price.
 */
export function sortListings(
  listings: Listing[],
  sort: SortMode,
  currency: string,
): Listing[] {
  const copy = [...listings];

  if (sort === "relevance") {
    return copy.sort(
      (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
    );
  }

  if (sort === "newest") {
    return copy.sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN;
      const aHas = Number.isFinite(aTime);
      const bHas = Number.isFinite(bTime);
      if (aHas && bHas) return bTime - aTime;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
    });
  }

  // lowest_total
  return copy.sort((a, b) => {
    const aRank = totalSortRank(a, currency);
    const bRank = totalSortRank(b, currency);
    if (aRank.bucket !== bRank.bucket) return aRank.bucket - bRank.bucket;
    if (aRank.value !== null && bRank.value !== null) {
      return aRank.value - bRank.value;
    }
    return (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
  });
}

function totalSortRank(
  listing: Listing,
  currency: string,
): { bucket: number; value: number | null } {
  if (
    listing.knownTotalPrice &&
    listing.knownTotalPrice.currency === currency &&
    listing.listingType !== "auction"
  ) {
    return { bucket: 0, value: listing.knownTotalPrice.amount };
  }

  if (
    listing.price &&
    listing.price.currency === currency &&
    listing.listingType === "fixed_price" &&
    listing.shippingCost === null
  ) {
    // Unknown shipping — separate from known totals.
    return { bucket: 1, value: listing.price.amount };
  }

  if (listing.listingType === "auction" && listing.price) {
    return { bucket: 2, value: listing.price.amount };
  }

  if (listing.price && listing.price.currency !== currency) {
    return { bucket: 3, value: null };
  }

  return { bucket: 4, value: null };
}

export function describeSortScope(
  sort: SortMode,
  listingCount: number,
): string {
  const base = `Sorted ${listingCount} fetched listing${listingCount === 1 ? "" : "s"} only — not a full marketplace ranking.`;
  if (sort === "lowest_total") {
    return `${base} Known totals (same currency) first; unknown shipping and auctions are grouped separately. Currencies are not converted.`;
  }
  if (sort === "newest") {
    return `${base} Listings without a publication date sink below dated ones.`;
  }
  return `${base} Relevance uses query phrases, model tokens, required/excluded terms, and accessory demotion.`;
}

export function attachSortMetadata(
  listings: Listing[],
  filters: SearchFilters,
): { listings: Listing[]; sortScope: string } {
  const sorted = sortListings(listings, filters.sort, filters.currency);
  return {
    listings: sorted,
    sortScope: describeSortScope(filters.sort, sorted.length),
  };
}
