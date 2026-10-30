import { create } from "zustand";
import { TEST_HOOKS_ENABLED, lockedQuality } from "../testHooks";
import {
  initialQuality,
  type QualityLevel,
  type QualityState,
  restartWarmup,
  type QualityTrend,
  stepQuality,
} from "./quality";

interface QualityStore extends QualityState {
  report: (trend: QualityTrend) => void;
  /** Ignore the frame rate for a few seconds, e.g. as a flight loads in. */
  startWarmup: () => void;
}

/** The current render quality level. Lives past screen changes and remounts. */
export const useQualityStore = create<QualityStore>((set, get) => ({
  ...initialQuality(typeof performance === "undefined" ? 0 : performance.now()),
  report: (trend) => {
    if (lockedQuality() !== undefined) return;
    const state = get();
    const pixelRatio = window.devicePixelRatio || 1;
    const next = stepQuality(state, trend, performance.now(), pixelRatio);
    if (next !== state) set(next);
  },
  startWarmup: () => set((s) => restartWarmup(s, performance.now())),
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
  return lockedQuality() ?? level;
}
