import { create } from "zustand";
import { TEST_HOOKS_ENABLED, lockedQuality } from "../testHooks";
import {
  initialQuality,
  type QualityLevel,
  type QualityTrend,
  stepQuality,
} from "./quality";

interface QualityStore {
  level: QualityLevel;
  changedAt: number;
  report: (trend: QualityTrend) => void;
}

/** The current render quality level. Lives past screen changes and remounts. */
export const useQualityStore = create<QualityStore>((set, get) => ({
  ...initialQuality(typeof performance === "undefined" ? 0 : performance.now()),
  report: (trend) => {
    if (lockedQuality() !== undefined) return;
    const state = get();
    const next = stepQuality(state, trend, performance.now());
    if (next !== state && next.level !== state.level) set(next);
  },
}));

declare global {
  interface Window {
    __planeBuilderQuality?: typeof useQualityStore;
  }
}

if (TEST_HOOKS_ENABLED && typeof window !== "undefined") {
  window.__planeBuilderQuality = useQualityStore;
}

/** The level to draw at: a test's pinned level, else the adaptive one. */
export function useQualityLevel(): QualityLevel {
  const level = useQualityStore((s) => s.level);
  return (lockedQuality() ?? level) as QualityLevel;
}
