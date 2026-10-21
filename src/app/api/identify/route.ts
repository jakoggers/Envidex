import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMaxUploadBytes } from "@/lib/config";
import { sanitizeImageUpload } from "@/lib/image-pipeline";
import { buildObjectKey, deletePrivateObject, writePrivateObject } from "@/lib/media-store";
import { getMongoClientPromise } from "@/lib/mongodb";
import type { InferenceResultDoc, MediaDoc } from "@/lib/models";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthedUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SpeciesResultSchema = z.object({
  commonName: z.string(),
  scientificName: z.string(),
  kingdom: z.enum(["Animalia", "Plantae", "Fungi", "Other"]),
  class: z.string(),
  conservationStatus: z.enum(["EX", "EW", "CR", "EN", "VU", "NT", "LC", "DD", "NE"]),
  population: z.string(),
  habitat: z.array(z.string()),
  range: z.string(),
  diet: z.string().optional(),
  description: z.string(),
  threats: z.array(z.string()),
  howToHelp: z.array(z.string()),
  funFacts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  isIdentifiable: z.boolean(),
  notIdentifiableReason: z.string().optional(),
});

/**
 * Explicit opt-in Anthropic identify path.
 * Never used as a silent fallback for local Keras.
 */
export async function POST(req: NextRequest) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "External AI identify is not configured" },
      { status: 503 }
    );
  }

  const rl = rateLimit(`identify:${authed.user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { imageData?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.imageData || typeof body.imageData !== "string") {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const base64Data = body.imageData.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
  let raw: Buffer;
  try {
    raw = Buffer.from(base64Data, "base64");
  } catch {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }

  if (raw.length > getMaxUploadBytes()) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const sanitized = await sanitizeImageUpload(raw);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.status });
  }

  const storageKey = buildObjectKey(authed.user.id, "jpg");
  let mediaId: string | null = null;

  try {
    await writePrivateObject(storageKey, sanitized.image.buffer);
    const client = await getMongoClientPromise();
    const db = client.db();
    const mediaInsert = await db.collection<MediaDoc>("media").insertOne({
      ownerId: authed.user.id,
      storageKey,
      contentType: sanitized.image.contentType,
      byteSize: sanitized.image.buffer.length,
      width: sanitized.image.width,
      height: sanitized.image.height,
      observationId: null,
      createdAt: new Date(),
    });
    mediaId = mediaInsert.insertedId.toString();

    const result = await generateText({
      model: anthropic("claude-sonnet-4.6"),
      experimental_output: Output.object({ schema: SpeciesResultSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: sanitized.image.buffer.toString("base64"),
            },
            {
              type: "text",
              text: `You are a world-class wildlife biologist and botanist. Analyze this image and identify the species shown.

If you can identify a specific animal or plant species, provide accurate information about it. If the image shows something that is NOT a clearly identifiable wild species (e.g., a domestic animal, human, object, or unclear image), set isIdentifiable to false.

For conservation status, use the IUCN Red List categories:
- EX (Extinct), EW (Extinct in Wild), CR (Critically Endangered), EN (Endangered), VU (Vulnerable), NT (Near Threatened), LC (Least Concern), DD (Data Deficient), NE (Not Evaluated)

Never invent populations or citations. If unknown, say unknown and use NE.
Provide 3-4 specific, actionable ways people can help this species when identifiable. Include up to 3 fun facts only when confident.`,
            },
          ],
        },
      ],
    });

    const data = result.experimental_output;
    if (!data) {
      throw new Error("No structured output");
    }

    const label = data.scientificName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "");

    const inference: InferenceResultDoc = {
      ownerId: authed.user.id,
      source: "anthropic",
      label,
      commonName: data.commonName,
      scientificName: data.scientificName,
      score: data.confidence,
      modelVersion: "claude-sonnet-4.6",
      mediaId,
      createdAt: new Date(),
    };
    const inserted = await db.collection<InferenceResultDoc>("inferenceResults").insertOne(inference);

    return NextResponse.json({
      ...data,
      id: label.replace(/_/g, "-"),
      resultId: inserted.insertedId.toString(),
      mediaId,
      source: "anthropic",
      score: data.confidence,
      scoreLabel: "model score (uncalibrated)",
    });
  } catch (error) {
    console.error("Species identification error:", error instanceof Error ? error.name : "error");
    if (mediaId) {
      try {
        const client = await getMongoClientPromise();
        await client.db().collection("media").deleteOne({ _id: new ObjectId(mediaId) });
        await deletePrivateObject(storageKey);
      } catch {
        // best-effort
      }
    }
    return NextResponse.json({ error: "Failed to identify species" }, { status: 500 });
  }
}
