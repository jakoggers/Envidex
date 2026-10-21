"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CollectedEntry, Species } from "./types";

/**
 * UI/cache only. Observations and catalog authority live on the server.
 * Persist key is scoped per user id to prevent cross-account leakage.
 */

interface EnvidexStore {
  userId: string | null;
  collection: CollectedEntry[];
  recentSpecies: Species[];
  avatarEmoji: string | null;
  shareCount: number;
  lastResultId: string | null;
  setUserId: (userId: string | null) => void;
  clearUserCache: () => void;
  addToCollection: (entry: CollectedEntry) => void;
  isCollected: (speciesId: string) => boolean;
  setRecentSpecies: (species: Species[]) => void;
  setAvatarEmoji: (emoji: string | null) => void;
  incrementShareCount: () => void;
  setLastResultId: (id: string | null) => void;
  importLegacyCollection: (entries: CollectedEntry[]) => { imported: number; skipped: number };
}

const emptyState = {
  collection: [] as CollectedEntry[],
  recentSpecies: [] as Species[],
  avatarEmoji: null as string | null,
  shareCount: 0,
  lastResultId: null as string | null,
};

function storageKeyFor(userId: string | null): string {
  return userId ? `envidex-ui-${userId}` : "envidex-ui-anon";
}

export const useEnvidexStore = create<EnvidexStore>()(
  persist(
    (set, get) => ({
      userId: null,
      ...emptyState,
      setUserId: (userId) => {
        const prev = get().userId;
        if (prev && userId && prev !== userId) {
          set({ userId, ...emptyState });
          return;
        }
        if (prev && !userId) {
          set({ userId: null, ...emptyState });
          return;
        }
        set({ userId });
      },
      clearUserCache: () => set({ ...emptyState }),
      addToCollection: (entry) => {
        const existing = get().collection.find((e) => e.speciesId === entry.speciesId);
        if (!existing) {
          set((state) => ({ collection: [entry, ...state.collection] }));
        }
      },
      isCollected: (speciesId) => get().collection.some((e) => e.speciesId === speciesId),
      setRecentSpecies: (species) => set({ recentSpecies: species }),
      setAvatarEmoji: (emoji) => set({ avatarEmoji: emoji }),
      incrementShareCount: () => set((state) => ({ shareCount: state.shareCount + 1 })),
      setLastResultId: (id) => set({ lastResultId: id }),
      importLegacyCollection: (entries) => {
        // Explicit import only — never silent re-attribution across accounts.
        let imported = 0;
        let skipped = 0;
        const next = [...get().collection];
        for (const entry of entries) {
          if (!entry?.speciesId || typeof entry.discoveredAt !== "string") {
            skipped += 1;
            continue;
          }
          if (next.some((e) => e.speciesId === entry.speciesId)) {
            skipped += 1;
            continue;
          }
          next.unshift({
            speciesId: entry.speciesId,
            discoveredAt: entry.discoveredAt,
            location: entry.location,
            // Drop large imageData from legacy localStorage imports.
          });
          imported += 1;
        }
        set({ collection: next });
        return { imported, skipped };
      },
    }),
    {
      name: "envidex-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userId: state.userId,
        collection: state.collection,
        recentSpecies: state.recentSpecies,
        avatarEmoji: state.avatarEmoji,
        shareCount: state.shareCount,
        lastResultId: state.lastResultId,
      }),
    }
  )
);

/** Clear scoped UI cache and remove legacy shared key. */
export function clearEnvidexCachesOnLogout() {
  useEnvidexStore.getState().clearUserCache();
  useEnvidexStore.getState().setUserId(null);
  try {
    localStorage.removeItem("envidex-collection");
    localStorage.removeItem("envidex-ui");
    const uid = useEnvidexStore.getState().userId;
    if (uid) localStorage.removeItem(storageKeyFor(uid));
  } catch {
    // ignore
  }
}
