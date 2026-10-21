import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile, unlink, access } from "fs/promises";
import path from "path";
import { getStorageBackend, getStorageRoot } from "@/lib/config";

export type StoredObject = {
  storageKey: string;
  absolutePath: string;
};

function rootDir(): string {
  const storageRoot = getStorageRoot();
  return path.isAbsolute(storageRoot)
    ? storageRoot
    : path.join(process.cwd(), storageRoot);
}

export async function ensureStorageReady(): Promise<void> {
  if (getStorageBackend() !== "local") {
    throw new Error(`Unsupported STORAGE_BACKEND: ${getStorageBackend()}`);
  }
  await mkdir(rootDir(), { recursive: true });
}

export function buildObjectKey(ownerId: string, ext = "jpg"): string {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safeOwner}/${randomUUID()}.${ext}`;
}

export async function writePrivateObject(
  storageKey: string,
  data: Buffer
): Promise<StoredObject> {
  await ensureStorageReady();
  const absolutePath = path.join(rootDir(), storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, data, { mode: 0o600 });
  return { storageKey, absolutePath };
}

export async function readPrivateObject(storageKey: string): Promise<Buffer> {
  const absolutePath = path.join(rootDir(), storageKey);
  const resolved = path.resolve(absolutePath);
  const root = path.resolve(rootDir());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Invalid storage key");
  }
  return readFile(resolved);
}

export async function deletePrivateObject(storageKey: string): Promise<void> {
  const absolutePath = path.join(rootDir(), storageKey);
  const resolved = path.resolve(absolutePath);
  const root = path.resolve(rootDir());
  if (!resolved.startsWith(root + path.sep)) {
    return;
  }
  try {
    await access(resolved);
    await unlink(resolved);
  } catch {
    // already gone
  }
}
