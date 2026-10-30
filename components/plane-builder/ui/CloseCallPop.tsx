"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  nearMissPop,
  nearMissText,
} from "@/lib/plane-builder/state/nearMissPop";

const POP_MS = 1100;
/** Angles of the speed lines, degrees, down both sides of the screen. */
const LINE_ANGLES = [-170, -150, -130, 130, 150, 170, -30, -10, 10, 30];

/**
 * "Close call! ×3" for a near miss, with a quick flash of speed lines round
 * the screen. Reduced motion keeps the words and drops the lines.
 */
export default function CloseCallPop() {
  const pop = useSyncExternalStore(
    nearMissPop.subscribe,
    nearMissPop.get,
    () => null
  );
  const [expiredId, setExpiredId] = useState<number | null>(null);
  const id = pop?.id ?? null;

  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(() => setExpiredId(id), POP_MS);
    return () => clearTimeout(timer);
  }, [id]);

  const visible = pop !== null && pop.id !== expiredId ? pop : null;
  if (!visible) return <p aria-live="polite" className="sr-only" />;

  return (
    <>
      <div
        key={`lines-${visible.id}`}
        aria-hidden="true"
        data-testid="close-call-lines"
        className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      >
        {LINE_ANGLES.map((angle) => (
          <span
            key={angle}
            className="pb-speed-line absolute left-1/2 top-1/2 h-1 w-[22vmin] origin-left rounded-full bg-gradient-to-r from-transparent to-sky-500 [animation-iteration-count:1] dark:to-sky-200"
            style={{ "--angle": `${angle}deg` } as React.CSSProperties}
          />
        ))}
      </div>
      <p
        key={visible.id}
        aria-hidden="true"
        data-testid="close-call"
        className="pb-pop absolute inset-x-3 top-[55%] text-center text-2xl sm:text-3xl font-black text-amber-300 drop-shadow-lg [text-shadow:0_2px_0_rgb(15_23_42),0_0_8px_rgb(15_23_42)] dark:text-amber-200"
      >
        {nearMissText(visible.multiplier)}
        {visible.coins > 0 ? (
          <span className="mt-1 block text-xl text-white">
            +{visible.coins} <span aria-hidden="true">🪙</span>
          </span>
        ) : null}
      </p>
      <p aria-live="polite" className="sr-only">
        {nearMissText(visible.multiplier)}
      </p>
    </>
  );
}
