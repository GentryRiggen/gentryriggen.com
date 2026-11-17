"use client";

import { useEffect } from "react";
import { installTestHooks } from "@/lib/flamelings/testHooks";
import { releaseLock, useFlamelings } from "@/lib/flamelings/store";
import { HEARTBEAT_MS } from "@/lib/flamelings/tabLock";
import CelebrationCard from "./CelebrationCard";
import Hatch from "./Hatch";
import MemoryGrove from "./MemoryGrove";
import PetView from "./PetView";
import Shelf from "./Shelf";
import TabLocked from "./TabLocked";

/** How often the game catches up with the clock while the page is open. */
const TICK_MS = 15_000;

export default function Flamelings() {
  const ready = useFlamelings((s) => s.ready);
  const view = useFlamelings((s) => s.view);
  const celebration = useFlamelings((s) => s.celebrations[0]);
  const locked = useFlamelings((s) => s.locked);
  const init = useFlamelings((s) => s.init);
  const tick = useFlamelings((s) => s.tick);
  const heartbeat = useFlamelings((s) => s.heartbeat);
  const onStorage = useFlamelings((s) => s.onStorage);

  useEffect(() => {
    const removeHooks = installTestHooks();
    init();
    const interval = window.setInterval(tick, TICK_MS);
    const beat = window.setInterval(heartbeat, HEARTBEAT_MS);
    const onVisible = () => tick();
    const onHide = () => {
      tick();
      releaseLock();
    };
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) init();
    };
    const onStore = (event: StorageEvent) => onStorage(event.key);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("storage", onStore);
    return () => {
      removeHooks();
      window.clearInterval(interval);
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("storage", onStore);
      releaseLock();
    };
  }, [init, tick, heartbeat, onStorage]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-amber-100 dark:bg-slate-900">
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
      ) : view.screen === "shelf" ? (
        <Shelf />
      ) : view.screen === "hatch" ? (
        <Hatch />
      ) : view.screen === "grove" ? (
        <MemoryGrove />
      ) : (
        <PetView key={view.petId} petId={view.petId} />
      )}
      {ready && !locked && celebration && (
        <CelebrationCard celebration={celebration} />
      )}
    </div>
  );
}
