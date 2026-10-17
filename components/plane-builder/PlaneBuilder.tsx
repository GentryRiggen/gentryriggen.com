"use client";

import { useEffect, useState } from "react";
import useWebGLSupport from "@/components/ship-builder/hooks/useWebGLSupport";
import { loadProgress, saveProgress } from "@/lib/plane-builder/persist/local";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { soundSetting } from "./audio/soundSetting";
import useSoundUnlock from "./audio/useSoundUnlock";
import GameStage from "./scene/GameStage";
import FlightHud from "./ui/FlightHud";
import FlightRewardModal from "./ui/FlightRewardModal";
import Hangar from "./ui/Hangar";
import LaunchOverlay from "./ui/LaunchOverlay";
import LevelSelect from "./ui/LevelSelect";
import Steering from "./ui/Steering";
import { focusRingClass } from "./ui/styles";
import WebGLFallback from "./ui/WebGLFallback";

const RECOVERED_NOTICE =
  "Your old save couldn't be read, so we started fresh. A copy was kept.";
const RESET_NOTICE =
  "Plane Builder 1.2 is here! Everyone starts fresh to try the new rings, fuel cans and flags.";

const BACKGROUND =
  "bg-gradient-to-b from-sky-300 to-sky-100 text-slate-900 dark:from-slate-950 dark:to-sky-950 dark:text-slate-100";

export default function PlaneBuilder() {
  const hasWebGL = useWebGLSupport();
  const screen = usePlaneBuilderStore((s) => s.screen);
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const lastFlight = usePlaneBuilderStore((s) => s.lastFlight);
  const [notice, setNotice] = useState<string | null>(null);
  useSoundUnlock(soundSetting.useValue());

  useEffect(() => {
    const result = loadProgress();
    const store = usePlaneBuilderStore.getState();
    // The store outlives the page, so drop any screen left from a past visit.
    store.resetTransient();
    store.hydrate(result.progress);
    // localStorage is only readable after mount, so this can't be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice(
      result.reset ? RESET_NOTICE : result.recovered ? RECOVERED_NOTICE : null
    );
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

  const isRewardShown =
    screen === "hangar" && lastFlight !== null && !lastFlight.seen;

  return (
    <div className={`relative h-[100dvh] w-full overflow-hidden ${BACKGROUND}`}>
      <div className="absolute inset-0">
        <GameStage />
      </div>
      {/* The hangar sheet runs edge to edge and pads itself. */}
      {screen === "hangar" && !isRewardShown ? <Hangar /> : null}
      {/*
       * The 3D scene fills the screen (under the notch on an iPhone home-screen
       * app), but every other control sits inside the safe area. The insets
       * are 0 where nothing covers the screen, so other devices are unchanged.
       */}
      <div
        data-safe-area
        className="pointer-events-none absolute inset-0 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
      >
        <div className="relative h-full w-full">
          {screen === "levels" ? <LevelSelect /> : null}
          {isRewardShown && lastFlight ? (
            <FlightRewardModal levelId={levelId} flight={lastFlight} />
          ) : null}
          {screen === "launch" ? <LaunchOverlay /> : null}
          {screen === "flight" ? (
            <>
              <Steering />
              <FlightHud />
            </>
          ) : null}
          {notice ? (
            <div
              role="status"
              className="pointer-events-auto absolute inset-x-4 top-20 z-20 sm:top-24 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            >
              <p className="flex-1">{notice}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className={`min-h-11 shrink-0 rounded-md px-3 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900 ${focusRingClass}`}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
