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
      const state = useShipBuilderStore.getState();
      const key = event.key.toLowerCase();

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
