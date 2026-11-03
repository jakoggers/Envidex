# Secondhand Scout

Search secondhand marketplaces from one interface. Enter an item (for example `Sony WH-1000XM4`), optionally set budget, location, condition, and keyword filters, then review normalized listings with links to the originals.

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Zod, Node.js server routes.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm test` | Focused unit tests |
| `npm run typecheck` | TypeScript check |

## Environment

Copy `.env.example` to `.env.local` and fill in values as needed:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `EBAY_CLIENT_ID` | For live eBay | eBay developer application client id |
| `EBAY_CLIENT_SECRET` | For live eBay | eBay developer application client secret |
| `EBAY_ENV` | No | `sandbox` or `production` (default `production`) |
| `EBAY_MARKETPLACE_ID` | No | Browse API marketplace header (default `EBAY_US`) |
| `PROVIDER_TIMEOUT_MS` | No | Per-provider timeout (default `12000`) |

Without eBay credentials the eBay source returns `not_configured` with an “Open search on eBay” fallback link. Facebook Marketplace and OfferUp always return `unavailable` with fallback links (see below).

**Demo mode** is an explicit UI/API flag (`demoMode=1`). It returns labeled fixture listings and is never used as a silent substitute for failed live requests.

## Source capabilities

### eBay (live — official Browse API)

| | |
|---|---|
| Integration | Official [Buy Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html) `item_summary/search` |
| Auth | OAuth **client credentials** application token (`https://api.ebay.com/oauth/api_scope`), cached server-side until ~2 minutes before expiry |
| Environments | `EBAY_ENV=sandbox` → `api.sandbox.ebay.com`; `production` → `api.ebay.com` |
| Applied filters | Keywords (`q`), price range + currency, condition (`USED` or refurbished `conditionIds`), sort (`price` / `newlyListed` / Best Match) |
| Partial support | US ZIP via `buyerPostalCode` / end-user context for shipping estimates — **seller distance radius is not applied** by this Browse search integration |
| Listing types | Fixed-price vs auction distinguished via `buyingOptions`; auction current bids are **not** treated as purchase totals |
| Pagination | `limit`/`offset` cursors (page size 50) |
| Caching | ~60s in-memory response cache |
| Rate limits | Application quotas vary; HTTP 429 honored with bounded backoff. See eBay Developer Analytics for your app’s limits |
| Setup errors | Missing credentials → `not_configured`. 401/403 → actionable message about keys, scope, or production Browse API approval |

**Access requirements:** eBay developer account, application keys, Browse API enabled. Production Browse API access may require additional eBay approval beyond creating keys.

### Facebook Marketplace (unavailable — honest fallback)

| | |
|---|---|
| Public consumer search API | **None** |
| Related Meta APIs | Meta Content Library Marketplace endpoints are **research-only** (approved organizations). Marketplace Partnerships APIs distribute seller inventory — they do not search buyer listings |
| Scraping | Not implemented. Login walls / CAPTCHA are not bypassed |
| Status | `unavailable` |
| Fallback | Verified URL: `https://www.facebook.com/marketplace/search/?query=...` (keywords only). Location, distance, and price must be set in Facebook’s UI — those filters are **not** documented as stable public query parameters |

### OfferUp (unavailable — honest fallback)

| | |
|---|---|
| Public developer API | **None** |
| Third-party scrapers | Not used (not an approved OfferUp integration) |
| Status | `unavailable` |
| Fallback | Verified public URL shape: `https://offerup.com/search?q=...` with optional `radius`, `PRICE_MIN`, `PRICE_MAX`, `CONDITION`, `SORT`. ZIP/location is typically session/geo-based on OfferUp and is **not** invented as a query parameter |

Fallback links are navigation aids, **not** retrieved listings. Integrations are only labeled complete when they actually retrieve data (eBay when configured).

## Application behavior

- **URL state:** Search filters sync into the query string so searches are bookmarkable (`q`, `minPrice`, `maxPrice`, `currency`, `location`, `radiusMiles`, `condition`, `marketplaces`, `requiredTerms`, `excludedTerms`, `sort`, `demoMode`).
- **Normalization:** One listing model with nulls preserved. Unknown shipping ≠ free. Retrieval time ≠ publication time. Auction bids ≠ buy prices. Known total only when price + shipping are both known in the same currency.
- **Deduplication:** Exact matches by `marketplace + sourceListingId` or canonical URL — not by similar titles.
- **Relevance:** Explainable score from exact phrases, model tokens, required/excluded terms, and accessory demotion.
- **Sort scope:** Sorting applies to **fetched results only** and is labeled in the UI. Lowest-total sort separates known totals, unknown shipping, and auctions. Currencies are not converted.
- **Reliability:** Providers run concurrently with bounded concurrency and per-provider timeouts. One failure returns partial results. Per-source statuses: `success`, `not_configured`, `unavailable`, `rate_limited`, `timeout`, `error`, `skipped`.
- **Security:** Credentials stay server-side and out of logs. Manual bookmark saves validate allowlisted hosts and **do not fetch** remote pages (no SSRF). Listing text is sanitized for display.
- **Manual bookmarks:** `/bookmarks` — enter URL, title, and price. Stored in browser `localStorage` after server-side validation.

## API routes

| Route | Method | Description |
|---|---|---|
| `/api/search` | GET/POST | Run multi-provider search |
| `/api/bookmarks` | POST | Validate/normalize a manual bookmark (no remote fetch) |
| `/api/providers` | GET | Provider capability + configuration status |

## Verification notes

- **Unit tests** (`npm test`) cover normalization, unknown shipping, auctions, filtering, deduplication, relevance demotion, sort bucketing, partial provider failure, and fallback URL shapes.
- **Live eBay verification** requires valid `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` with Browse API access. Without credentials, live eBay retrieval remains **unverified** in this environment; the adapter still returns structured `not_configured` / auth errors and fallback links.
- Facebook Marketplace and OfferUp live retrieval are **intentionally unavailable** and verified as such (status + fallback only).
