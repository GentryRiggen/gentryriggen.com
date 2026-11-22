"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { SceneRuntime } from "@/components/shipwreck/scene/runtime";
import Icon from "./Icon";
import WalkJoystick from "./WalkJoystick";
import WalkLookLayer from "./WalkLookLayer";
import { FOCUS } from "./styles";

/** A big round picture button (80 px) for the walk controls. */
const BIG = `pointer-events-auto grid size-20 shrink-0 touch-manipulation place-items-center rounded-full border-2 shadow-lg shadow-black/50 backdrop-blur-md active:scale-95 ${FOCUS}`;
const BIG_OFF = `${BIG} border-white/40 bg-slate-950/70 text-white dark:bg-slate-950/70`;
const BIG_ON = `${BIG} border-sky-200 bg-sky-500/90 text-white dark:bg-sky-500/90`;

/** Above the bottom bar (play, speeds, the timeline), which wraps on a phone. */
const OVER_BAR =
  "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+14rem)] sm:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+7.5rem)]";

/**
 * Higher still on the right: the timeline's event marks stand over its
 * track there.
 */
const OVER_MARKS =
  "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+14rem)] sm:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+11rem)]";

type Edge = "top" | "bottom" | "left" | "right";

/** Where the slide arrows sit, and which way they point (Icon "slide" points down). */
const EDGE_CLASS: Record<Edge, string> = {
  top: "inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+5.5rem)] flex justify-center [&>svg]:rotate-180",
  bottom: `inset-x-0 ${OVER_BAR} flex justify-center`,
  left: "left-[max(1rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2 [&>svg]:rotate-90",
  right:
    "right-[max(1rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2 [&>svg]:-rotate-90",
};

interface Feel {
  /** The downhill edge while sliding, else null. */
  edge: Edge | null;
  /** True from half the slide up (brighter, pulsing arrows). */
  hard: boolean;
  canReboard: boolean;
  /** The splash being rippled (its count), or 0: none. */
  ripple: number;
}

/** How long the ripple wipe shows (ms; its keyframes run 600 ms). */
const RIPPLE_MS = 700;

function readFeel(rt: SceneRuntime, ripple = 0): Feel {
  const canReboard = rt.walkCanReboard;
  if (rt.walkSlide <= 0) return { edge: null, hard: false, canReboard, ripple };
  const [right, ahead] = rt.walkDownhill;
  const edge: Edge =
    Math.abs(right) > Math.abs(ahead)
      ? right > 0
        ? "right"
        : "left"
      : ahead > 0
        ? "top"
        : "bottom";
  return { edge, hard: rt.walkSlide >= 0.5, canReboard, ripple };
}

/**
 * Reads the walk's few on-screen values from the scene runtime once a
 * frame, re-rendering only when one changes. A splash (going in) starts
 * the ripple wipe.
 */
function useFeel(runtime: SceneRuntime, on: boolean): Feel {
  const [feel, setFeel] = useState<Feel>(() => readFeel(runtime));
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let seen = runtime.walkSplash;
    let rippleUntil = -Infinity;
    const loop = () => {
      const now = performance.now();
      if (runtime.walkSplash !== seen) {
        seen = runtime.walkSplash;
        rippleUntil = now + RIPPLE_MS;
      }
      const next = readFeel(runtime, now < rippleUntil ? seen : 0);
      setFeel((f) =>
        f.edge === next.edge &&
        f.hard === next.hard &&
        f.canReboard === next.canReboard &&
        f.ripple === next.ripple
          ? f
          : next
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [runtime, on]);
  return feel;
}

interface WalkHudProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  /** Hidden under the end card. */
  hidden?: boolean;
}

/**
 * The walk's own controls, pictures only (words only in `aria-label`):
 * the stick bottom left, drag anywhere else to look, Fly top right. In the
 * water: Back on deck (while she can be boarded) and Look under. Sliding
 * shows arrows at the downhill edge. Sits under the night HUD, whose
 * play, speeds and timeline stay.
 */
export default function WalkHud({
  store,
  runtime,
  hidden = false,
}: WalkHudProps) {
  const phase = useStore(store, (s) => s.walk.phase);
  const lookUnder = useStore(store, (s) => s.walk.lookUnder);
  const on = phase !== "off" && !hidden;
  const feel = useFeel(runtime, on);
  if (!on) return null;
  const water = phase === "water";

  return (
    <div
      data-testid="shipwreck-walk-hud"
      className="pointer-events-none absolute inset-0"
    >
      <WalkLookLayer />

      {/* Going in: rings of water wipe out from the middle (not with reduced motion). */}
      {feel.ripple > 0 && (
        <div
          key={feel.ripple}
          aria-hidden="true"
          data-testid="shipwreck-walk-ripple"
          className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
        >
          {["", "[animation-delay:90ms]", "[animation-delay:180ms]"].map(
            (delay) => (
              <div
                key={delay}
                className={`absolute left-1/2 top-1/2 size-[70vmax] -translate-x-1/2 -translate-y-1/2 animate-[shipwreck-ripple_600ms_ease-out_both] rounded-full border-[1.5rem] border-sky-200/60 bg-sky-300/10 ${delay}`}
              />
            )
          )}
        </div>
      )}

      {feel.edge && !water && (
        <div
          aria-hidden="true"
          data-testid="shipwreck-walk-slide"
          data-edge={feel.edge}
          className={`pointer-events-none absolute text-amber-300 ${EDGE_CLASS[feel.edge]} ${
            feel.hard ? "opacity-100 motion-safe:animate-pulse" : "opacity-80"
          }`}
        >
          <Icon name="slide" className="size-24 drop-shadow-lg" />
        </div>
      )}

      {/* Fly: back to the free camera (next to the help button). */}
      <button
        type="button"
        aria-label="Fly"
        data-walk-control
        onClick={() => store.getState().leaveWalk()}
        className={`absolute right-[calc(max(1rem,env(safe-area-inset-right))+4.75rem)] top-[max(0.75rem,env(safe-area-inset-top))] ${BIG_OFF}`}
      >
        <Icon name="orbit" className="size-11" />
      </button>

      <div
        className={`absolute left-[max(1rem,env(safe-area-inset-left))] ${OVER_BAR}`}
      >
        <WalkJoystick />
      </div>

      {water && (
        <div
          className={`absolute right-[max(1rem,env(safe-area-inset-right))] flex flex-col items-end gap-3 ${OVER_MARKS}`}
        >
          {feel.canReboard && (
            <button
              type="button"
              aria-label="Back on deck"
              data-walk-control
              onClick={() => store.getState().backOnDeck()}
              className={BIG_OFF}
            >
              <Icon name="on-deck" className="size-11" />
            </button>
          )}
          <button
            type="button"
            aria-label={lookUnder ? "Come up" : "Look under the water"}
            aria-pressed={lookUnder}
            data-walk-control
            onClick={() => store.getState().setLookUnder(!lookUnder)}
            className={lookUnder ? BIG_ON : BIG_OFF}
          >
            <Icon name="look-under" className="size-11" />
          </button>
        </div>
      )}
    </div>
  );
}
