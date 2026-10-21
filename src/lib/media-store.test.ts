import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import {
  buildObjectKey,
  deletePrivateObject,
  readPrivateObject,
  writePrivateObject,
} from "@/lib/media-store";

describe("media-store", () => {
  let tmp: string;
  const prev = process.env.STORAGE_ROOT;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "envidex-media-"));
    process.env.STORAGE_ROOT = tmp;
  });

  afterAll(async () => {
    process.env.STORAGE_ROOT = prev;
    await rm(tmp, { recursive: true, force: true });
  });

  it("writes and reads private objects under owner keys", async () => {
    const key = buildObjectKey("userA", "jpg");
    expect(key.startsWith("userA/")).toBe(true);
    await writePrivateObject(key, Buffer.from("hello"));
    const bytes = await readPrivateObject(key);
    expect(bytes.toString()).toBe("hello");
    await deletePrivateObject(key);
  });

  it("rejects path traversal keys on read", async () => {
    await expect(readPrivateObject("../etc/passwd")).rejects.toThrow();
  });
});
