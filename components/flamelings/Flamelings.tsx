"use client";

import { useEffect } from "react";
import { installTestHooks } from "@/lib/flamelings/testHooks";
import { useFlamelings } from "@/lib/flamelings/store";
import CelebrationCard from "./CelebrationCard";
import Hatch from "./Hatch";
import MemoryGrove from "./MemoryGrove";
import PetView from "./PetView";
import Shelf from "./Shelf";

/** How often the game catches up with the clock while the page is open. */
const TICK_MS = 15_000;

export default function Flamelings() {
  const ready = useFlamelings((s) => s.ready);
  const view = useFlamelings((s) => s.view);
  const celebration = useFlamelings((s) => s.celebrations[0]);
  const init = useFlamelings((s) => s.init);
  const tick = useFlamelings((s) => s.tick);

  useEffect(() => {
    const removeHooks = installTestHooks();
    init();
    const interval = window.setInterval(tick, TICK_MS);
    const onVisible = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onVisible);
    return () => {
      removeHooks();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onVisible);
    };
  }, [init, tick]);

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
      ) : view.screen === "shelf" ? (
        <Shelf />
      ) : view.screen === "hatch" ? (
        <Hatch />
      ) : view.screen === "grove" ? (
        <MemoryGrove />
      ) : (
        <PetView key={view.petId} petId={view.petId} />
      )}
      {ready && celebration && <CelebrationCard celebration={celebration} />}
    </div>
  );
}
