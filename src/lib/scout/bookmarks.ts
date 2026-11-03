import { nanoid } from "nanoid";
import { normalizeListing } from "./listing";
import { inferMarketplaceFromUrl } from "./validation";
import type { Listing, ManualBookmarkInput } from "./types";

/**
 * Manual bookmarks are user-supplied metadata.
 * Saving a URL must NOT trigger marketplace fetching.
 */
export function createManualBookmark(input: ManualBookmarkInput): Listing {
  const marketplace =
    input.marketplace ?? inferMarketplaceFromUrl(input.url) ?? "ebay";

  return normalizeListing({
    marketplace,
    sourceListingId: `manual-${nanoid(10)}`,
    url: input.url,
    title: input.title,
    imageUrl: null,
    price:
      input.priceAmount !== null
        ? { amount: input.priceAmount, currency: input.currency }
        : null,
    shippingCost: null,
    shippingKnown: false,
    condition: "unknown",
    location: null,
    listingType: "unknown",
    publishedAt: null,
    retrievedAt: new Date().toISOString(),
    dataOrigin: "manual",
  });
}
