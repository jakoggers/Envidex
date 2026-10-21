"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { ConservationStatus } from "@/lib/types";

type Detail = {
  id: string;
  imageUrl: string;
  createdAt: string;
  species: {
    commonName: string;
    scientificName: string;
    conservationStatus: ConservationStatus;
    population: string;
    habitat: string[];
    description: string;
    threats: string[];
    howToHelp: string[];
    funFacts: string[];
    range: string;
    verification?: { source: string; verified: boolean; notes?: string };
  } | null;
  inference: {
    source: string;
    score: number;
    modelVersion: string | null;
    scoreLabel: string;
  } | null;
};

export default function ObservationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/observations/${params.id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Not found");
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/observations/${params.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      router.replace("/collection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen px-4 pt-10">
        <button type="button" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm text-red-400">{error ?? "Not found"}</p>
      </div>
    );
  }

  const species = detail.species;

  return (
    <div className="min-h-screen px-4 pt-10 pb-24 space-y-4">
      <button
        type="button"
        onClick={() => router.push("/collection")}
        className="h-9 w-9 rounded-full border border-border/60 bg-card/60 flex items-center justify-center text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="rounded-3xl overflow-hidden aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={detail.imageUrl}
          alt={species?.commonName ?? "Observation"}
          className="h-full w-full object-cover"
        />
      </div>

      <div>
        <h1 className="text-2xl font-black">{species?.commonName ?? "Observation"}</h1>
        <p className="text-sm italic text-muted-foreground">{species?.scientificName}</p>
      </div>

      {species?.conservationStatus && <StatusBadge status={species.conservationStatus} />}

      {detail.inference && (
        <p className="text-xs text-muted-foreground">
          Inference: {detail.inference.source}
          {detail.inference.modelVersion ? ` · ${detail.inference.modelVersion}` : ""} · score{" "}
          {(detail.inference.score * 100).toFixed(1)}% ({detail.inference.scoreLabel})
        </p>
      )}

      {species?.verification && !species.verification.verified && (
        <p className="text-xs text-amber-500/90">
          Catalog facts are unverified for this model label
          {species.verification.notes ? ` — ${species.verification.notes}` : ""}.
        </p>
      )}

      {species?.description && (
        <section>
          <h2 className="text-sm font-semibold mb-1">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{species.description}</p>
        </section>
      )}

      {species?.habitat?.length ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Habitat</h2>
          <p className="text-sm text-muted-foreground">{species.habitat.join(", ")}</p>
        </section>
      ) : null}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 text-red-400 py-3 text-sm font-medium disabled:opacity-50"
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Delete observation
      </button>
    </div>
  );
}
