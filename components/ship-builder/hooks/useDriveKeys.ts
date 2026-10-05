"use client";

import { useEffect } from "react";
import { resetSailInput, sailInput } from "@/lib/ship-builder/state/sailInput";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

/** The throttle settings the keys step through, so stop is always a stop. */
const THROTTLE_STEPS = [-0.3, 0, 0.25, 0.5, 0.75, 1] as const;

const STEER_LEFT = new Set(["arrowleft", "a"]);
const STEER_RIGHT = new Set(["arrowright", "d"]);
const THROTTLE_UP = new Set(["arrowup", "w"]);
const THROTTLE_DOWN = new Set(["arrowdown", "s"]);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function nextThrottle(current: number, direction: 1 | -1): number {
  const steps = [...THROTTLE_STEPS];
  if (direction === 1) return steps.find((s) => s > current + 1e-6) ?? 1;
  return [...steps].reverse().find((s) => s < current - 1e-6) ?? steps[0];
}

/**
 * Arrow keys and WASD steer (hold to turn, release to centre) and step the
 * throttle; Space stops. Active only while sailing, and it leaves the keys
 * alone when a field or a modal dialog has the keyboard.
 *
 * Escape is not handled here: `useKeyboardShortcuts` already ends the drive on
 * Escape, and handling it twice would end it twice.
 */
export default function useDriveKeys(): void {
  useEffect(() => {
    const held = new Set<"left" | "right">();

    function applyRudder() {
      const left = held.has("left");
      const right = held.has("right");
      sailInput.rudder = left === right ? 0 : right ? 1 : -1;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (useShipBuilderStore.getState().drive.status !== "sailing") return;

      const key = event.key === " " ? "space" : event.key.toLowerCase();
      if (STEER_LEFT.has(key)) held.add("left");
      else if (STEER_RIGHT.has(key)) held.add("right");
      else if (THROTTLE_UP.has(key)) {
        if (!event.repeat) {
          sailInput.throttle = nextThrottle(sailInput.throttle, 1);
        }
      } else if (THROTTLE_DOWN.has(key)) {
        if (!event.repeat) {
          sailInput.throttle = nextThrottle(sailInput.throttle, -1);
        }
      } else if (key === "space") {
        sailInput.throttle = 0;
      } else return;

      // Arrows and Space would otherwise scroll the page or press a button.
      event.preventDefault();
      applyRudder();
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (STEER_LEFT.has(key)) held.delete("left");
      else if (STEER_RIGHT.has(key)) held.delete("right");
      else return;
      applyRudder();
    }

    function onBlur() {
      held.clear();
      applyRudder();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      resetSailInput();
    };
  }, []);
}
