import type { Listing } from "@/lib/scout/types";

function formatMoney(
  money: { amount: number; currency: string } | null,
): string {
  if (!money) return "Price unknown";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: money.currency,
    }).format(money.amount);
  } catch {
    return `${money.currency} ${money.amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(t));
}

const originLabel: Record<Listing["dataOrigin"], string> = {
  live: "Live",
  manual: "Manual",
  demo: "Demo",
};

const marketplaceLabel: Record<Listing["marketplace"], string> = {
  ebay: "eBay",
  facebook: "Facebook Marketplace",
  offerup: "OfferUp",
};

export function ListingCard({ listing }: { listing: Listing }) {
  const published = formatDate(listing.publishedAt);
  const retrieved = formatDate(listing.retrievedAt);

  return (
    <article className="animate-scout-rise border-b border-border/80 py-5 first:pt-0">
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-secondary/80 sm:h-28 sm:w-28">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{marketplaceLabel[listing.marketplace]}</span>
            <span aria-hidden>·</span>
            <span
              className={
                listing.dataOrigin === "demo"
                  ? "font-semibold text-accent-foreground"
                  : undefined
              }
            >
              {originLabel[listing.dataOrigin]}
            </span>
            {listing.listingType === "auction" ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-destructive">Auction bid</span>
              </>
            ) : null}
          </div>

          <h3 className="font-[family-name:var(--font-space-grotesk)] text-base font-medium leading-snug text-foreground sm:text-lg">
            {listing.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-lg font-semibold tabular-nums">
              {listing.listingType === "auction" ? "Bid " : ""}
              {formatMoney(listing.price)}
            </span>
            <span className="text-muted-foreground">
              Shipping:{" "}
              {listing.shippingCost
                ? formatMoney(listing.shippingCost)
                : "unknown"}
            </span>
            <span className="tabular-nums text-primary">
              Known total:{" "}
              {listing.knownTotalPrice
                ? formatMoney(listing.knownTotalPrice)
                : "n/a"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Condition: {listing.condition}</span>
            {listing.location ? <span>{listing.location}</span> : null}
            {listing.distanceMiles !== null ? (
              <span>{listing.distanceMiles} mi</span>
            ) : null}
            {typeof listing.relevanceScore === "number" ? (
              <span title={listing.relevanceReasons?.join(" · ")}>
                Relevance {listing.relevanceScore}
              </span>
            ) : null}
          </div>

          <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {published ? <p>Published: {published}</p> : <p>Published: unknown</p>}
            {retrieved ? <p>Retrieved: {retrieved}</p> : null}
          </div>

          <div className="mt-3">
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Open listing
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
