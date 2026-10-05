"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { TEST_HOOKS_ENABLED } from "@/lib/ship-builder/testHooks";

declare global {
  interface Window {
    __shipBuilderStore?: typeof useShipBuilderStore;
  }
}

/** Exposes the store to Playwright in non-production builds only. */
export default function useTestHook() {
  useEffect(() => {
    if (!TEST_HOOKS_ENABLED) return;
    window.__shipBuilderStore = useShipBuilderStore;
    return () => {
      delete window.__shipBuilderStore;
    };
  }, []);
}
