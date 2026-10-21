import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Legacy public Blob share endpoint — disabled for new private workflow.
 * Phase C will introduce deliberate share/revoke tokens.
 * Do not add new public Blob uploads in Phase A/B.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Public scan sharing is disabled in this pass. Save observations privately via /api/observations.",
    },
    { status: 410 }
  );
}
