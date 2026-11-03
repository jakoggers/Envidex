import { NextResponse } from "next/server";
import { getAllProviders } from "@/lib/scout/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providers = getAllProviders().map((provider) => {
    const config = provider.getConfigStatus();
    return {
      id: provider.id,
      displayName: provider.displayName,
      capabilities: provider.capabilities,
      configured: config.configured,
      environment: config.environment,
      message: config.message,
    };
  });

  return NextResponse.json({
    providers,
    demoModeAvailable: true,
    notes: [
      "eBay uses the official Browse API with OAuth application tokens.",
      "Facebook Marketplace and OfferUp have no public consumer search APIs; they return unavailable with fallback search links.",
      "Demo mode requires an explicit demoMode flag and labels all fixtures.",
    ],
  });
}
