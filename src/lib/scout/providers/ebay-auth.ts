import { log } from "../logger";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

export interface EbayAuthConfig {
  clientId: string;
  clientSecret: string;
  env: "sandbox" | "production";
}

export function getEbayAuthConfig(): EbayAuthConfig | null {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const env =
    process.env.EBAY_ENV?.toLowerCase() === "sandbox" ? "sandbox" : "production";
  return { clientId, clientSecret, env };
}

export function ebayApiBase(env: "sandbox" | "production"): string {
  return env === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

/**
 * OAuth client-credentials application token for Browse API public search.
 * Scope: https://api.ebay.com/oauth/api_scope
 * Tokens are reused until ~2 minutes before expiry.
 */
export async function getEbayApplicationToken(
  config: EbayAuthConfig,
  signal?: AbortSignal,
): Promise<string> {
  const skewMs = 120_000;
  if (cached && Date.now() < cached.expiresAt - skewMs) {
    return cached.accessToken;
  }

  const tokenUrl = `${ebayApiBase(config.env)}/identity/v1/oauth2/token`;
  const basic = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    log("error", "ebay.oauth_failed", {
      provider: "ebay",
      status: response.status,
      message: text.slice(0, 200),
    });
    throw new EbayAuthError(
      response.status,
      `eBay OAuth failed (${response.status}). Check EBAY_CLIENT_ID / EBAY_CLIENT_SECRET and that the app has the Buy APIs / Browse API enabled for ${config.env}.`,
    );
  }

  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type?: string;
  };

  cached = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  log("info", "ebay.oauth_ok", {
    provider: "ebay",
    expiresIn: json.expires_in,
    environment: config.env,
  });

  return cached.accessToken;
}

export class EbayAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "EbayAuthError";
    this.status = status;
  }
}

/** Test helper */
export function clearEbayTokenCache(): void {
  cached = null;
}
