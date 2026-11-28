"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { resetWalkInput, walkInput, walkMapFor } from "@/lib/shipwreck/walk";
import {
  LIFT_DOWN,
  LIFT_UP,
  setWalkInputOff,
  type SceneRuntime,
} from "@/components/shipwreck/scene/runtime";
import Icon from "./Icon";
import WalkJoystick from "./WalkJoystick";
import WalkLookLayer from "./WalkLookLayer";
import { FOCUS } from "./styles";

/** A big round picture button (80 px) for the walk controls. */
const BIG = `pointer-events-auto grid size-20 shrink-0 touch-manipulation place-items-center rounded-full border-2 shadow-lg shadow-black/50 backdrop-blur-md active:scale-95 ${FOCUS}`;
const BIG_OFF = `${BIG} border-white/40 bg-slate-950/70 text-white dark:bg-slate-950/70`;
/** The get-in button glows amber (as Walk does): something to tap. */
const BOARD = `${BIG} border-amber-100 bg-amber-400 text-slate-950 dark:border-amber-100 dark:bg-amber-400 dark:text-slate-950`;
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

interface Feel {
  canReboard: boolean;
  /** The lifeboat beside the walker they can get in, or −1. */
  boardable: number;
  /** The splash being rippled (its count), or 0: none. */
  ripple: number;
  /** The deck door within reach (a stairs index), or −1: none. */
  door: number;
  /** Standing inside her (a room, the staircase, Scotland Road). */
  inside: boolean;
  /** The lift wipe being shown (its count), or 0: none. */
  lift: number;
  /** In her glass car: which ways a ride can go (`walkLiftDirs`). */
  liftDirs: number;
}

/** How long the ripple wipe shows (ms; its keyframes run 600 ms). */
const RIPPLE_MS = 700;
/** And the lift wipe (ms; its keyframes run 900 ms). */
const LIFT_MS = 1000;

