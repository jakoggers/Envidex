import sharp from "sharp";
import { ALLOWED_IMAGE_MIME, getMaxImagePixels, getMaxUploadBytes } from "@/lib/config";

export type SanitizedImage = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
};

function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function sanitizeImageUpload(
  input: Buffer,
  declaredMime?: string | null
): Promise<{ ok: true; image: SanitizedImage } | { ok: false; status: number; error: string }> {
  const maxBytes = getMaxUploadBytes();
  const maxPixels = getMaxImagePixels();

  if (!input.length) {
    return { ok: false, status: 400, error: "Empty file" };
  }
  if (input.length > maxBytes) {
    return { ok: false, status: 413, error: "Image too large" };
  }

  const sniffed = sniffMime(input);
  if (!sniffed || !ALLOWED_IMAGE_MIME.has(sniffed)) {
    return { ok: false, status: 400, error: "Unsupported image type" };
  }

  if (declaredMime && declaredMime !== "application/octet-stream") {
    const normalized = declaredMime.toLowerCase() === "image/jpg" ? "image/jpeg" : declaredMime.toLowerCase();
    if (normalized !== sniffed && ALLOWED_IMAGE_MIME.has(normalized) === false) {
      return { ok: false, status: 400, error: "Unsupported image type" };
    }
  }

  try {
    const meta = await sharp(input, { failOn: "error" }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) {
      return { ok: false, status: 400, error: "Invalid image" };
    }
    if (width > maxPixels || height > maxPixels) {
      return { ok: false, status: 413, error: "Image dimensions too large" };
    }

    // Strip EXIF/GPS and re-encode to a safe baseline JPEG for persist/upstream.
    const buffer = await sharp(input)
      .rotate()
      .resize({
        width: Math.min(width, maxPixels),
        height: Math.min(height, maxPixels),
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    const outMeta = await sharp(buffer).metadata();

    return {
      ok: true,
      image: {
        buffer,
        contentType: "image/jpeg",
        width: outMeta.width ?? width,
        height: outMeta.height ?? height,
      },
    };
  } catch {
    return { ok: false, status: 400, error: "Invalid image" };
  }
}
