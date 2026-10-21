"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, RefreshCw, Save, X } from "lucide-react";
import { useEnvidexStore } from "@/lib/store";

type PredictSuccess = {
  resultId: string;
  mediaId: string;
  label: string;
  commonName: string;
  scientificName: string;
  score: number;
  modelVersion: string | null;
  source: string;
  scoreLabel?: string;
};

type UiPhase =
  | "idle"
  | "camera"
  | "preview"
  | "predicting"
  | "result"
  | "saving"
  | "saved"
  | "error";

export default function LiveFeedPage() {
  const { status } = useSession();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setLastResultId = useEnvidexStore((s) => s.setLastResultId);

  const [phase, setPhase] = useState<UiPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<PredictSuccess | null>(null);
  const [useExternalAi, setUseExternalAi] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      abortRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopCamera, previewUrl]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const setPreviewFromBlob = (blob: Blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewBlob(blob);
    setResult(null);
    setError(null);
    setPhase("preview");
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setPhase("camera");
    } catch {
      setError("Camera permission denied or unavailable. You can upload a photo instead.");
      setPhase("idle");
    }
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet.");
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (!blob) {
      setError("Could not capture frame.");
      return;
    }
    stopCamera();
    setPreviewFromBlob(blob);
  };

  const onUpload = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are accepted.");
      return;
    }
    stopCamera();
    setPreviewFromBlob(file);
  };

  const cancelPredict = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase(previewBlob ? "preview" : "idle");
    setError("Identification cancelled.");
  };

  const runPredict = async () => {
    if (!previewBlob) return;
    setError(null);
    setPhase("predicting");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (useExternalAi) {
        const dataUrl = await blobToDataUrl(previewBlob);
        const res = await fetch("/api/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: dataUrl }),
          signal: controller.signal,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 503) {
            throw new Error(
              typeof payload.error === "string"
                ? payload.error
                : "External AI identify is not configured"
            );
          }
          throw new Error(typeof payload.error === "string" ? payload.error : "Identification failed");
        }
        const mapped: PredictSuccess = {
          resultId: payload.resultId,
          mediaId: payload.mediaId,
          label: payload.id ?? payload.commonName,
          commonName: payload.commonName,
          scientificName: payload.scientificName,
          score: payload.score ?? payload.confidence,
          modelVersion: "claude-sonnet-4.6",
          source: "anthropic",
          scoreLabel: "model score (uncalibrated)",
        };
        if (!payload.isIdentifiable) {
          setResult(mapped);
          setPhase("result");
          setError(payload.notIdentifiableReason ?? "No clear species match.");
          return;
        }
        setResult(mapped);
        setLastResultId(mapped.resultId);
        setPhase("result");
        return;
      }

      const formData = new FormData();
      formData.append("file", previewBlob, "capture.jpg");
      const res = await fetch("/api/predict", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Identification failed");
      }
      const mapped = payload as PredictSuccess;
      if (!mapped.resultId) {
        throw new Error("Identification failed");
      }
      setResult(mapped);
      setLastResultId(mapped.resultId);
      setPhase("result");
    } catch (err) {
      if (controller.signal.aborted) return;
      setPhase("error");
      setError(err instanceof Error ? err.message : "Identification failed");
    } finally {
      abortRef.current = null;
    }
  };

  const savePrivate = async () => {
    if (!result?.resultId) return;
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inferenceResultId: result.resultId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Save failed");
      }
      setPhase("saved");
    } catch (err) {
      setPhase("result");
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const retake = () => {
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPhase("idle");
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-10 pb-24">
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Identify
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start the camera or upload a photo. Photos stay private until you save them to your field guide.
        </p>
      </div>

      {phase === "idle" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            <Camera className="h-4 w-4" /> Start camera
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5 text-sm font-semibold"
          >
            <ImagePlus className="h-4 w-4" /> Upload photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
          />
          <label className="flex items-start gap-2 text-xs text-muted-foreground mt-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={useExternalAi}
              onChange={(e) => setUseExternalAi(e.target.checked)}
            />
            <span>
              Use external AI identify (Anthropic). Requires{" "}
              <span className="font-mono">ANTHROPIC_API_KEY</span>; returns unavailable if missing —
              never a silent fallback for the local model.
            </span>
          </label>
        </div>
      )}

      {phase === "camera" && (
        <div className="rounded-3xl overflow-hidden bg-black aspect-square border border-border/40">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2 p-3 bg-card/90">
            <button
              type="button"
              onClick={captureFrame}
              className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setPhase("idle");
              }}
              className="rounded-2xl border border-border px-4 py-3 text-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {(phase === "preview" ||
        phase === "predicting" ||
        phase === "result" ||
        phase === "saving" ||
        phase === "saved" ||
        phase === "error") &&
        previewUrl && (
          <div className="flex flex-col gap-3">
            <div className="rounded-3xl overflow-hidden bg-black aspect-square border border-border/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Capture preview" className="w-full h-full object-cover" />
            </div>

            {phase === "preview" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={runPredict}
                  className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Identify with local model
                </button>
                <button
                  type="button"
                  onClick={retake}
                  className="rounded-2xl border border-border px-4 py-3 text-sm"
                >
                  Retake
                </button>
              </div>
            )}

            {phase === "predicting" && (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-muted/40 py-3 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Identifying…
                </div>
                <button
                  type="button"
                  onClick={cancelPredict}
                  className="rounded-2xl border border-border px-4 py-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}

            {(phase === "result" || phase === "saving" || phase === "saved") && result && (
              <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-2">
                <p className="text-lg font-bold leading-tight">{result.commonName}</p>
                <p className="text-sm italic text-muted-foreground">{result.scientificName}</p>
                <p className="text-xs text-muted-foreground">
                  Source: {result.source}
                  {result.modelVersion ? ` · ${result.modelVersion}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Score: {(result.score * 100).toFixed(1)}%{" "}
                  <span className="opacity-70">({result.scoreLabel ?? "model score, uncalibrated"})</span>
                </p>
                {phase === "saved" ? (
                  <div className="flex flex-col gap-2 pt-2">
                    <p className="text-sm text-primary font-medium">Saved privately to your field guide.</p>
                    <button
                      type="button"
                      onClick={() => router.push("/collection")}
                      className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Open field guide
                    </button>
                    <button
                      type="button"
                      onClick={retake}
                      className="w-full rounded-2xl border border-border py-3 text-sm font-semibold"
                    >
                      Identify another
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={savePrivate}
                      disabled={phase === "saving"}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {phase === "saving" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save private
                    </button>
                    <button
                      type="button"
                      onClick={retake}
                      disabled={phase === "saving"}
                      className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm"
                    >
                      <RefreshCw className="h-4 w-4" /> Retake
                    </button>
                  </div>
                )}
              </div>
            )}

            {phase === "error" && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={runPredict}
                  className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={retake}
                  className="w-full rounded-2xl border border-border py-3 text-sm"
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        )}

      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}