function readFeel(rt: SceneRuntime, ripple = 0, lift = 0): Feel {
  return {
    canReboard: rt.walkCanReboard,
    boardable: rt.boardable,
    ripple,
    door: rt.walkDoor,
    inside: rt.walkInside,
    lift,
    liftDirs: rt.walkLiftDirs,
  };
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
    let liftSeen = runtime.walkLift;
    let liftUntil = -Infinity;
    const loop = () => {
      const now = performance.now();
      if (runtime.walkSplash !== seen) {
        seen = runtime.walkSplash;
        rippleUntil = now + RIPPLE_MS;
      }
      if (runtime.walkLift !== liftSeen) {
        liftSeen = runtime.walkLift;
        liftUntil = now + LIFT_MS;
      }
      const next = readFeel(
        runtime,
        now < rippleUntil ? seen : 0,
        now < liftUntil ? liftSeen : 0
      );
      setFeel((f) =>
        f.canReboard === next.canReboard &&
        f.boardable === next.boardable &&
        f.ripple === next.ripple &&
        f.door === next.door &&
        f.inside === next.inside &&
        f.lift === next.lift &&
        f.liftDirs === next.liftDirs
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
 * water: Back on deck (while she can be boarded) and Look under. Sits
 * under the night HUD, whose
 * play, speeds and timeline stay.
 */
export default function WalkHud({
  store,
  runtime,
  hidden = false,
}: WalkHudProps) {
  const phase = useStore(store, (s) => s.walk.phase);
  const lookUnder = useStore(store, (s) => s.walk.lookUnder);
  const ship = useStore(store, (s) => s.ship);
  const on = phase !== "off" && !hidden;
  // Under the end card the walk keys and held input stop (WalkRunner).
  useEffect(() => {
    setWalkInputOff(runtime, hidden);
    if (hidden) resetWalkInput();
  }, [runtime, hidden]);
  useEffect(() => () => setWalkInputOff(runtime, false), [runtime]);
  const feel = useFeel(runtime, on);
  if (!on) return null;
  const canWalk = walkMapFor(ship) !== null;
  const water = phase === "water";
  const boat = phase === "boat";
  const deck = phase === "deck";

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

      {/* The lift: the screen goes dark and clears (not with reduced motion). */}
      {feel.lift > 0 && (
        <div
          key={feel.lift}
          aria-hidden="true"
          data-testid="shipwreck-walk-lift"
          className="pointer-events-none absolute inset-0 animate-[shipwreck-lift_900ms_ease-in-out_both] bg-black motion-reduce:hidden"
        />
      )}

      {/* Fly: back to the free camera. Next to the help button from sm
          up; on a phone the clock card reaches there, so under the help
          and sound buttons in the right column instead. */}
      <button
        type="button"
        aria-label="Fly"
        data-walk-control
        data-testid="shipwreck-walk-fly"
        onClick={() => store.getState().leaveWalk()}
        className={`absolute right-[max(1rem,env(safe-area-inset-right))] top-[calc(max(0.75rem,env(safe-area-inset-top))+10.5rem)] sm:right-[calc(max(1rem,env(safe-area-inset-right))+4.75rem)] sm:top-[max(0.75rem,env(safe-area-inset-top))] ${BIG_OFF}`}
      >
        <Icon name="fly" className="size-11" />
      </button>

      {/* No stick in a lifeboat: it rows itself. */}
      {!boat && (
        <div
          className={`absolute left-[max(1rem,env(safe-area-inset-left))] flex items-end gap-3 ${OVER_BAR}`}
        >
          <WalkJoystick />
          {/* Jump, beside the stick (on her deck: a running jump at the
              railing goes over the side). */}
          {deck && !feel.inside && (
            <button
              type="button"
              aria-label="Jump"
              data-testid="shipwreck-walk-jump"
              data-walk-control
              onPointerDown={(e) => {
                e.preventDefault();
                walkInput.jump = true;
              }}
              onClick={(e) => {
                // A keyboard press (Enter); a tap jumped on pointer down.
                if (e.detail === 0) walkInput.jump = true;
              }}
              className={BIG_OFF}
            >
              <Icon name="jump" className="size-11" />
            </button>
          )}
        </div>
      )}

      {/* Inside her: back out by the door (the way they came in if dry).
          In her glass car, the lift's up and down over it (each only when
          a dry stop is that way; no wipe: the ride is seen). */}
      {deck && feel.inside && (
        <div
          className={`absolute right-[max(1rem,env(safe-area-inset-right))] flex flex-col items-end gap-3 ${OVER_MARKS}`}
        >
          {(feel.liftDirs & LIFT_UP) !== 0 && (
            <button
              type="button"
              aria-label="Lift up"
              data-testid="shipwreck-lift-up"
              data-walk-control
              onClick={() => {
                walkInput.lift = "up";
              }}
              className={BOARD}
            >
              <Icon name="lift-up" className="size-11" />
            </button>
          )}
          {(feel.liftDirs & LIFT_DOWN) !== 0 && (
            <button
              type="button"
              aria-label="Lift down"
              data-testid="shipwreck-lift-down"
              data-walk-control
              onClick={() => {
                walkInput.lift = "down";
              }}
              className={BOARD}
            >
              <Icon name="lift-down" className="size-11" />
            </button>
          )}
          <button
            type="button"
            aria-label="Go outside"
            data-testid="shipwreck-go-outside"
            data-walk-control
            onClick={() => {
              walkInput.outside = true;
            }}
            className={BIG_OFF}
          >
            <Icon name="door-out" className="size-11" />
          </button>
        </div>
      )}

      {/* At a deck door: go in. Beside the lifeboat button's place on a wide
          screen; stacked above it on a phone, where the Jump button sits in
          that row. */}
      {deck && !feel.inside && feel.door >= 0 && (
        <div className="absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+20rem)] right-[max(1rem,env(safe-area-inset-right))] sm:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+11rem)] sm:right-[calc(max(1rem,env(safe-area-inset-right))+5.5rem)]">
          <button
            type="button"
            aria-label="Go inside"
            data-testid="shipwreck-go-inside"
            data-walk-control
            onClick={() => {
              walkInput.door = true;
            }}
            className={BOARD}
          >
            <Icon name="door-in" className="size-11" />
          </button>
        </div>
      )}

      {/* Beside a lifeboat on her deck: get in (it lowers at once). */}
      {deck && feel.boardable >= 0 && (
        <div
          className={`absolute right-[max(1rem,env(safe-area-inset-right))] ${OVER_MARKS}`}
        >
          <button
            type="button"
            aria-label="Get in the lifeboat"
            data-testid="shipwreck-board-boat"
            data-walk-control
            onClick={() => store.getState().boardBoat(feel.boardable)}
            className={BOARD}
          >
            <Icon name="lifeboat" className="size-11" />
          </button>
        </div>
      )}

      {/* In a lifeboat: back on her deck (a ship you can't walk: Fly). */}
      {boat && canWalk && (
        <div
          className={`absolute right-[max(1rem,env(safe-area-inset-right))] ${OVER_MARKS}`}
        >
          <button
            type="button"
            aria-label="Back on deck"
            data-testid="shipwreck-leave-boat"
            data-walk-control
            onClick={() => store.getState().leaveBoat()}
            className={BIG_OFF}
          >
            <Icon name="on-deck" className="size-11" />
          </button>
        </div>
      )}

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
