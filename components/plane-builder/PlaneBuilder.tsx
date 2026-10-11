"use client";

import { useEffect, useState } from "react";
import useWebGLSupport from "@/components/ship-builder/hooks/useWebGLSupport";
import { loadProgress, saveProgress } from "@/lib/plane-builder/persist/local";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import Hangar from "./ui/Hangar";
import LevelSelect from "./ui/LevelSelect";
import Results from "./ui/Results";
import WebGLFallback from "./ui/WebGLFallback";

const BACKGROUND =
  "bg-gradient-to-b from-sky-300 to-sky-100 text-slate-900 dark:from-slate-950 dark:to-sky-950 dark:text-slate-100";

export default function PlaneBuilder() {
  const hasWebGL = useWebGLSupport();
  const screen = usePlaneBuilderStore((s) => s.screen);
  const [isRecovered, setIsRecovered] = useState(false);

  useEffect(() => {
    const result = loadProgress();
    usePlaneBuilderStore.getState().hydrate(result.progress);
    // localStorage is only readable after mount, so this can't be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRecovered(result.recovered);
    // Subscribe only after hydrating, so the fresh initial progress can never
    // overwrite a real save.
    return usePlaneBuilderStore.subscribe((state, prev) => {
      if (state.progress !== prev.progress) saveProgress(state.progress);
    });
  }, []);

  if (hasWebGL === null) {
    return <div className={`h-[100dvh] w-full ${BACKGROUND}`} />;
  }
  if (!hasWebGL) {
    return (
      <div className={`h-[100dvh] w-full ${BACKGROUND}`}>
        <WebGLFallback />
      </div>
    );
  }

  return (
    <div className={`relative h-[100dvh] w-full overflow-hidden ${BACKGROUND}`}>
      {/* Task 10: the 3D Stage goes in an absolute inset-0 layer here. */}
      {screen === "levels" ? <LevelSelect /> : null}
      {screen === "hangar" ? <Hangar /> : null}
      {screen === "results" ? <Results /> : null}
      {/* Task 11 replaces this placeholder with the launch and flight UI. */}
      {screen === "launch" || screen === "flight" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <button
            type="button"
            onClick={() => usePlaneBuilderStore.getState().goToLevels()}
            className="min-h-11 rounded-lg bg-white px-4 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100"
          >
            Launching… Back to levels
          </button>
        </div>
      ) : null}
      {isRecovered ? (
        <div
          role="status"
          className="absolute inset-x-4 top-4 z-20 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="flex-1">
            Your old save couldn&apos;t be read, so we started fresh. A copy was
            kept.
          </p>
          <button
            type="button"
            onClick={() => setIsRecovered(false)}
            className="min-h-11 shrink-0 rounded-md px-3 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
