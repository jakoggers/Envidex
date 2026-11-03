import type { SourceStatus } from "@/lib/scout/types";

const statusTone: Record<SourceStatus["status"], string> = {
  success: "text-primary",
  partial: "text-accent-foreground",
  not_configured: "text-muted-foreground",
  unavailable: "text-muted-foreground",
  rate_limited: "text-destructive",
  timeout: "text-destructive",
  error: "text-destructive",
  skipped: "text-muted-foreground",
};

const marketplaceLabel: Record<SourceStatus["marketplace"], string> = {
  ebay: "eBay",
  facebook: "Facebook Marketplace",
  offerup: "OfferUp",
};

export function SourceStatusPanel({ sources }: { sources: SourceStatus[] }) {
  if (!sources.length) return null;

  return (
    <section className="animate-scout-rise space-y-3" aria-label="Source statuses">
      <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Sources
      </h2>
      <ul className="space-y-3">
        {sources.map((source) => (
          <li
            key={source.marketplace}
            className="border-l-2 border-primary/30 pl-3"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">
                {marketplaceLabel[source.marketplace]}
              </span>
              <span
                className={`text-xs uppercase tracking-wider ${statusTone[source.status]}`}
              >
                {source.status.replaceAll("_", " ")}
              </span>
              {source.latencyMs !== null ? (
                <span className="text-xs text-muted-foreground">
                  {source.latencyMs}ms
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {source.resultCount} listing{source.resultCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{source.message}</p>
            {source.warning ? (
              <p className="mt-1 text-sm text-accent-foreground">{source.warning}</p>
            ) : null}
            {source.appliedFilters.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {source.appliedFilters.map((f) => (
                  <li key={`${source.marketplace}-${f.filter}`}>
                    <span className="font-medium text-foreground/80">
                      {f.filter}:
                    </span>{" "}
                    {f.applied ? "applied" : "not applied"} — {f.detail}
                  </li>
                ))}
              </ul>
            ) : null}
            {source.fallbackSearchUrl ? (
              <a
                href={source.fallbackSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open search on {marketplaceLabel[source.marketplace]}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
