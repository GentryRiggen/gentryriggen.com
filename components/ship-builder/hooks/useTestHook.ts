"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

declare global {
  interface Window {
    __shipBuilderStore?: typeof useShipBuilderStore;
  }
}

/** Exposes the store to Playwright in non-production builds only. */
export default function useTestHook() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__shipBuilderStore = useShipBuilderStore;
    return () => {
      delete window.__shipBuilderStore;
    };
  }, []);
}
