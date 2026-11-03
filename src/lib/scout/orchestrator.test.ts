import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/ebay", () => {
  return {
    ebayProvider: {
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
      getConfigStatus: () => ({
        configured: true,
        environment: "production",
        message: "mock",
      }),
      buildFallbackSearchUrl: () => "https://www.ebay.com/sch/i.html?_nkw=test",
      search: vi.fn(async () => {
        throw new Error("simulated ebay outage");
      }),
    },
  };
});

import { runSearch } from "./orchestrator";
import { facebookProvider } from "./providers/facebook";
import { offerupProvider } from "./providers/offerup";
import { normalizeListing } from "./listing";

describe("runSearch partial provider failure", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("keeps Facebook/OfferUp statuses when eBay throws", async () => {
    const result = await runSearch({
      query: "Sony WH-1000XM4",
      minPrice: null,
      maxPrice: null,
      currency: "USD",
      location: null,
      radiusMiles: null,
      condition: "any",
      marketplaces: ["ebay", "facebook", "offerup"],
      requiredTerms: [],
      excludedTerms: [],
      sort: "relevance",
      demoMode: false,
    });

    const ebay = result.sources.find((s) => s.marketplace === "ebay");
    const facebook = result.sources.find((s) => s.marketplace === "facebook");
    const offerup = result.sources.find((s) => s.marketplace === "offerup");

    expect(ebay?.status).toBe("error");
    expect(facebook?.status).toBe("unavailable");
    expect(offerup?.status).toBe("unavailable");
    expect(facebook?.fallbackSearchUrl).toContain("facebook.com/marketplace");
    expect(offerup?.fallbackSearchUrl).toContain("offerup.com/search");
    // eBay failure must not erase the overall response structure
    expect(result.listings).toEqual([]);
    expect(result.sources).toHaveLength(3);
  });

  it("never silently injects demo fixtures without demoMode", async () => {
    const result = await runSearch({
      query: "test",
      minPrice: null,
      maxPrice: null,
      currency: "USD",
      location: null,
      radiusMiles: null,
      condition: "any",
      marketplaces: ["ebay"],
      requiredTerms: [],
      excludedTerms: [],
      sort: "relevance",
      demoMode: false,
    });
    expect(result.listings.every((l) => l.dataOrigin !== "demo")).toBe(true);
  });
});

describe("fallback providers", () => {
  it("Facebook returns unavailable with query-only fallback URL", async () => {
    const result = await facebookProvider.search({
      query: "Sony WH-1000XM4",
      minPrice: 50,
      maxPrice: 250,
      currency: "USD",
      location: "94107",
      radiusMiles: 20,
      condition: "used",
      marketplaces: ["facebook"],
      requiredTerms: [],
      excludedTerms: [],
      sort: "relevance",
      demoMode: false,
    });
    expect(result.status).toBe("unavailable");
    expect(result.listings).toHaveLength(0);
    expect(result.fallbackSearchUrl).toBe(
      "https://www.facebook.com/marketplace/search/?query=Sony+WH-1000XM4",
    );
    expect(result.appliedFilters.every((f) => f.applied === false)).toBe(true);
  });

  it("OfferUp returns unavailable with verified filter params on fallback URL", async () => {
    const result = await offerupProvider.search({
      query: "Sony WH-1000XM4",
      minPrice: 50,
      maxPrice: 250,
      currency: "USD",
      location: "94107",
      radiusMiles: 28,
      condition: "used",
      marketplaces: ["offerup"],
      requiredTerms: [],
      excludedTerms: [],
      sort: "newest",
      demoMode: false,
    });
    expect(result.status).toBe("unavailable");
    expect(result.fallbackSearchUrl).toContain("https://offerup.com/search?");
    expect(result.fallbackSearchUrl).toContain("q=Sony");
    expect(result.fallbackSearchUrl).toContain("PRICE_MIN=50");
    expect(result.fallbackSearchUrl).toContain("PRICE_MAX=250");
    expect(result.fallbackSearchUrl).toContain("CONDITION=USED");
    expect(result.fallbackSearchUrl).toContain("radius=30");
  });
});

describe("demo mode labeling", () => {
  it("labels demo listings and requires explicit flag", async () => {
    // re-import without ebay mock throwing for demo path — demo short-circuits
    const result = await runSearch({
      query: "Sony WH-1000XM4",
      minPrice: null,
      maxPrice: null,
      currency: "USD",
      location: null,
      radiusMiles: null,
      condition: "any",
      marketplaces: ["ebay", "facebook", "offerup"],
      requiredTerms: [],
      excludedTerms: ["case"],
      sort: "relevance",
      demoMode: true,
    });
    expect(result.listings.length).toBeGreaterThan(0);
    expect(result.listings.every((l) => l.dataOrigin === "demo")).toBe(true);
    expect(result.sources.every((s) => s.warning?.includes("DEMO"))).toBe(true);
  });
});

describe("manual vs live origin", () => {
  it("keeps dataOrigin distinguishable", () => {
    const live = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "1",
      url: "https://www.ebay.com/itm/1",
      title: "Live",
      dataOrigin: "live",
    });
    const manual = normalizeListing({
      marketplace: "ebay",
      sourceListingId: "2",
      url: "https://www.ebay.com/itm/2",
      title: "Manual",
      dataOrigin: "manual",
    });
    expect(live.dataOrigin).toBe("live");
    expect(manual.dataOrigin).toBe("manual");
  });
});
