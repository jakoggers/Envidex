import { getMongoClientPromise } from "@/lib/mongodb";
import { StatusBadge } from "@/components/status-badge";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ConservationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ScanRecord {
  shareId: string;
  userName: string;
  photoUrl: string;
  speciesData: {
    commonName: string;
    scientificName: string;
    conservationStatus: ConservationStatus;
    description: string;
    funFacts: string[];
    threats: string[];
    howToHelp: string[];
    confidence: number;
    population: string;
    habitat: string[];
    range: string;
  };
  createdAt: string;
}

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const client = await getMongoClientPromise();
  const db = client.db();
  const scan = await db.collection("scans").findOne({ shareId }) as ScanRecord | null;
  if (!scan) return { title: "Scan not found — Envidex" };
  return {
    title: `${scan.speciesData.commonName} — Envidex`,
    description: scan.speciesData.description,
    openGraph: {
      images: [scan.photoUrl],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const client = await getMongoClientPromise();
  const db = client.db();
  const scan = await db.collection("scans").findOne({ shareId }) as ScanRecord | null;

  if (!scan) notFound();

  const { speciesData, photoUrl, userName, createdAt } = scan;
  const date = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-4">
        <Link href="/" className="text-xs font-bold tracking-[0.2em] uppercase text-primary">
          Envidex
        </Link>
        <Link
          href="/live-feed"
          className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-full"
        >
          Try it yourself
        </Link>
      </div>

      <div className="px-4 flex flex-col gap-4 pb-10">
        {/* Photo card */}
        <div className="relative rounded-3xl overflow-hidden aspect-square bg-muted">
          <Image src={photoUrl} alt={speciesData.commonName} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-black text-white leading-tight">{speciesData.commonName}</h1>
            <p className="text-sm text-white/70 italic">{speciesData.scientificName}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between">
          <StatusBadge status={speciesData.conservationStatus} />
          <p className="text-[11px] text-muted-foreground">
            Found by <span className="font-semibold text-foreground">{userName}</span> · {date}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">{speciesData.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Population", value: speciesData.population },
            { label: "Range", value: speciesData.range },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/40 bg-card/40 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-xs font-semibold leading-snug">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Threats */}
        {speciesData.threats.length > 0 && (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Threats</p>
            <div className="flex flex-wrap gap-1.5">
              {speciesData.threats.map((t) => (
                <span key={t} className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fun facts */}
        {speciesData.funFacts.length > 0 && (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Did you know?</p>
            <div className="space-y-2">
              {speciesData.funFacts.map((fact, i) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  <span className="text-primary shrink-0 mt-0.5">★</span>
                  <span className="text-muted-foreground leading-relaxed">{fact}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How to help */}
        {speciesData.howToHelp.length > 0 && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-3">How to help</p>
            <div className="space-y-1.5">
              {speciesData.howToHelp.map((tip, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-primary shrink-0 mt-0.5">→</span>
                  <span className="text-muted-foreground leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/signup"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-4 font-semibold text-sm shadow-lg shadow-primary/20"
        >
          🦁 Identify species with Envidex
        </Link>
      </div>
    </div>
  );
}
