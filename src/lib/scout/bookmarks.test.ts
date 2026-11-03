import { describe, expect, it } from "vitest";
import { createManualBookmark } from "./bookmarks";
import { manualBookmarkSchema } from "./validation";

describe("manual bookmarks", () => {
  it("creates manual origin without fetching", () => {
    const listing = createManualBookmark({
      url: "https://www.ebay.com/itm/123456",
      title: "Saved XM4",
      priceAmount: 175,
      currency: "USD",
      marketplace: null,
    });
    expect(listing.dataOrigin).toBe("manual");
    expect(listing.marketplace).toBe("ebay");
    expect(listing.shippingCost).toBeNull();
    expect(listing.knownTotalPrice).toBeNull();
  });

  it("rejects non-allowlisted hosts", () => {
    expect(() =>
      manualBookmarkSchema.parse({
        url: "https://evil.example/item/1",
        title: "Nope",
        currency: "USD",
      }),
    ).toThrow();
  });
});
