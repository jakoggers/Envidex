import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  getMaxUploadBytes,
  getModelVersion,
  getPredictTimeoutMs,
  getPredictionApiBaseUrl,
} from "@/lib/config";
import { sanitizeImageUpload } from "@/lib/image-pipeline";
import { buildObjectKey, deletePrivateObject, writePrivateObject } from "@/lib/media-store";
import { getMongoClientPromise } from "@/lib/mongodb";
import type { InferenceResultDoc, MediaDoc } from "@/lib/models";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthedUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const upstreamSchema = z.object({
  label: z.string().min(1).optional(),
  common_name: z.string().min(1).optional(),
  scientific_name: z.string().min(1),
  score: z.number().min(0).max(1),
  model_version: z.string().optional(),
  source: z.string().optional(),
  // Legacy shape tolerance (do not treat as calibrated %)
  confidence: z.number().optional(),
});

function publicError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuthedUser(request);
  if ("error" in authed) return authed.error;

  const rl = rateLimit(`predict:${authed.user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return publicError(400, "Invalid multipart body");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return publicError(400, "Missing file upload in field 'file'");
  }

  if (file.size > getMaxUploadBytes()) {
    return publicError(413, "Image too large");
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const sanitized = await sanitizeImageUpload(raw, file.type);
  if (!sanitized.ok) {
    return publicError(sanitized.status, sanitized.error);
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

    const upstreamForm = new FormData();
    upstreamForm.append(
      "file",
      new Blob([new Uint8Array(sanitized.image.buffer)], {
        type: sanitized.image.contentType,
      }),
      "frame.jpg"
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), getPredictTimeoutMs());

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(`${getPredictionApiBaseUrl()}/predict`, {
        method: "POST",
        body: upstreamForm,
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      if (mediaId) {
        await db.collection("media").deleteOne({ _id: new ObjectId(mediaId) });
        await deletePrivateObject(storageKey);
      }
      return publicError(502, "Prediction service unavailable");
    } finally {
      clearTimeout(timer);
    }

    const rawText = await upstreamRes.text();
    if (!upstreamRes.ok) {
      if (mediaId) {
        await db.collection("media").deleteOne({ _id: new ObjectId(mediaId) });
        await deletePrivateObject(storageKey);
      }
      if (upstreamRes.status === 413 || upstreamRes.status === 400) {
        return publicError(upstreamRes.status, "Invalid image");
      }
      if (upstreamRes.status === 503) {
        return publicError(503, "Prediction model unavailable");
      }
      return publicError(502, "Prediction failed");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      if (mediaId) {
        await db.collection("media").deleteOne({ _id: new ObjectId(mediaId) });
        await deletePrivateObject(storageKey);
      }
      return publicError(502, "Prediction failed");
    }

    const validated = upstreamSchema.safeParse(parsedJson);
    if (!validated.success) {
      if (mediaId) {
        await db.collection("media").deleteOne({ _id: new ObjectId(mediaId) });
        await deletePrivateObject(storageKey);
      }
      return publicError(502, "Prediction failed");
    }

    const data = validated.data;
    let score = data.score;
    if (typeof data.confidence === "number" && (score === undefined || Number.isNaN(score))) {
      score = data.confidence > 1 ? data.confidence / 100 : data.confidence;
    }
    if (typeof score !== "number" || Number.isNaN(score)) {
      if (mediaId) {
        await db.collection("media").deleteOne({ _id: new ObjectId(mediaId) });
        await deletePrivateObject(storageKey);
      }
      return publicError(502, "Prediction failed");
    }

    const label =
      data.label ??
      data.scientific_name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    const commonName = data.common_name ?? label.replace(/_/g, " ");
    const modelVersion = data.model_version ?? getModelVersion();

    const inference: InferenceResultDoc = {
      ownerId: authed.user.id,
      source: "local-keras",
      label,
      commonName,
      scientificName: data.scientific_name,
      score,
      modelVersion,
      mediaId,
      createdAt: new Date(),
    };

    const inserted = await db.collection<InferenceResultDoc>("inferenceResults").insertOne(inference);

    return NextResponse.json({
      resultId: inserted.insertedId.toString(),
      mediaId,
      label,
      commonName,
      scientificName: data.scientific_name,
      score,
      modelVersion,
      source: "local-keras",
      scoreLabel: "model score (uncalibrated)",
    });
  } catch {
    if (mediaId) {
      try {
        const client = await getMongoClientPromise();
        await client.db().collection("media").deleteOne({ _id: new ObjectId(mediaId) });
        await deletePrivateObject(storageKey);
      } catch {
        // best-effort cleanup
      }
    }
    return publicError(502, "Prediction service unavailable");
  }
}
