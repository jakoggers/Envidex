import type { ConservationStatus } from "@/lib/types";

export type VerificationSource = "mock-species" | "model-label" | "unverified-legacy";

export type SpeciesDoc = {
  key: string;
  commonName: string;
  scientificName: string;
  kingdom: "Animalia" | "Plantae" | "Fungi" | "Other";
  class: string;
  habitat: string[];
  conservationStatus: ConservationStatus;
  population: string;
  description: string;
  threats: string[];
  howToHelp: string[];
  funFacts: string[];
  range: string;
  diet?: string;
  imageUrl?: string;
  verification: {
    source: VerificationSource;
    verified: boolean;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type InferenceResultDoc = {
  ownerId: string;
  source: "local-keras" | "anthropic";
  label: string;
  commonName: string;
  scientificName: string;
  score: number;
  modelVersion: string | null;
  mediaId: string | null;
  createdAt: Date;
};

export type MediaDoc = {
  ownerId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  width?: number;
  height?: number;
  observationId?: string | null;
  createdAt: Date;
};

export type ObservationDoc = {
  ownerId: string;
  speciesId: string;
  inferenceResultId: string;
  imageId: string;
  visibility: "private";
  createdAt: Date;
  updatedAt: Date;
};
