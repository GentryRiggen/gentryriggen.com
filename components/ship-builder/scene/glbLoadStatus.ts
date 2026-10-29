import { TEST_HOOKS_ENABLED } from "@/lib/ship-builder/testHooks";

/** How the glb parts on screen are doing, for tests that wait for models. */
export interface GlbLoadStatus {
  /** Parts showing their stand-in while the glb loads. */
  pending: number;
  /** Parts drawn from their glb. */
  loaded: number;
  /** Parts that fell back for good (load failed or a bad file). */
  failed: number;
}

declare global {
  interface Window {
    __shipBuilderModels?: () => GlbLoadStatus;
  }
}

const status: GlbLoadStatus = { pending: 0, loaded: 0, failed: 0 };

if (TEST_HOOKS_ENABLED && typeof window !== "undefined") {
  window.__shipBuilderModels = () => ({ ...status });
}

/**
 * Counts one mounted part in `state` until the returned cleanup runs. Call it
 * from an effect, so a part counts only while it is on screen.
 */
export function trackGlbPart(state: keyof GlbLoadStatus): () => void {
  status[state]++;
  return () => {
    status[state]--;
  };
}

/** The current counts (a copy). */
export function glbLoadStatus(): GlbLoadStatus {
  return { ...status };
}
