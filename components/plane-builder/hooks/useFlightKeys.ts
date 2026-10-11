"use client";

import { useEffect } from "react";
import {
  flightInput,
  resetFlightInput,
} from "@/lib/plane-builder/state/flightInput";

const CLIMB = new Set(["w", "arrowup"]);
const DIVE = new Set(["s", "arrowdown"]);
const LEFT = new Set(["a", "arrowleft"]);
const RIGHT = new Set(["d", "arrowright"]);
const BOOST = new Set(["shift", " "]);
const HANDLED = new Set([...CLIMB, ...DIVE, ...LEFT, ...RIGHT, ...BOOST]);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * WASD or arrows steer, Shift or Space boosts. Tracks every key held, so
 * releasing one leaves the others working. Writes the shared `flightInput`.
 */
export default function useFlightKeys(): void {
  useEffect(() => {
    const held = new Set<string>();

    function any(keys: Set<string>): boolean {
      for (const key of keys) if (held.has(key)) return true;
      return false;
    }

    function apply() {
      flightInput.pitch = (any(CLIMB) ? 1 : 0) - (any(DIVE) ? 1 : 0);
      flightInput.bank = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
      flightInput.boost = any(BOOST);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (!HANDLED.has(key)) return;
      event.preventDefault();
      if (event.repeat) return;
      held.add(key);
      apply();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (!held.delete(event.key.toLowerCase())) return;
      apply();
    }

    function onBlur() {
      held.clear();
      apply();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      resetFlightInput();
    };
  }, []);
}
