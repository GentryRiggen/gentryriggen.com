"use client";

import { useMemo, useSyncExternalStore } from "react";
import AssetStudio from "@/components/asset-studio/AssetStudio";
import { parseStudioParams } from "@/components/asset-studio/studioParams";

function subscribe(): () => void {
  return () => {};
}

function readSearch(): string | null {
  return window.location.search;
}

function readServerSearch(): string | null {
  return null;
}

/** Dev-only (see pageExtensions in next.config.ts): not in production builds. */
export default function AssetStudioPage() {
  const search = useSyncExternalStore(subscribe, readSearch, readServerSearch);
  const parsed = useMemo(
    () => (search === null ? null : parseStudioParams(search)),
    [search]
  );

  // The server render has no query string; show nothing until hydrated.
  if (!parsed) return null;
  if ("error" in parsed) {
    return (
      <p data-testid="studio-error" className="p-4 font-mono text-red-600">
        {parsed.error}
      </p>
    );
  }
  return <AssetStudio params={parsed} />;
}
