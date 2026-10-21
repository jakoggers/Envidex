import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getMongoClientPromise } from "@/lib/mongodb";
import { rateLimit } from "@/lib/rate-limit";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid signup data." }, { status: 400 });
    }

    const name = parsed.data.name;
    const email = parsed.data.email;
    const emailLower = email.toLowerCase();

    const rl = rateLimit(`auth:signup:${emailLower}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const passwordHash = await hash(parsed.data.password, 12);

    const client = await getMongoClientPromise();
    const db = client.db();
    const users = db.collection("users");

    await users.createIndex({ emailLower: 1 }, { unique: true });

    const existing = await users.findOne({ emailLower });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const created = await users.insertOne({
      name,
      email,
      emailLower,
      passwordHash,
      authProviders: ["credentials"],
      tokenVersion: 0,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, userId: created.insertedId.toString() });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
