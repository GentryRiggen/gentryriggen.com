"use client";

import { useCallback, useEffect, useRef } from "react";
import { installTestHooks } from "@/lib/flamelings/testHooks";
import { releaseLock, useFlamelings } from "@/lib/flamelings/store";
import {
  collectVisits,
  startOnlineSync,
} from "@/lib/flamelings/online/controller";
import { HEARTBEAT_MS } from "@/lib/flamelings/tabLock";
import GameShell from "@/components/game-kit/GameShell";
import { useGameServiceWorker } from "@/components/game-kit/useGameServiceWorker";
import { useGameUpdate } from "@/components/game-kit/useGameUpdate";
import useVisibilityPause from "@/components/game-kit/useVisibilityPause";
import UpdatePill from "@/components/update/UpdatePill";
import { useFlamelingsSound } from "./audio/useFlamelingsSound";
import { flDisplay } from "./fonts";
import CelebrationCard from "./CelebrationCard";
import FriendsScreen from "./friends/FriendsScreen";
import Hatch from "./Hatch";
import MemoryGrove from "./MemoryGrove";
import PetView from "./PetView";
import Shelf from "./Shelf";
import TabLocked from "./TabLocked";
import { CHROME_BG, DISPLAY, FOCUS_RING } from "./styles";

/** How often the game catches up with the clock while the page is open. */
const TICK_MS = 15_000;

export default function Flamelings() {
  const ready = useFlamelings((s) => s.ready);
  const view = useFlamelings((s) => s.view);
  const celebration = useFlamelings((s) => s.celebrations[0]);
  const locked = useFlamelings((s) => s.locked);
  const outdated = useFlamelings((s) => s.outdated);
  const init = useFlamelings((s) => s.init);
  const tick = useFlamelings((s) => s.tick);
  const heartbeat = useFlamelings((s) => s.heartbeat);
  const onStorage = useFlamelings((s) => s.onStorage);

  useFlamelingsSound();

  // Friends: keep each coded pet's card current, and pick up playdate visits
  // when the game opens (pets without a code never touch the network).
  useEffect(() => {
    if (!ready || locked) return;
    void collectVisits();
    return startOnlineSync();
  }, [ready, locked]);

  const timers = useRef<{ tick?: number; beat?: number }>({});

  const startTimers = useCallback(() => {
    window.clearInterval(timers.current.tick);
    window.clearInterval(timers.current.beat);
    timers.current.tick = window.setInterval(tick, TICK_MS);
    timers.current.beat = window.setInterval(heartbeat, HEARTBEAT_MS);
  }, [tick, heartbeat]);
  const stopTimers = useCallback(() => {
    window.clearInterval(timers.current.tick);
    window.clearInterval(timers.current.beat);
  }, []);

  useEffect(() => {
    const removeHooks = installTestHooks();
    init();
    startTimers();
    const onPageHide = () => releaseLock();
    const onStore = (event: StorageEvent) => onStorage(event.key);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("storage", onStore);
    return () => {
      removeHooks();
      stopTimers();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("storage", onStore);
      releaseLock();
    };
  }, [init, startTimers, stopTimers, onStorage]);

  // Hidden pages stop their timers and save; coming back catches up at once
  // (an idle iPad fires no other event, so the version poll runs on its own).
  useVisibilityPause({
    onPersist: tick,
    onHidden: stopTimers,
    onVisible: () => {
      void collectVisits();
      heartbeat();
      tick();
      startTimers();
    },
  });

  useGameServiceWorker("flamelings");
  const { isUpdateReady, update } = useGameUpdate("flamelings", {
    saveNow: tick,
    serviceWorker: true,
  });

  return (
    <GameShell
      className={`${flDisplay.variable} ${CHROME_BG}`}
      testId="flamelings-root"
    >
      {!ready ? (
        <div
          role="status"
          className="grid h-full place-items-center text-4xl"
          aria-label="Loading"
        >
          <span aria-hidden="true">🔥</span>
        </div>
      ) : locked ? (
        <TabLocked />
      ) : (
        <div
          key={
            view.screen === "shelf" ||
            view.screen === "hatch" ||
            view.screen === "grove"
              ? view.screen
              : `${view.screen}-${view.petId}`
          }
          data-testid="flamelings-screen"
          className="fl-screen-in h-full"
        >
          {view.screen === "shelf" ? (
            <Shelf />
          ) : view.screen === "hatch" ? (
            <Hatch />
          ) : view.screen === "grove" ? (
            <MemoryGrove />
          ) : view.screen === "friends" ? (
            <FriendsScreen petId={view.petId} from={view.from} />
          ) : (
            <PetView petId={view.petId} />
          )}
        </div>
      )}
      {outdated && !locked && (
        <div
          role="alert"
          data-testid="flamelings-unsaved"
          className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <button
            type="button"
            onClick={update}
            className={`${DISPLAY} flex min-h-16 touch-manipulation items-center gap-3 rounded-3xl bg-gradient-to-b from-[#ff6b5a] to-[#e0352b] px-5 py-2 text-left text-xl font-semibold text-white shadow-[0_5px_0_#a8231b,0_10px_20px_rgba(30,10,40,.3)] transition-transform active:translate-y-[3px] ${FOCUS_RING}`}
          >
            <span aria-hidden="true" className="text-3xl">
              💾🚫
            </span>
            <span>
              Not saving yet!
              <span className="block font-sans text-sm font-bold text-white/90">
                Tap to update <span aria-hidden="true">✨</span>, then your
                progress saves again
              </span>
            </span>
          </button>
        </div>
      )}
      {isUpdateReady && !outdated && !locked && (
        <UpdatePill
          onUpdate={update}
          testId="flamelings-update"
          label="Update ready ✨ — tap to update"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
          buttonClassName={`${DISPLAY} pointer-events-auto min-h-16 touch-manipulation rounded-full bg-gradient-to-b from-[#ff8a3d] to-[#f2542d] px-6 py-3 text-xl font-semibold text-white shadow-[0_5px_0_#c2410c,0_10px_20px_rgba(30,10,40,.3)] transition-transform active:translate-y-[3px] ${FOCUS_RING}`}
        />
      )}
      {ready && !locked && celebration && (
        <CelebrationCard celebration={celebration} />
      )}
    </GameShell>
  );
}
