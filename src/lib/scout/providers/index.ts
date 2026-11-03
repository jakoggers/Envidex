import type { MarketplaceId } from "../types";
import type { MarketplaceProvider } from "./types";
import { ebayProvider } from "./ebay";
import { facebookProvider } from "./facebook";
import { offerupProvider } from "./offerup";

const providers: Record<MarketplaceId, MarketplaceProvider> = {
  ebay: ebayProvider,
  facebook: facebookProvider,
  offerup: offerupProvider,
};

export function getProvider(id: MarketplaceId): MarketplaceProvider {
  return providers[id];
}

export function getAllProviders(): MarketplaceProvider[] {
  return Object.values(providers);
}

export { ebayProvider, facebookProvider, offerupProvider };
