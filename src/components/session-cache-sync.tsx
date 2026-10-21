"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { clearEnvidexCachesOnLogout, useEnvidexStore } from "@/lib/store";

/** Scopes / clears Zustand UI cache when the signed-in user changes or logs out. */
export function SessionCacheSync() {
  const { data: session, status } = useSession();
  const setUserId = useEnvidexStore((s) => s.setUserId);
  const clearUserCache = useEnvidexStore((s) => s.clearUserCache);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    const nextId = session?.user?.id ?? null;
    if (status === "unauthenticated") {
      if (prevId.current) {
        clearEnvidexCachesOnLogout();
      }
      prevId.current = null;
      return;
    }

    if (nextId && prevId.current && prevId.current !== nextId) {
      clearUserCache();
    }
    setUserId(nextId);
    prevId.current = nextId;
  }, [session?.user?.id, status, setUserId, clearUserCache]);

  return null;
}
