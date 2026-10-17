"use client";

import { useEffect, useRef, useState } from "react";
import {
  LAUNCH_ZONE_BOOST,
  gaugeZone,
  hasLaunchGauge,
} from "@/lib/plane-builder/minigame/gauge";
import { flightToasts } from "@/lib/plane-builder/state/flightToasts";
import { planeSynth } from "../audio/planeSynth";
import { MAX_AIM_PITCH, MAX_AIM_YAW } from "@/lib/plane-builder/sim/constants";
import { aimFromDrag } from "@/lib/plane-builder/sim/aim";
import { launchAim, resetLaunchAim } from "@/lib/plane-builder/state/launchAim";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import TimingGauge from "./TimingGauge";
import { secondaryButtonClass } from "./styles";

const MIN_LAUNCH_POWER = 0.1;
const KEY_AIM_STEP = 0.05;
const KEY_POWER_PER_SECOND = 1;

const LAUNCH_TOASTS = {
  green: "Perfect launch!",
  yellow: "Good launch",
  red: "Oops!",
} as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

/** Starts the flight with what the slingshot holds, then slackens the band. */
function fire(boost?: number) {
  const aim = { ...launchAim, ...(boost === undefined ? {} : { boost }) };
  resetLaunchAim();
  planeSynth.play("launch");
  usePlaneBuilderStore.getState().beginFlight(aim);
}

/**
 * The launch screen's input layer: drag back and let go, or use the keyboard
 * (arrows aim, hold Space to pull, release to launch). Writes the shared
 * `launchAim` the slingshot draws from.
 */
export default function LaunchOverlay() {
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const openLevel = usePlaneBuilderStore((s) => s.openLevel);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const [isTouchHint, setIsTouchHint] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const hasGauge = usePlaneBuilderStore((s) =>
    hasLaunchGauge(s.progress.levels[s.levelId].tiers)
  );
  const hasGaugeRef = useRef(hasGauge);
  const gaugePosition = useRef(0);

  useEffect(() => {
    hasGaugeRef.current = hasGauge;
  }, [hasGauge]);

  /** Fires, boosted by where the gauge was when the band was let go. */
  function release() {
    setIsPulling(false);
    if (!hasGaugeRef.current) {
      fire();
      return;
    }
    const zone = gaugeZone(gaugePosition.current);
    flightToasts.push(LAUNCH_TOASTS[zone]);
    fire(LAUNCH_ZONE_BOOST[zone]);
  }

  useEffect(() => {
    resetLaunchAim();
    // Pointer type is only known in the browser, so it can't be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTouchHint(window.matchMedia?.("(pointer: coarse)").matches ?? false);
    return resetLaunchAim;
  }, []);

  useEffect(() => {
    let isHolding = false;
    let frame = 0;
    let last = 0;

    function pull(now: number) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      launchAim.power = hasGaugeRef.current
        ? 1
        : Math.min(1, launchAim.power + KEY_POWER_PER_SECOND * dt);
      frame = requestAnimationFrame(pull);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        openLevel(levelId);
        return;
      }
      if (key === "arrowup") launchAim.pitch += KEY_AIM_STEP;
      else if (key === "arrowdown") launchAim.pitch -= KEY_AIM_STEP;
      else if (key === "arrowright") launchAim.yaw += KEY_AIM_STEP;
      else if (key === "arrowleft") launchAim.yaw -= KEY_AIM_STEP;
      else if (key === " ") {
        event.preventDefault();
        if (!isHolding) {
          isHolding = true;
          setIsPulling(true);
          if (hasGaugeRef.current) launchAim.power = 1;
          last = performance.now();
          frame = requestAnimationFrame(pull);
        }
        return;
      } else return;
      event.preventDefault();
      launchAim.pitch = clamp(launchAim.pitch, 0, MAX_AIM_PITCH);
      launchAim.yaw = clamp(launchAim.yaw, -MAX_AIM_YAW, MAX_AIM_YAW);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key !== " " || !isHolding) return;
      isHolding = false;
      cancelAnimationFrame(frame);
      if (launchAim.power >= MIN_LAUNCH_POWER) release();
      else {
        setIsPulling(false);
        launchAim.power = 0;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [levelId, openLevel]);

  function maxDrag() {
    return Math.min(window.innerWidth, window.innerHeight) * 0.4;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (origin.current) return;
    origin.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (hasGauge) launchAim.power = 1;
    setIsPulling(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = origin.current;
    if (!start || start.id !== event.pointerId) return;
    Object.assign(
      launchAim,
      aimFromDrag(event.clientX - start.x, event.clientY - start.y, maxDrag())
    );
    if (hasGauge) launchAim.power = 1;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = origin.current;
    if (!start || start.id !== event.pointerId) return;
    origin.current = null;
    if (launchAim.power >= MIN_LAUNCH_POWER) release();
    else {
      setIsPulling(false);
      resetLaunchAim();
    }
  }

  function handlePointerCancel() {
    origin.current = null;
    setIsPulling(false);
    resetLaunchAim();
  }

  return (
    <div
      data-testid="launch-overlay"
      className="pointer-events-auto absolute inset-0 z-10 cursor-grab touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <button
        type="button"
        onClick={() => openLevel(levelId)}
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute left-3 top-3 ${secondaryButtonClass}`}
      >
        ← Hangar
      </button>
      {hasGauge && isPulling ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-72 max-w-[calc(100%-2rem)]">
          <TimingGauge
            isRunning
            positionRef={gaugePosition}
            ariaLabel="Launch timing"
          />
        </div>
      ) : null}
      <p className="pointer-events-none absolute inset-x-4 bottom-8 mx-auto w-fit max-w-full rounded-full bg-white/90 px-4 py-2 text-center text-base font-bold text-slate-800 shadow dark:bg-slate-900/90 dark:text-slate-100">
        {isTouchHint
          ? "Drag back to aim, let go to launch!"
          : "Drag back to aim, let go to launch! (Keyboard: arrows aim, hold Space to pull)"}
        {hasGauge ? " Let go in the green for a boost!" : ""}
      </p>
    </div>
  );
}
