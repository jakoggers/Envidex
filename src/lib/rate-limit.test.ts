import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests under the limit", () => {
    expect(rateLimit("t1", 2, 60_000).ok).toBe(true);
    expect(rateLimit("t1", 2, 60_000).ok).toBe(true);
  });

  it("blocks when exceeded", () => {
    rateLimit("t2", 1, 60_000);
    const blocked = rateLimit("t2", 1, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
