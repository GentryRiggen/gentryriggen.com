"use client";

import { useEffect, useState } from "react";
import { COMBO_CAP, COMBO_MIN, useGameStore } from "@/lib/planet-smasher/store";
import { playComboCue } from "../audio/sfx";

/** The badge stays this long after the last hit (the combo window). */
const SHOW_MS = 1200;
const FADE_MS = 250;

interface Shown {
  count: number;
  seq: number;
  fading: boolean;
}

/**
 * "COMBO ×4!" under the health bar while quick hits chain. It listens to
 * the store's `lastHit` (like the Odometer's pop-off), not to a selector,
 * so the ding plays once per hit.
 */
export default function ComboBadge() {
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    let fade: ReturnType<typeof setTimeout> | undefined;
    let hide: ReturnType<typeof setTimeout> | undefined;
    let lastCount = 0;
    const off = useGameStore.subscribe((s, prev) => {
      const hit = s.lastHit;
      if (!hit || hit === prev.lastHit) return;
      // Later ticks of the same shot keep the badge up without a new ding.
      const repeat = hit.combo === lastCount && hit.combo >= COMBO_MIN;
      lastCount = hit.combo;
      if (repeat) {
        clearTimeout(fade);
        clearTimeout(hide);
        setShown((c) => (c ? { ...c, fading: false } : c));
        fade = setTimeout(
          () => setShown((c) => (c ? { ...c, fading: true } : c)),
          SHOW_MS - FADE_MS
        );
        hide = setTimeout(() => setShown(null), SHOW_MS);
        return;
      }
      clearTimeout(fade);
      clearTimeout(hide);
      if (hit.combo < COMBO_MIN) {
        setShown(null);
        return;
      }
      setShown({ count: hit.combo, seq: hit.seq, fading: false });
      playComboCue(hit.combo);
      fade = setTimeout(
        () => setShown((c) => (c ? { ...c, fading: true } : c)),
        SHOW_MS - FADE_MS
      );
      hide = setTimeout(() => setShown(null), SHOW_MS);
    });
    return () => {
      off();
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)] flex justify-center sm:top-[calc(max(0.75rem,env(safe-area-inset-top))+12rem)]"
    >
      {shown && (
        <div
          key={shown.seq}
          data-testid="combo-badge"
          className={`flex animate-[ps-combo_0.5s_ease-out] flex-col items-center transition-opacity duration-200 ${
            shown.fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="bg-gradient-to-b from-amber-300 to-red-500 bg-clip-text text-4xl font-black text-transparent drop-shadow-[0_3px_4px_rgba(0,0,0,0.8)] sm:text-6xl">
            COMBO ×{shown.count}!
          </span>
          <span className="text-lg font-black text-yellow-200 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] sm:text-2xl">
            +{Math.min(shown.count, COMBO_CAP)} ⭐
          </span>
        </div>
      )}
    </div>
  );
}
