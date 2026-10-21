"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Search, Trash2, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { ConservationStatus } from "@/lib/types";

type ObservationItem = {
  id: string;
  speciesId: string;
  imageUrl: string;
  createdAt: string;
  species: {
    id: string;
    commonName: string;
    scientificName: string;
    conservationStatus: ConservationStatus;
    habitat: string[];
    description: string;
    verification?: { source: string; verified: boolean };
  } | null;
};

export default function CollectionPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ObservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`/api/observations?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not load field guide");
      }
      setItems(data.observations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load field guide");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      void load();
    }
  }, [status, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = item.species?.commonName?.toLowerCase() ?? "";
      const sci = item.species?.scientificName?.toLowerCase() ?? "";
      return name.includes(q) || sci.includes(q);
    });
  }, [items, query]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/observations/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      }
      setItems((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-4 pt-10 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Field Guide</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Private observations saved on the server — not shared device storage.
        </p>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-2xl border border-border/50 bg-card/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary/50"
          />
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-border/40 bg-card/40 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Saved observations
          </span>
          <span className="text-xs font-bold text-primary">{filtered.length}</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading observations…
        </div>
      )}

      {error && (
        <p className="px-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {deleteError && (
        <p className="px-4 pb-2 text-sm text-red-400" role="alert">
          Delete failed: {deleteError}
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="px-4 flex-1 flex flex-col items-center justify-center gap-4 py-16">
          <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center">
            <Search className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm mb-1">Nothing saved yet</p>
            <p className="text-xs text-muted-foreground">
              Identify a mammal and tap Save private to add it here.
            </p>
          </div>
          <Link
            href="/live-feed"
            className="flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground py-3 px-6 font-semibold text-sm"
          >
            Start Identifying
          </Link>
        </div>
      )}

      <div className="px-4 pb-8 space-y-3">
        {filtered.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden"
          >
            <Link href={`/collection/${item.id}`} className="block">
              <div className="aspect-[16/10] bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.species?.commonName ?? "Observation"}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-3 space-y-1">
                <p className="font-bold text-base">{item.species?.commonName ?? "Unknown"}</p>
                <p className="text-[11px] text-muted-foreground italic">
                  {item.species?.scientificName}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  {item.species?.conservationStatus && (
                    <StatusBadge status={item.species.conservationStatus} size="sm" />
                  )}
                  {item.species?.verification && !item.species.verification.verified && (
                    <span className="text-[10px] text-muted-foreground">unverified catalog</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Saved{" "}
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </Link>
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 text-red-400 py-2 text-xs font-medium disabled:opacity-50"
              >
                {deletingId === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete observation
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
