import { describe, expect, it } from "vitest";
import { sortListings } from "./ranking";
import { normalizeListing } from "./listing";

describe("sortListings lowest_total", () => {
  it("places known totals before unknown shipping and auctions", () => {
    const known = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "k",
      url: "https://www.ebay.com/itm/k",
      title: "Known total",
      dataOrigin: "live",
      price: { amount: 200, currency: "USD" },
      shippingCost: { amount: 10, currency: "USD" },
      shippingKnown: true,
      listingType: "fixed_price",
    });
    const unknownShip = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "u",
      url: "https://www.ebay.com/itm/u",
      title: "Unknown ship",
      dataOrigin: "live",
      price: { amount: 50, currency: "USD" },
      shippingKnown: false,
      listingType: "fixed_price",
    });
    const auction = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "a",
      url: "https://www.ebay.com/itm/a",
      title: "Auction",
      dataOrigin: "live",
      price: { amount: 20, currency: "USD" },
      shippingCost: { amount: 5, currency: "USD" },
      shippingKnown: true,
      listingType: "auction",
      isAuctionBid: true,
    });

    known.relevanceScore = 10;
    unknownShip.relevanceScore = 10;
    auction.relevanceScore = 10;

    const sorted = sortListings([auction, unknownShip, known], "lowest_total", "USD");
    expect(sorted.map((l) => l.sourceListingId)).toEqual(["k", "u", "a"]);
  });
});
