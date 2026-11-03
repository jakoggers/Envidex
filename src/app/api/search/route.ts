import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { runSearch } from "@/lib/scout/orchestrator";
import { parseSearchFilters } from "@/lib/scout/validation";
import { log } from "@/lib/scout/logger";
import type { MarketplaceId } from "@/lib/scout/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const filters = parseSearchFilters({
      query: params.get("q") ?? params.get("query") ?? "",
      minPrice: params.get("minPrice"),
      maxPrice: params.get("maxPrice"),
      currency: params.get("currency") ?? "USD",
      location: params.get("location"),
      radiusMiles: params.get("radiusMiles"),
      condition: params.get("condition") ?? "any",
      marketplaces: params.get("marketplaces") ?? undefined,
      requiredTerms: params.get("requiredTerms") ?? undefined,
      excludedTerms: params.get("excludedTerms") ?? undefined,
      sort: params.get("sort") ?? "relevance",
      demoMode: params.get("demoMode") ?? params.get("demo") ?? undefined,
    });

    const cursors: Partial<Record<MarketplaceId, string | null>> = {};
    for (const id of filters.marketplaces) {
      const cursor = params.get(`cursor_${id}`);
      if (cursor) cursors[id] = cursor;
    }

    const result = await runSearch(filters, { cursors });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid search parameters",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }
    log("error", "api.search_failed", {
      message: error instanceof Error ? error.message.slice(0, 200) : "error",
    });
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const filters = parseSearchFilters({
      query: body.query ?? body.q ?? "",
      minPrice: body.minPrice,
      maxPrice: body.maxPrice,
      currency: body.currency ?? "USD",
      location: body.location,
      radiusMiles: body.radiusMiles,
      condition: body.condition ?? "any",
      marketplaces: body.marketplaces,
      requiredTerms: body.requiredTerms,
      excludedTerms: body.excludedTerms,
      sort: body.sort ?? "relevance",
      demoMode: body.demoMode ?? body.demo,
    });

    const cursors = (body.cursors ?? {}) as Partial<
      Record<MarketplaceId, string | null>
    >;
    const result = await runSearch(filters, { cursors });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid search parameters",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }
    log("error", "api.search_failed", {
      message: error instanceof Error ? error.message.slice(0, 200) : "error",
    });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
