"use client";

import { ArrowUp, LogOut, Snowflake } from "lucide-react";
import { useEffect, useState } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { walkInput } from "@/lib/ship-builder/state/walkInput";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import useWalkKeys from "../hooks/useWalkKeys";
import { focusWalkButton } from "./WalkButton";
import WalkJoystick from "./WalkJoystick";
import WalkLookLayer from "./WalkLookLayer";
import { panelClass } from "./styles";

const HINT_VISIBLE_MS = 5000;

function StopWalkingButton() {
  const stopWalk = useShipBuilderStore((s) => s.stopWalk);

  function handleStop() {
    stopWalk();
    focusWalkButton();
  }

  return (
    <button
      type="button"
      onClick={handleStop}
      className={`pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:bg-slate-800 dark:focus-visible:outline-sky-400 ${panelClass}`}
    >
      <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
      Stop walking
    </button>
  );
}

/** Asks for a jump on press; the walker only leaves the ground if it can. */
function JumpButton() {
  return (
    <button
      type="button"
      aria-label="Jump"
      onPointerDown={(event) => {
        event.preventDefault();
        walkInput.jump = true;
      }}
      onKeyDown={(event) => {
        // A focused button would take Space as a click; useWalkKeys jumps.
        if (event.key === " ") event.preventDefault();
      }}
      className={`pointer-events-auto inline-flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border text-sm font-semibold shadow-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:bg-slate-800 dark:focus-visible:outline-sky-400 ${panelClass}`}
    >
      <ArrowUp aria-hidden="true" className="h-6 w-6" />
    </button>
  );
}

/** A short first-time hint that fades after a few seconds or on first input. */
function WalkHint() {
  const reducedMotion = usePrefersReducedMotion();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismiss = () => setIsDismissed(true);
    const timer = setTimeout(dismiss, HINT_VISIBLE_MS);
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("pointerdown", dismiss, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, []);

  return (
    <p
      role="status"
      data-testid="walk-hint"
      className={`pointer-events-none absolute inset-x-0 bottom-40 mx-auto w-fit max-w-[90%] rounded-full bg-slate-900/80 px-4 py-1.5 text-center text-sm font-medium text-white dark:bg-slate-100/90 dark:text-slate-900 ${
        isDismissed ? "opacity-0" : "opacity-100"
      } ${reducedMotion ? "" : "transition-opacity duration-700"}`}
    >
      Drag to look · stick to walk · jump to climb
    </p>
  );
}

/** Strikes an iceberg at a fixed spot and keeps walking while she goes down. */
function SinkShipButton() {
  const canSink = useShipBuilderStore((s) => s.trial.status === "idle");
  const sinkWhileWalking = useShipBuilderStore((s) => s.sinkWhileWalking);
  if (!canSink) return null;
  return (
    <button
      type="button"
      onClick={sinkWhileWalking}
      className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-full bg-rose-700 px-4 text-sm font-semibold text-white shadow-lg hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:bg-rose-500 dark:text-slate-900 dark:hover:bg-rose-400 dark:focus-visible:outline-rose-300"
    >
      <Snowflake aria-hidden="true" className="h-5 w-5 shrink-0" />
      Hit with an iceberg
    </button>
  );
}

function WalkingControls() {
  useWalkKeys();
  // The trial's status pill sits top centre; on narrow screens the buttons
  // drop below it instead of hiding behind it.
  const isTrialShown = useShipBuilderStore((s) => s.trial.status !== "idle");

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <WalkLookLayer />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div
          className={`flex items-start justify-end gap-2 ${
            isTrialShown ? "mt-14 lg:mt-0" : ""
          }`}
        >
          <SinkShipButton />
          <StopWalkingButton />
        </div>
        <div className="flex items-end justify-between">
          <WalkJoystick />
          <JumpButton />
        </div>
      </div>
      <WalkHint />
    </div>
  );
}

/** The walk controls: look-drag, joystick, keys, a hint and the way out. */
export default function WalkHud() {
  const isWalking = useShipBuilderStore((s) => s.walk.status === "walking");
  if (!isWalking) return null;
  return <WalkingControls />;
}
