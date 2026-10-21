import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMongoClientPromise } from "@/lib/mongodb";
import type { MediaDoc } from "@/lib/models";
import { readPrivateObject } from "@/lib/media-store";
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
  const media = await db.collection<MediaDoc>("media").findOne({ _id: oid });

  if (!media || media.ownerId !== authed.user.id) {
    // Same response for missing and unauthorized — no ID oracle.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bytes = await readPrivateObject(media.storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": media.contentType || "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
