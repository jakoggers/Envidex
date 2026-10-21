import { getMongoClientPromise } from "@/lib/mongodb";
import { bumpTokenVersion, requireAuthedUser } from "@/lib/session";
import { deletePrivateObject } from "@/lib/media-store";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compare, hash } from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  const client = await getMongoClientPromise();
  const db = client.db();
  const user = await db.collection("users").findOne({ _id: new ObjectId(authed.user.id) });

  return NextResponse.json({ hasPassword: !!user?.passwordHash });
}

const nameSchema = z.object({
  type: z.literal("name"),
  name: z.string().min(1).max(64).trim(),
});

const emailSchema = z.object({
  type: z.literal("email"),
  email: z.string().email().trim().toLowerCase(),
  currentPassword: z.string().min(1),
});

const passwordSchema = z.object({
  type: z.literal("password"),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const updateSchema = z.discriminatedUnion("type", [nameSchema, emailSchema, passwordSchema]);

export async function PATCH(req: NextRequest) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const client = await getMongoClientPromise();
  const db = client.db();
  const userId = new ObjectId(authed.user.id);
  const user = await db.collection("users").findOne({ _id: userId });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (parsed.data.type === "name") {
    await db.collection("users").updateOne(
      { _id: userId },
      { $set: { name: parsed.data.name, updatedAt: new Date() } }
    );
    return NextResponse.json({ success: true });
  }

  if (parsed.data.type === "email") {
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Password not available for social login accounts" }, { status: 400 });
    }
    const valid = await compare(parsed.data.currentPassword, user.passwordHash as string);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    const emailLower = parsed.data.email;
    const existing = await db.collection("users").findOne({ emailLower, _id: { $ne: userId } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    await db.collection("users").updateOne(
      { _id: userId },
      { $set: { email: parsed.data.email, emailLower, updatedAt: new Date() } }
    );
    return NextResponse.json({ success: true });
  }

  if (parsed.data.type === "password") {
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Password not available for social login accounts" }, { status: 400 });
    }
    const valid = await compare(parsed.data.currentPassword, user.passwordHash as string);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    const newHash = await hash(parsed.data.newPassword, 12);
    await db.collection("users").updateOne(
      { _id: userId },
      { $set: { passwordHash: newHash, updatedAt: new Date() } }
    );
    await bumpTokenVersion(authed.user.id);
    return NextResponse.json({ success: true, sessionRevoked: true });
  }
}

export async function DELETE(req: NextRequest) {
  const authed = await requireAuthedUser(req);
  if ("error" in authed) return authed.error;

  const client = await getMongoClientPromise();
  const db = client.db();
  const userId = new ObjectId(authed.user.id);
  const ownerId = authed.user.id;

  await bumpTokenVersion(ownerId);

  const media = await db.collection("media").find({ ownerId }).toArray();
  for (const m of media) {
    if (typeof m.storageKey === "string") {
      await deletePrivateObject(m.storageKey);
    }
  }

  await Promise.all([
    db.collection("users").deleteOne({ _id: userId }),
    db.collection("accounts").deleteMany({ userId }),
    db.collection("sessions").deleteMany({ userId }),
    db.collection("observations").deleteMany({ ownerId }),
    db.collection("inferenceResults").deleteMany({ ownerId }),
    db.collection("media").deleteMany({ ownerId }),
  ]);

  return NextResponse.json({ success: true });
}
