import { describe, expect, it } from "vitest";
import {
  computeKnownTotalPrice,
  dedupeListings,
  normalizeListing,
  passesClientFilters,
} from "./listing";
import type { Listing } from "./types";

describe("computeKnownTotalPrice", () => {
  it("sums price and shipping when both known and same currency", () => {
    expect(
      computeKnownTotalPrice(
        { amount: 100, currency: "USD" },
        { amount: 12.5, currency: "USD" },
      ),
    ).toEqual({ amount: 112.5, currency: "USD" });
  });

  it("treats unknown shipping as not free — returns null", () => {
    expect(
      computeKnownTotalPrice({ amount: 100, currency: "USD" }, null),
    ).toBeNull();
  });

  it("does not treat auction bids as a purchase total", () => {
    expect(
      computeKnownTotalPrice(
        { amount: 80, currency: "USD" },
        { amount: 10, currency: "USD" },
        { isAuctionBid: true, listingType: "auction" },
      ),
    ).toBeNull();
  });

  it("does not mix currencies", () => {
    expect(
      computeKnownTotalPrice(
        { amount: 100, currency: "USD" },
        { amount: 10, currency: "EUR" },
      ),
    ).toBeNull();
  });
});

describe("normalizeListing", () => {
  it("preserves nulls and does not invent free shipping", () => {
    const listing = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "1",
      url: "https://www.ebay.com/itm/1",
      title: "Sony WH-1000XM4",
      dataOrigin: "live",
      price: { amount: 150, currency: "USD" },
      shippingKnown: false,
    });
    expect(listing.shippingCost).toBeNull();
    expect(listing.knownTotalPrice).toBeNull();
    expect(listing.publishedAt).toBeNull();
    expect(listing.imageUrl).toBeNull();
    expect(listing.dataOrigin).toBe("live");
  });

  it("strips HTML from titles", () => {
    const listing = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "2",
      url: "https://www.ebay.com/itm/2",
      title: '<img src=x onerror=alert(1)>Safe <b>Title</b>',
      dataOrigin: "manual",
    });
    expect(listing.title).toBe("Safe Title");
    expect(listing.title).not.toContain("<");
  });

  it("marks auction listings without known totals even with shipping", () => {
    const listing = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "3",
      url: "https://www.ebay.com/itm/3",
      title: "Auction headphones",
      dataOrigin: "live",
      price: { amount: 40, currency: "USD" },
      shippingCost: { amount: 8, currency: "USD" },
      shippingKnown: true,
      listingType: "auction",
      isAuctionBid: true,
    });
    expect(listing.listingType).toBe("auction");
    expect(listing.knownTotalPrice).toBeNull();
  });
});

describe("dedupeListings", () => {
  const base = (overrides: Partial<Listing>): Listing =>
    ({
      marketplace: "ebay",
      sourceListingId: "abc",
      url: "https://www.ebay.com/itm/abc",
      title: "Item A",
      imageUrl: null,
      price: { amount: 10, currency: "USD" },
      shippingCost: null,
      knownTotalPrice: null,
      condition: "used",
      location: null,
      distanceMiles: null,
      listingType: "fixed_price",
      publishedAt: null,
      retrievedAt: new Date().toISOString(),
      dataOrigin: "live",
      ...overrides,
    }) as Listing;

  it("dedupes exact marketplace+id matches", () => {
    const result = dedupeListings([
      base({ title: "First" }),
      base({ title: "Duplicate id" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("First");
  });

  it("dedupes canonical URL matches across tracking params", () => {
    const result = dedupeListings([
      base({
        sourceListingId: "one",
        url: "https://www.ebay.com/itm/xyz?utm_source=x",
      }),
      base({
        sourceListingId: "two",
        url: "https://www.ebay.com/itm/xyz",
      }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("does not merge different listings with similar titles", () => {
    const result = dedupeListings([
      base({
        sourceListingId: "a",
        url: "https://www.ebay.com/itm/a",
        title: "Sony WH-1000XM4",
      }),
      base({
        sourceListingId: "b",
        url: "https://www.ebay.com/itm/b",
        title: "Sony WH-1000XM4 Headphones",
      }),
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("passesClientFilters", () => {
  const listing = normalizeListing({
    marketplace: "ebay",
    sourceListingId: "f1",
    url: "https://www.ebay.com/itm/f1",
    title: "Sony WH-1000XM4 Used Headphones",
    dataOrigin: "live",
    price: { amount: 180, currency: "USD" },
  });

  it("requires all required terms", () => {
    expect(
      passesClientFilters(listing, {
        requiredTerms: ["XM4"],
        excludedTerms: [],
        minPrice: null,
        maxPrice: null,
        currency: "USD",
      }),
    ).toBe(true);
    expect(
      passesClientFilters(listing, {
        requiredTerms: ["XM5"],
        excludedTerms: [],
        minPrice: null,
        maxPrice: null,
        currency: "USD",
      }),
    ).toBe(false);
  });

  it("excludes excluded terms", () => {
    expect(
      passesClientFilters(listing, {
        requiredTerms: [],
        excludedTerms: ["case"],
        minPrice: null,
        maxPrice: null,
        currency: "USD",
      }),
    ).toBe(true);
    expect(
      passesClientFilters(
        { ...listing, title: "Sony WH-1000XM4 Case" },
        {
          requiredTerms: [],
          excludedTerms: ["case"],
          minPrice: null,
          maxPrice: null,
          currency: "USD",
        },
      ),
    ).toBe(false);
  });
});
