import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import { compare } from "bcryptjs";
import { ObjectId, type Document, type WithId } from "mongodb";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";
import { getMongoClientPromise, isMongoConfigured } from "@/lib/mongodb";
import { rateLimit } from "@/lib/rate-limit";

type DbUser = WithId<Document> & {
  email: string;
  emailLower: string;
  name?: string;
  image?: string;
  passwordHash?: string;
  authProviders?: string[];
  tokenVersion?: number;
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const emailLower = parsed.data.email.trim().toLowerCase();
      const rl = rateLimit(`auth:credentials:${emailLower}`, 10, 60_000);
      if (!rl.ok) {
        return null;
      }

      const password = parsed.data.password;
      const client = await getMongoClientPromise();
      const db = client.db();
      const users = db.collection<DbUser>("users");
      const user = await users.findOne({ emailLower });

      if (!user?.passwordHash) {
        return null;
      }

      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) {
        return null;
      }

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name ?? user.email,
        image: typeof user.image === "string" ? user.image : null,
        tokenVersion: typeof user.tokenVersion === "number" ? user.tokenVersion : 0,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    })
  );
}

export const authOptions: NextAuthOptions = {
  // Adapter requires a real URI at runtime. Omit during build/import when unset
  // so `next build` can collect page data without inventing a fake DB.
  ...(isMongoConfigured()
    ? { adapter: MongoDBAdapter(getMongoClientPromise()) }
    : {}),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      // OAuth: do NOT upsert/merge by emailLower. Linking is only via the
      // NextAuth adapter's same-provider account records / explicit link flow.
      // Unverified email matches must not take over an existing credentials account.
      if (account?.provider && account.provider !== "credentials") {
        const client = await getMongoClientPromise();
        const db = client.db();
        const users = db.collection("users");

        if (user.id) {
          try {
            await users.updateOne(
              { _id: new ObjectId(user.id) },
              {
                $addToSet: { authProviders: account.provider },
                $set: { updatedAt: new Date() },
                $setOnInsert: { tokenVersion: 0, role: "user" },
              }
            );
          } catch {
            // Adapter may still be creating the user; do not merge by email.
          }
        }
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;
        const tv = (user as { tokenVersion?: number }).tokenVersion;
        token.tokenVersion = typeof tv === "number" ? tv : 0;
      }

      if (token.sub && (trigger === "update" || typeof token.tokenVersion !== "number")) {
        try {
          const client = await getMongoClientPromise();
          const db = client.db();
          const dbUser = await db.collection("users").findOne({ _id: new ObjectId(token.sub) });
          if (dbUser) {
            token.tokenVersion =
              typeof dbUser.tokenVersion === "number" ? dbUser.tokenVersion : 0;
          }
        } catch {
          // leave existing claim
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.tokenVersion =
          typeof token.tokenVersion === "number" ? token.tokenVersion : 0;
      }
      return session;
    },
  },
};
