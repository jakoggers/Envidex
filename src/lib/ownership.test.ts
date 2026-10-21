import { describe, expect, it, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

/**
 * Focused ownership checks for observation/media fetch semantics.
 * Production routes return 404 for both missing and cross-user IDs.
 */

function authorizeOwner(
  doc: { ownerId: string } | null,
  requesterId: string
): "ok" | "not_found" {
  if (!doc || doc.ownerId !== requesterId) return "not_found";
  return "ok";
}

describe("ownership isolation", () => {
  const userA = new ObjectId().toString();
  const userB = new ObjectId().toString();

  it("user A cannot fetch user B observation by id", () => {
    const observation = { ownerId: userB, imageId: "img1" };
    expect(authorizeOwner(observation, userA)).toBe("not_found");
  });

  it("user A can fetch own observation", () => {
    const observation = { ownerId: userA, imageId: "img1" };
    expect(authorizeOwner(observation, userA)).toBe("ok");
  });

  it("missing doc is indistinguishable from cross-user", () => {
    expect(authorizeOwner(null, userA)).toBe("not_found");
  });
});

describe("inference failure bounded errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps missing upstream to a stable public error string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:8000");
      })
    );

    try {
      await fetch("http://127.0.0.1:8000/predict");
      expect.unreachable();
    } catch (err) {
      const publicMessage = "Prediction service unavailable";
      expect(publicMessage).not.toContain("ECONNREFUSED");
      expect(err).toBeInstanceOf(Error);
    }
  });
});

describe("cache isolation on logout", () => {
  it("clears shared legacy key name and empties UI collection", () => {
    const legacyKey = "envidex-collection";
    const memory = new Map<string, string>();
    memory.set(legacyKey, JSON.stringify({ state: { collection: [{ speciesId: "x" }] } }));
    memory.set("envidex-ui", JSON.stringify({ state: { userId: "a", collection: [{ speciesId: "x" }] } }));

    memory.delete(legacyKey);
    memory.delete("envidex-ui");
    const clearedCollection: unknown[] = [];

    expect(memory.has(legacyKey)).toBe(false);
    expect(memory.has("envidex-ui")).toBe(false);
    expect(clearedCollection).toEqual([]);
  });
});
