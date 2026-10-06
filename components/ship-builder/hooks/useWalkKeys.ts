"use client";

import { useEffect } from "react";
import { resetWalkInput, walkInput } from "@/lib/ship-builder/state/walkInput";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

type Direction =
  "forward" | "back" | "left" | "right" | "turnLeft" | "turnRight";

const KEY_DIRECTIONS: Record<string, Direction> = {
  w: "forward",
  arrowup: "forward",
  s: "back",
  arrowdown: "back",
  a: "left",
  d: "right",
  arrowleft: "turnLeft",
  q: "turnLeft",
  arrowright: "turnRight",
  e: "turnRight",
};

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
 * W/S or Up/Down walk, A/D strafe, Left/Right arrows and Q/E turn. Hold to
 * move, release to stop. Active only while walking, and it leaves the keys
 * alone when a field or a modal dialog has the keyboard.
 *
 * Escape is not handled here: `useKeyboardShortcuts` already stops walking on
 * Escape, and handling it twice would stop it twice.
 */
export default function useWalkKeys(): void {
  useEffect(() => {
    const held = new Set<Direction>();

    function axis(positive: Direction, negative: Direction): number {
      return Number(held.has(positive)) - Number(held.has(negative));
    }

    function applyInput() {
      walkInput.forward = axis("forward", "back");
      walkInput.strafe = axis("right", "left");
      walkInput.turn = axis("turnRight", "turnLeft");
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (useShipBuilderStore.getState().walk.status !== "walking") return;

      const direction = KEY_DIRECTIONS[event.key.toLowerCase()];
      if (!direction) return;
      // Arrows would otherwise scroll the page.
      event.preventDefault();
      held.add(direction);
      applyInput();
    }

    function onKeyUp(event: KeyboardEvent) {
      const direction = KEY_DIRECTIONS[event.key.toLowerCase()];
      if (!direction || !held.delete(direction)) return;
      applyInput();
    }

    function onBlur() {
      held.clear();
      applyInput();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      resetWalkInput();
    };
  }, []);
}
