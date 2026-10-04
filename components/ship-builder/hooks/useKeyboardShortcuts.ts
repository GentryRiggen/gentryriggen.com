"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export default function useKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      // A modal dialog owns the keyboard; editing the ship behind it would be
      // invisible and surprising.
      if (document.querySelector('[aria-modal="true"]')) return;
      const state = useShipBuilderStore.getState();
      const key = event.key.toLowerCase();

      // During a sea trial the ship is frozen (the store ignores edits too);
      // swallow the editing keys so Backspace never navigates away, and let
      // Escape leave the trial.
      if (state.trial.status !== "idle") {
        if (key === "escape") state.endTrial();
        else if (key === "delete" || key === "backspace")
          event.preventDefault();
        else if ((event.metaKey || event.ctrlKey) && key === "z") {
          event.preventDefault();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (key === "r") {
        state.rotate();
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        state.requestDelete();
      } else if (key === "escape") {
        if (state.pendingRemoval) state.cancelRemoval();
        else state.cancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
