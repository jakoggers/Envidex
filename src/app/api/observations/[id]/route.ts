import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMongoClientPromise } from "@/lib/mongodb";
import type { ObservationDoc, SpeciesDoc, InferenceResultDoc } from "@/lib/models";
import { deletePrivateObject } from "@/lib/media-store";
import { requireAuthedUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  const { id } = await ctx.params;
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = await getMongoClientPromise();
  const db = client.db();
  const observation = await db.collection<ObservationDoc>("observations").findOne({ _id: oid });

  if (!observation || observation.ownerId !== authed.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const species = await db.collection<SpeciesDoc>("species").findOne({ key: observation.speciesId });
  let inference = null;
  try {
    inference = await db.collection<InferenceResultDoc>("inferenceResults").findOne({
      _id: new ObjectId(observation.inferenceResultId),
    });
  } catch {
    inference = null;
  }

  return NextResponse.json({
    id: oid.toString(),
    speciesId: observation.speciesId,
    inferenceResultId: observation.inferenceResultId,
    imageId: observation.imageId,
    imageUrl: `/api/media/${observation.imageId}`,
    createdAt: observation.createdAt,
    visibility: observation.visibility,
    species: species
      ? {
          id: species.key,
          commonName: species.commonName,
          scientificName: species.scientificName,
          kingdom: species.kingdom,
          class: species.class,
          habitat: species.habitat,
          conservationStatus: species.conservationStatus,
          population: species.population,
          description: species.description,
          threats: species.threats,
          howToHelp: species.howToHelp,
          funFacts: species.funFacts,
          range: species.range,
          diet: species.diet,
          imageUrl: species.imageUrl,
          verification: species.verification,
        }
      : null,
    inference: inference
      ? {
          source: inference.source,
          score: inference.score,
          modelVersion: inference.modelVersion,
          label: inference.label,
          scoreLabel: "model score (uncalibrated)",
        }
      : null,
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  const { id } = await ctx.params;
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = await getMongoClientPromise();
  const db = client.db();
  const observation = await db.collection<ObservationDoc>("observations").findOne({ _id: oid });

  if (!observation || observation.ownerId !== authed.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const media = await db.collection("media").findOne({
      _id: new ObjectId(observation.imageId),
      ownerId: authed.user.id,
    });
    if (media && typeof media.storageKey === "string") {
      await deletePrivateObject(media.storageKey);
      await db.collection("media").deleteOne({ _id: media._id });
    }
  } catch {
    // continue with observation delete; surface failure if observation delete fails
  }

  const result = await db.collection("observations").deleteOne({
    _id: oid,
    ownerId: authed.user.id,
  });

  if (result.deletedCount !== 1) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
