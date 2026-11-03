import type { Listing, SearchFilters } from "./types";

const ACCESSORY_HINTS = [
  "case",
  "cover",
  "earpad",
  "ear pad",
  "earpads",
  "cushion",
  "cable",
  "charger",
  "stand",
  "mount",
  "parts",
  "part only",
  "replacement",
  "box only",
  "empty box",
  "skin",
  "protector",
  "adapter",
];

/**
 * Simple, explainable relevance:
 * - exact query phrase
 * - model-like tokens (alphanumeric with digits)
 * - required terms present
 * - excluded terms absent (already filtered, but score notes)
 * - accessory demotion when query looks like a primary product
 */
export function scoreListing(
  listing: Listing,
  filters: SearchFilters,
): { score: number; reasons: string[] } {
  const title = listing.title.toLowerCase();
  const query = filters.query.trim().toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if (!query) {
    return { score: 0, reasons: ["Empty query"] };
  }

  if (title.includes(query)) {
    score += 40;
    reasons.push("Exact query phrase in title");
  } else {
    const tokens = query.split(/\s+/).filter((t) => t.length > 1);
    const matched = tokens.filter((t) => title.includes(t));
    const ratio = tokens.length ? matched.length / tokens.length : 0;
    score += Math.round(ratio * 25);
    if (matched.length) {
      reasons.push(`Matched ${matched.length}/${tokens.length} query tokens`);
    }
  }

  const modelTokens = extractModelTokens(query);
  for (const model of modelTokens) {
    if (title.includes(model.toLowerCase())) {
      score += 20;
      reasons.push(`Model token “${model}” present`);
    } else {
      score -= 15;
      reasons.push(`Missing model token “${model}”`);
    }
  }

  for (const term of filters.requiredTerms) {
    if (title.includes(term.toLowerCase())) {
      score += 10;
      reasons.push(`Required term “${term}” present`);
    } else {
      score -= 30;
      reasons.push(`Missing required term “${term}”`);
    }
  }

  for (const term of filters.excludedTerms) {
    if (title.includes(term.toLowerCase())) {
      score -= 40;
      reasons.push(`Excluded term “${term}” present`);
    }
  }

  const looksLikeAccessory = ACCESSORY_HINTS.some((hint) => title.includes(hint));
  const queryIsAccessory = ACCESSORY_HINTS.some((hint) => query.includes(hint));
  if (looksLikeAccessory && !queryIsAccessory && modelTokens.length > 0) {
    score -= 25;
    reasons.push("Likely accessory / parts listing demoted");
  }

  if (listing.listingType === "auction") {
    score -= 2;
    reasons.push("Auction (bid is not a buy-it-now price)");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}

export function extractModelTokens(query: string): string[] {
  return query
    .split(/[\s,/|]+/)
    .map((t) => t.trim())
    .filter((t) => /[A-Za-z]/.test(t) && /\d/.test(t) && t.length >= 3);
}

export function applyRelevance(
  listings: Listing[],
  filters: SearchFilters,
): Listing[] {
  return listings.map((listing) => {
    const { score, reasons } = scoreListing(listing, filters);
    return { ...listing, relevanceScore: score, relevanceReasons: reasons };
  });
}
