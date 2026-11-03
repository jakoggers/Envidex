import { z } from "zod";
import type { MarketplaceId, SearchFilters } from "./types";

export const MARKETPLACES = ["ebay", "facebook", "offerup"] as const;

const marketplaceSchema = z.enum(MARKETPLACES);

const termListSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    const raw = Array.isArray(value) ? value.join(",") : value ?? "";
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  });

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  });

const booleanish = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (value === undefined) return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

export const searchFiltersSchema = z
  .object({
    query: z.string().trim().min(1, "Item keywords are required").max(200),
    minPrice: optionalNumber,
    maxPrice: optionalNumber,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code")
      .default("USD"),
    location: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    radiusMiles: optionalNumber,
    condition: z.enum(["any", "used", "refurbished"]).default("any"),
    marketplaces: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => {
        const raw = Array.isArray(value)
          ? value
          : (value ?? "ebay,facebook,offerup").split(",");
        const parsed = raw
          .map((v) => v.trim().toLowerCase())
          .filter((v): v is MarketplaceId =>
            (MARKETPLACES as readonly string[]).includes(v),
          );
        return parsed.length > 0 ? parsed : ([...MARKETPLACES] as MarketplaceId[]);
      }),
    requiredTerms: termListSchema,
    excludedTerms: termListSchema,
    sort: z.enum(["relevance", "lowest_total", "newest"]).default("relevance"),
    demoMode: booleanish,
  })
  .superRefine((data, ctx) => {
    if (
      data.minPrice !== null &&
      data.maxPrice !== null &&
      data.minPrice > data.maxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum price cannot exceed maximum price",
        path: ["minPrice"],
      });
    }
    if (data.location && !/^[A-Za-z0-9\s\-,]{2,40}$/.test(data.location)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Location must be a ZIP or short place name",
        path: ["location"],
      });
    }
    if (data.radiusMiles !== null && (data.radiusMiles < 1 || data.radiusMiles > 500)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Radius must be between 1 and 500 miles",
        path: ["radiusMiles"],
      });
    }
  });

export function parseSearchFilters(
  input: Record<string, unknown>,
): SearchFilters {
  const parsed = searchFiltersSchema.parse(input);
  return {
    query: parsed.query,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    currency: parsed.currency,
    location: parsed.location,
    radiusMiles: parsed.radiusMiles,
    condition: parsed.condition,
    marketplaces: parsed.marketplaces,
    requiredTerms: parsed.requiredTerms,
    excludedTerms: parsed.excludedTerms,
    sort: parsed.sort,
    demoMode: parsed.demoMode,
  };
}

const ALLOWED_HOSTS = new Set([
  "www.ebay.com",
  "ebay.com",
  "www.ebay.co.uk",
  "ebay.co.uk",
  "www.facebook.com",
  "facebook.com",
  "m.facebook.com",
  "www.offerup.com",
  "offerup.com",
]);

export const manualBookmarkSchema = z.object({
  url: z
    .string()
    .trim()
    .url("A valid listing URL is required")
    .refine((value) => {
      try {
        const u = new URL(value);
        return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname.toLowerCase());
      } catch {
        return false;
      }
    }, "URL must be an https link to eBay, Facebook Marketplace, or OfferUp"),
  title: z.string().trim().min(1).max(300),
  priceAmount: optionalNumber,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .default("USD"),
  marketplace: marketplaceSchema.nullable().optional().default(null),
});

export function inferMarketplaceFromUrl(url: string): MarketplaceId | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("ebay.")) return "ebay";
    if (host.includes("facebook.") || host.includes("fb.")) return "facebook";
    if (host.includes("offerup.")) return "offerup";
    return null;
  } catch {
    return null;
  }
}

export function filtersToSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("q", filters.query);
  if (filters.minPrice !== null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.currency !== "USD") params.set("currency", filters.currency);
  if (filters.location) params.set("location", filters.location);
  if (filters.radiusMiles !== null) params.set("radiusMiles", String(filters.radiusMiles));
  if (filters.condition !== "any") params.set("condition", filters.condition);
  params.set("marketplaces", filters.marketplaces.join(","));
  if (filters.requiredTerms.length) {
    params.set("requiredTerms", filters.requiredTerms.join(","));
  }
  if (filters.excludedTerms.length) {
    params.set("excludedTerms", filters.excludedTerms.join(","));
  }
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.demoMode) params.set("demoMode", "1");
  return params;
}

export function searchParamsToFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): SearchFilters {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return params.get(key) ?? undefined;
    }
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return parseSearchFilters({
    query: get("q") ?? get("query") ?? "",
    minPrice: get("minPrice"),
    maxPrice: get("maxPrice"),
    currency: get("currency") ?? "USD",
    location: get("location"),
    radiusMiles: get("radiusMiles"),
    condition: get("condition") ?? "any",
    marketplaces: get("marketplaces"),
    requiredTerms: get("requiredTerms"),
    excludedTerms: get("excludedTerms"),
    sort: get("sort") ?? "relevance",
    // Accept demoMode (canonical) or legacy/short `demo`
    demoMode: get("demoMode") ?? get("demo"),
  });
}
