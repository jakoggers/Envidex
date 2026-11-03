"use client";

import { useEffect, useState } from "react";
import { ListingCard } from "./listing-card";
import type { Listing, MarketplaceId } from "@/lib/scout/types";

const STORAGE_KEY = "secondhand-scout-bookmarks-v1";

export function BookmarksApp() {
  const [bookmarks, setBookmarks] = useState<Listing[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [marketplace, setMarketplace] = useState<MarketplaceId | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBookmarks(JSON.parse(raw) as Listing[]);
    } catch {
      setBookmarks([]);
    }
  }, []);

  const persist = (next: Listing[]) => {
    setBookmarks(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          title,
          priceAmount: price === "" ? null : Number(price),
          currency,
          marketplace: marketplace || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not save bookmark");
      }
      persist([data.listing as Listing, ...bookmarks]);
      setUrl("");
      setTitle("");
      setPrice("");
      setMarketplace("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    persist(bookmarks.filter((b) => b.sourceListingId !== id));
  };

  return (
    <div className="space-y-8">
      <section className="animate-scout-rise max-w-2xl">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl font-semibold text-primary">
          Manual bookmarks
        </h1>
        <p className="mt-3 text-muted-foreground">
          Save a listing by pasting its URL, title, and price. This never fetches
          the remote page — useful when a marketplace has no live integration.
        </p>
      </section>

      <form
        onSubmit={onSave}
        className="animate-scout-rise grid max-w-2xl gap-4 border-t border-border pt-6"
      >
        <label>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Listing URL
          </span>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.ebay.com/itm/..."
            className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Title
          </span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Price
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Currency
            </span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 uppercase outline-none ring-ring focus:ring-2"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Marketplace
            </span>
            <select
              value={marketplace}
              onChange={(e) =>
                setMarketplace(e.target.value as MarketplaceId | "")
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-3 outline-none ring-ring focus:ring-2"
            >
              <option value="">Infer from URL</option>
              <option value="ebay">eBay</option>
              <option value="facebook">Facebook</option>
              <option value="offerup">OfferUp</option>
            </select>
          </label>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 w-fit items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save bookmark"}
        </button>
      </form>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold">
          Saved ({bookmarks.length})
        </h2>
        {bookmarks.length === 0 ? (
          <p className="text-muted-foreground">No bookmarks yet.</p>
        ) : (
          <div>
            {bookmarks.map((listing) => (
              <div key={listing.sourceListingId}>
                <ListingCard listing={listing} />
                <button
                  type="button"
                  onClick={() => remove(listing.sourceListingId)}
                  className="mb-4 text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
