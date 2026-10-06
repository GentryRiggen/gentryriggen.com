"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { getWalkState } from "@/lib/ship-builder/state/walkLive";
import { TEST_HOOKS_ENABLED } from "@/lib/ship-builder/testHooks";
import type { WalkState } from "@/lib/ship-builder/walk";

declare global {
  interface Window {
    __shipBuilderStore?: typeof useShipBuilderStore;
    /** Reads the walker's live state (null when not walking). */
    __shipBuilderWalk?: () => WalkState | null;
  }
}

/** Exposes the store and the walker to Playwright in non-production builds only. */
export default function useTestHook() {
  useEffect(() => {
    if (!TEST_HOOKS_ENABLED) return;
    window.__shipBuilderStore = useShipBuilderStore;
    window.__shipBuilderWalk = getWalkState;
    return () => {
      delete window.__shipBuilderStore;
      delete window.__shipBuilderWalk;
    };
  }, []);
}
