"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionConfig } from "framer-motion";
import { SessionCacheSync } from "@/components/session-cache-sync";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <SessionCacheSync />
        <TooltipProvider delay={300}>{children}</TooltipProvider>
      </SessionProvider>
    </MotionConfig>
  );
}
