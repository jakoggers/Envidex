import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createManualBookmark } from "@/lib/scout/bookmarks";
import { manualBookmarkSchema } from "@/lib/scout/validation";

export const runtime = "nodejs";

/**
 * Validates and normalizes a manually saved listing.
 * Does NOT fetch the remote URL (SSRF-safe; no unsupported scrape).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = manualBookmarkSchema.parse(body);
    const listing = createManualBookmark({
      url: parsed.url,
      title: parsed.title,
      priceAmount: parsed.priceAmount,
      currency: parsed.currency,
      marketplace: parsed.marketplace ?? null,
    });
    return NextResponse.json({ listing });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid bookmark", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Could not save bookmark" }, { status: 500 });
  }
}
