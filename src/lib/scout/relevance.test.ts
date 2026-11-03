import { describe, expect, it } from "vitest";
import { scoreListing } from "./relevance";
import { normalizeListing } from "./listing";
import type { SearchFilters } from "./types";

const filters = (overrides: Partial<SearchFilters> = {}): SearchFilters => ({
  query: "Sony WH-1000XM4",
  minPrice: null,
  maxPrice: null,
  currency: "USD",
  location: null,
  radiusMiles: null,
  condition: "any",
  marketplaces: ["ebay"],
  requiredTerms: ["XM4"],
  excludedTerms: ["case", "parts"],
  sort: "relevance",
  demoMode: false,
  ...overrides,
});

describe("scoreListing", () => {
  it("scores exact product higher than accessory with shared keywords", () => {
    const product = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "p",
      url: "https://www.ebay.com/itm/p",
      title: "Sony WH-1000XM4 Wireless Headphones",
      dataOrigin: "live",
      listingType: "fixed_price",
    });
    const accessory = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "a",
      url: "https://www.ebay.com/itm/a",
      title: "Sony WH-1000XM4 Replacement Earpads Case",
      dataOrigin: "live",
      listingType: "fixed_price",
    });

    const productScore = scoreListing(product, filters());
    const accessoryScore = scoreListing(accessory, filters());

    expect(productScore.score).toBeGreaterThan(accessoryScore.score);
    expect(accessoryScore.reasons.some((r) => /accessory|Excluded/i.test(r))).toBe(
      true,
    );
  });
});
