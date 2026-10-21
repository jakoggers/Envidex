import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getMongoClientPromise } from "@/lib/mongodb";
import type { InferenceResultDoc, MediaDoc, ObservationDoc, SpeciesDoc } from "@/lib/models";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthedUser } from "@/lib/session";
import { resolveSpeciesForPrediction } from "@/lib/species-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const saveSchema = z.object({
  inferenceResultId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const client = await getMongoClientPromise();
  const db = client.db();

  const filter: Record<string, unknown> = { ownerId: authed.user.id };
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) createdAt.$lte = new Date(to);
    filter.createdAt = createdAt;
  }

  const observations = await db
    .collection<ObservationDoc>("observations")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const speciesIds = [...new Set(observations.map((o) => o.speciesId))];
  const speciesDocs = await db
    .collection<SpeciesDoc>("species")
    .find({ key: { $in: speciesIds } })
    .toArray();
  const speciesByKey = new Map(speciesDocs.map((s) => [s.key, s]));

  let items = observations.map((o) => {
    const species = speciesByKey.get(o.speciesId);
    return {
      id: (o._id as ObjectId).toString(),
      speciesId: o.speciesId,
      inferenceResultId: o.inferenceResultId,
      imageId: o.imageId,
      imageUrl: `/api/media/${o.imageId}`,
      createdAt: o.createdAt,
      visibility: o.visibility,
      species: species
        ? {
            id: species.key,
            commonName: species.commonName,
            scientificName: species.scientificName,
            conservationStatus: species.conservationStatus,
            habitat: species.habitat,
            description: species.description,
            verification: species.verification,
            imageUrl: species.imageUrl,
          }
        : null,
    };
  });

  if (q) {
    items = items.filter((item) => {
      const name = item.species?.commonName?.toLowerCase() ?? "";
      const sci = item.species?.scientificName?.toLowerCase() ?? "";
      return name.includes(q) || sci.includes(q) || item.speciesId.toLowerCase().includes(q);
    });
  }

  return NextResponse.json({ observations: items });
}

export async function POST(req: NextRequest) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  const rl = rateLimit(`obs:save:${authed.user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let inferenceOid: ObjectId;
  try {
    inferenceOid = new ObjectId(parsed.data.inferenceResultId);
  } catch {
    return NextResponse.json({ error: "Invalid inference result" }, { status: 400 });
  }

  const client = await getMongoClientPromise();
  const db = client.db();

  const inference = await db.collection<InferenceResultDoc>("inferenceResults").findOne({
    _id: inferenceOid,
  });

  if (!inference || inference.ownerId !== authed.user.id) {
    return NextResponse.json({ error: "Inference result not found" }, { status: 404 });
  }

  // Idempotent save: one observation per inference result for this owner.
  const existing = await db.collection<ObservationDoc>("observations").findOne({
    ownerId: authed.user.id,
    inferenceResultId: parsed.data.inferenceResultId,
  });
  if (existing) {
    return NextResponse.json({
      id: (existing._id as ObjectId).toString(),
      idempotent: true,
    });
  }

  if (!inference.mediaId) {
    return NextResponse.json({ error: "Inference has no image" }, { status: 400 });
  }

  let mediaOid: ObjectId;
  try {
    mediaOid = new ObjectId(inference.mediaId);
  } catch {
    return NextResponse.json({ error: "Invalid media" }, { status: 400 });
  }

  const media = await db.collection<MediaDoc>("media").findOne({ _id: mediaOid });
  if (!media || media.ownerId !== authed.user.id) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const { speciesId } = await resolveSpeciesForPrediction(db, {
    label: inference.label,
    scientificName: inference.scientificName,
    commonName: inference.commonName,
  });

  const now = new Date();
  const observation: ObservationDoc = {
    ownerId: authed.user.id,
    speciesId,
    inferenceResultId: parsed.data.inferenceResultId,
    imageId: inference.mediaId,
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db.collection<ObservationDoc>("observations").insertOne(observation);
  const observationId = inserted.insertedId.toString();

  await db.collection("media").updateOne(
    { _id: mediaOid },
    { $set: { observationId } }
  );

  return NextResponse.json({ id: observationId, speciesId, idempotent: false });
}
