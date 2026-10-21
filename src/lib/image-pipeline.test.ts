import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { sanitizeImageUpload } from "@/lib/image-pipeline";

describe("sanitizeImageUpload", () => {
  it("rejects empty buffers", async () => {
    const result = await sanitizeImageUpload(Buffer.alloc(0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects non-image bytes", async () => {
    const result = await sanitizeImageUpload(Buffer.from("not-an-image"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/unsupported|invalid/i);
    }
  });

  it("rejects oversized payloads", async () => {
    const huge = Buffer.alloc(6 * 1024 * 1024, 0xff);
    // Pretend JPEG magic so size check wins first
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    const result = await sanitizeImageUpload(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("accepts a small JPEG and strips to re-encoded jpeg", async () => {
    const jpeg = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer();

    const result = await sanitizeImageUpload(jpeg, "image/jpeg");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.contentType).toBe("image/jpeg");
      expect(result.image.buffer.length).toBeGreaterThan(0);
      expect(result.image.width).toBe(32);
    }
  });
});
