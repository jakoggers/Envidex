import type {
  Listing,
  MarketplaceId,
  Money,
  ListingCondition,
  ListingType,
  DataOrigin,
} from "./types";

export interface RawListingInput {
  marketplace: MarketplaceId;
  sourceListingId: string;
  url: string;
  title: string;
  imageUrl?: string | null;
  price?: Money | null;
  shippingCost?: Money | null;
  shippingKnown?: boolean;
  condition?: ListingCondition;
  location?: string | null;
  distanceMiles?: number | null;
  listingType?: ListingType;
  publishedAt?: string | null;
  retrievedAt?: string;
  dataOrigin: DataOrigin;
  /** Auction current bid — never treated as a purchase price total. */
  isAuctionBid?: boolean;
}

/** Unknown shipping is not free shipping. Known total only when calculable. */
export function computeKnownTotalPrice(
  price: Money | null,
  shippingCost: Money | null,
  options?: { isAuctionBid?: boolean; listingType?: ListingType },
): Money | null {
  if (!price) return null;
  if (options?.isAuctionBid || options?.listingType === "auction") return null;
  if (!shippingCost) return null;
  if (price.currency !== shippingCost.currency) return null;
  return {
    amount: roundMoney(price.amount + shippingCost.amount),
    currency: price.currency,
  };
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function normalizeListing(input: RawListingInput): Listing {
  const price = input.price ?? null;
  const shippingCost =
    input.shippingKnown === false ? null : (input.shippingCost ?? null);
  const listingType = input.listingType ?? "unknown";

  return {
    marketplace: input.marketplace,
    sourceListingId: input.sourceListingId,
    url: canonicalizeUrl(input.url),
    title: sanitizeText(input.title),
    imageUrl: input.imageUrl ? sanitizeUrl(input.imageUrl) : null,
    price,
    shippingCost,
    knownTotalPrice: computeKnownTotalPrice(price, shippingCost, {
      isAuctionBid: input.isAuctionBid,
      listingType,
    }),
    condition: input.condition ?? "unknown",
    location: input.location ? sanitizeText(input.location) : null,
    distanceMiles:
      typeof input.distanceMiles === "number" && Number.isFinite(input.distanceMiles)
        ? input.distanceMiles
        : null,
    listingType,
    publishedAt: input.publishedAt ?? null,
    retrievedAt: input.retrievedAt ?? new Date().toISOString(),
    dataOrigin: input.dataOrigin,
  };
}

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // Drop common tracking params while keeping marketplace identity.
    ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid", "_skw", "mkcid"].forEach(
      (key) => u.searchParams.delete(key),
    );
    return u.toString();
  } catch {
    return url;
  }
}

export function listingDedupeKey(listing: Listing): string {
  return `${listing.marketplace}:${listing.sourceListingId}`.toLowerCase();
}

export function dedupeListings(listings: Listing[]): Listing[] {
  const byKey = new Map<string, Listing>();
  const byUrl = new Map<string, Listing>();

  for (const listing of listings) {
    const key = listingDedupeKey(listing);
    const urlKey = canonicalizeUrl(listing.url).toLowerCase();

    if (byKey.has(key) || byUrl.has(urlKey)) {
      continue;
    }
    byKey.set(key, listing);
    byUrl.set(urlKey, listing);
  }

  return Array.from(byKey.values());
}

/** Strip tags / control chars so imported listing text never executes as HTML. */
export function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

export function sanitizeUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function passesClientFilters(
  listing: Listing,
  options: {
    requiredTerms: string[];
    excludedTerms: string[];
    minPrice: number | null;
    maxPrice: number | null;
    currency: string;
  },
): boolean {
  const title = listing.title.toLowerCase();

  for (const term of options.requiredTerms) {
    if (!title.includes(term.toLowerCase())) return false;
  }
  for (const term of options.excludedTerms) {
    if (title.includes(term.toLowerCase())) return false;
  }

  if (listing.price) {
    if (listing.price.currency !== options.currency) {
      // Do not compare across currencies without conversion.
      return true;
    }
    if (options.minPrice !== null && listing.price.amount < options.minPrice) {
      return false;
    }
    if (options.maxPrice !== null && listing.price.amount > options.maxPrice) {
      return false;
    }
  }

  return true;
}
