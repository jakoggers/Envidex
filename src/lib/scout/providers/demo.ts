import { normalizeListing } from "../listing";
import type { Listing, SearchFilters } from "../types";
import type { ProviderSearchResult } from "./types";

/**
 * Explicit demo fixtures only — never used as a silent substitute for failed live calls.
 */
export function buildDemoListings(filters: SearchFilters): Listing[] {
  const retrievedAt = new Date().toISOString();
  const q = filters.query || "Demo item";

  const raw = [
    normalizeListing({
      marketplace: "ebay",
      sourceListingId: "demo-ebay-1",
      url: "https://www.ebay.com/itm/demo-ebay-1",
      title: `${q} — Demo Fixed Price (shipping known)`,
      imageUrl: null,
      price: { amount: 199.99, currency: filters.currency },
      shippingCost: { amount: 12.5, currency: filters.currency },
      shippingKnown: true,
      condition: "used",
      location: "Austin, TX, US",
      listingType: "fixed_price",
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      retrievedAt,
      dataOrigin: "demo",
    }),
    normalizeListing({
      marketplace: "ebay",
      sourceListingId: "demo-ebay-2",
      url: "https://www.ebay.com/itm/demo-ebay-2",
      title: `${q} Case Only — Demo Accessory`,
      imageUrl: null,
      price: { amount: 19.99, currency: filters.currency },
      shippingCost: { amount: 4.99, currency: filters.currency },
      shippingKnown: true,
      condition: "new",
      location: "Seattle, WA, US",
      listingType: "fixed_price",
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
      retrievedAt,
      dataOrigin: "demo",
    }),
    normalizeListing({
      marketplace: "ebay",
      sourceListingId: "demo-ebay-3",
      url: "https://www.ebay.com/itm/demo-ebay-3",
      title: `${q} — Demo Auction (current bid)`,
      imageUrl: null,
      price: { amount: 150, currency: filters.currency },
      shippingCost: null,
      shippingKnown: false,
      condition: "used",
      location: "Chicago, IL, US",
      listingType: "auction",
      publishedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      retrievedAt,
      dataOrigin: "demo",
      isAuctionBid: true,
    }),
    normalizeListing({
      marketplace: "facebook",
      sourceListingId: "demo-fb-1",
      url: "https://www.facebook.com/marketplace/item/demo-fb-1",
      title: `${q} — Demo local pickup`,
      imageUrl: null,
      price: { amount: 180, currency: filters.currency },
      shippingCost: { amount: 0, currency: filters.currency },
      shippingKnown: true,
      condition: "used",
      location: "Local demo city",
      distanceMiles: 8,
      listingType: "fixed_price",
      publishedAt: null,
      retrievedAt,
      dataOrigin: "demo",
    }),
    normalizeListing({
      marketplace: "offerup",
      sourceListingId: "demo-ou-1",
      url: "https://offerup.com/item/detail/demo-ou-1",
      title: `${q} refurbished — Demo OfferUp`,
      imageUrl: null,
      price: { amount: 210, currency: filters.currency },
      shippingCost: null,
      shippingKnown: false,
      condition: "refurbished",
      location: "Demo metro",
      distanceMiles: 15,
      listingType: "fixed_price",
      publishedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      retrievedAt,
      dataOrigin: "demo",
    }),
  ];

  return raw;
}

export function demoSearch(filters: SearchFilters): ProviderSearchResult {
  const listings = buildDemoListings(filters);
  return {
    listings,
    status: "success",
    message: `Demo mode: returning ${listings.length} labeled fixture listings (not live marketplace data).`,
    appliedFilters: [
      {
        filter: "demo",
        applied: true,
        detail: "Explicit demoMode enabled — fixtures only",
      },
    ],
    fallbackSearchUrl: null,
    warning: "DEMO DATA — not live marketplace results",
    nextCursor: null,
    latencyMs: 0,
  };
}
