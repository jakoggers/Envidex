import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getMongoClientPromise } from "@/lib/mongodb";

export type AuthedUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  tokenVersion: number;
};

/**
 * Require a valid session whose JWT tokenVersion still matches the user document.
 * Rejects after password change, disable, or delete.
 */
export async function requireAuthedUser(
  req?: NextRequest
): Promise<{ user: AuthedUser } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let tokenVersion = 0;
  if (req) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    tokenVersion = typeof token?.tokenVersion === "number" ? token.tokenVersion : 0;
  } else if (typeof (session.user as { tokenVersion?: number }).tokenVersion === "number") {
    tokenVersion = (session.user as { tokenVersion: number }).tokenVersion;
  }

  const client = await getMongoClientPromise();
  const db = client.db();
  let user;
  try {
    user = await db.collection("users").findOne({ _id: new ObjectId(session.user.id) });
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const dbVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 0;
  if (dbVersion !== tokenVersion) {
    return { error: NextResponse.json({ error: "Session revoked" }, { status: 401 }) };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      tokenVersion: dbVersion,
    },
  };
}

export async function bumpTokenVersion(userId: string): Promise<void> {
  const client = await getMongoClientPromise();
  const db = client.db();
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { tokenVersion: 1 }, $set: { updatedAt: new Date() } }
  );
}
