export function getMaxUploadBytes() {
  return Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);
}

export function getMaxImagePixels() {
  return Number(process.env.MAX_IMAGE_PIXELS ?? 4096);
}

export function getStorageBackend() {
  return process.env.STORAGE_BACKEND ?? "local";
}

export function getStorageRoot() {
  return process.env.STORAGE_ROOT ?? "./data/private-media";
}

export function getPredictionApiBaseUrl() {
  return process.env.PREDICTION_API_BASE_URL ?? "http://127.0.0.1:8000";
}

export function getModelVersion() {
  return process.env.MODEL_VERSION ?? "animal_species_model.keras";
}

export function getPredictTimeoutMs() {
  return Number(process.env.PREDICT_TIMEOUT_MS ?? 30_000);
}

/** @deprecated prefer getters for testability */
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);
export const MAX_IMAGE_PIXELS = Number(process.env.MAX_IMAGE_PIXELS ?? 4096);
export const STORAGE_BACKEND = process.env.STORAGE_BACKEND ?? "local";
export const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "./data/private-media";
export const PREDICTION_API_BASE_URL =
  process.env.PREDICTION_API_BASE_URL ?? "http://127.0.0.1:8000";
export const MODEL_VERSION = process.env.MODEL_VERSION ?? "animal_species_model.keras";
export const PREDICT_TIMEOUT_MS = Number(process.env.PREDICT_TIMEOUT_MS ?? 30_000);

export const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
