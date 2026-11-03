import { Suspense } from "react";
import { SearchApp } from "@/components/scout/search-app";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="animate-scout-shimmer h-40 rounded-lg" aria-label="Loading" />
      }
    >
      <SearchApp />
    </Suspense>
  );
}
