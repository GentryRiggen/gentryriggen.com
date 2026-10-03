"use client";

import { useEffect, useRef } from "react";
import { loadAutosave, saveAutosave } from "@/lib/ship-builder/persist/local";
import { decodeShareHash } from "@/lib/ship-builder/persist/share";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

export const AUTOSAVE_DELAY_MS = 500;
const STORAGE_NOTICE =
  "Browser storage is unavailable — your ship won't be saved";

export default function useShipPersistence() {
  // StrictMode re-runs this effect but keeps refs. The initial load must run
  // once: after an invalid hash the first run clears the hash, so a second
  // run would wrongly restore the old autosave.
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const store = useShipBuilderStore;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warned = false;

    function flush() {
      timer = undefined;
      const { ship, savedId } = store.getState();
      if (!saveAutosave(ship, savedId) && !warned) {
        warned = true;
        store.getState().setNotice(STORAGE_NOTICE);
      }
    }

    // Subscribe first so a ship loaded below is autosaved too.
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.ship === prev.ship && state.savedId === prev.savedId) return;
      clearTimeout(timer);
      timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    });

    function loadFromHash(): boolean {
      const result = decodeShareHash(window.location.hash);
      if (result.kind === "none") return false;
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      if (result.kind === "ok") {
        store.getState().loadShip(result.ship, null);
      } else {
        store.getState().setNotice("Couldn't load that ship");
      }
      return true;
    }

    function flushPending() {
      if (timer === undefined) return;
      clearTimeout(timer);
      flush();
    }

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      if (!loadFromHash()) {
        const saved = loadAutosave();
        if (saved) store.getState().loadShip(saved.ship, saved.savedId);
      }
    }

    window.addEventListener("hashchange", loadFromHash);
    // A change made just before the tab closes would otherwise be lost to the
    // debounce.
    window.addEventListener("pagehide", flushPending);
    return () => {
      window.removeEventListener("hashchange", loadFromHash);
      window.removeEventListener("pagehide", flushPending);
      unsubscribe();
      // Flush instead of dropping: StrictMode remounts would otherwise lose
      // a just-loaded shared ship.
      flushPending();
    };
  }, []);
}
