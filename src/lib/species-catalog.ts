import type { Db } from "mongodb";
import { findSpeciesByScientificName } from "@/lib/mock-species";
import type { SpeciesDoc, VerificationSource } from "@/lib/models";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function scientificFromLabel(label: string): string {
  const parts = label.split("_");
  if (parts.length >= 2) {
    return `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)} ${parts.slice(1).join(" ")}`;
  }
  return label.replace(/_/g, " ");
}

/**
 * Resolve or upsert a curated species record for a model label / scientific name.
 * Never invents LC status, populations, or citations for unmatched labels.
 */
export async function resolveSpeciesForPrediction(
  db: Db,
  params: { label: string; scientificName: string; commonName: string }
): Promise<{ speciesId: string; species: SpeciesDoc }> {
  const catalog = db.collection<SpeciesDoc>("species");
  const mock = findSpeciesByScientificName(params.scientificName);

  let key: string;
  let doc: Omit<SpeciesDoc, "_id">;
  let source: VerificationSource;

  if (mock) {
    key = mock.id;
    source = "mock-species";
    doc = {
      key,
      commonName: mock.commonName,
      scientificName: mock.scientificName,
      kingdom: mock.kingdom,
      class: mock.class,
      habitat: mock.habitat,
      conservationStatus: mock.conservationStatus,
      population: mock.population,
      description: mock.description,
      threats: mock.threats,
      howToHelp: mock.howToHelp,
      funFacts: mock.funFacts,
      range: mock.range,
      diet: mock.diet,
      imageUrl: mock.imageUrl,
      verification: { source, verified: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } else {
    const sci = params.scientificName || scientificFromLabel(params.label);
    key = slugify(sci) || slugify(params.label) || `label-${Date.now()}`;
    source = "model-label";
    doc = {
      key,
      commonName: params.commonName || params.label.replace(/_/g, " "),
      scientificName: sci,
      kingdom: "Animalia",
      class: "Mammalia",
      habitat: [],
      conservationStatus: "NE",
      population: "unknown",
      description: "Catalog facts have not been curated for this model label yet.",
      threats: [],
      howToHelp: [],
      funFacts: [],
      range: "unknown",
      verification: {
        source,
        verified: false,
        notes: "unmatched model label; conservation status NE / unknown — not invented",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const existing = await catalog.findOne({ key });
  if (existing) {
    await catalog.updateOne(
      { key },
      {
        $set: {
          ...doc,
          createdAt: existing.createdAt,
          updatedAt: new Date(),
        },
      }
    );
    const updated = await catalog.findOne({ key });
    return { speciesId: key, species: updated! };
  }

  await catalog.insertOne(doc as SpeciesDoc);
  return { speciesId: key, species: doc as SpeciesDoc };
}
