"use client";

import { useEffect, useRef } from "react";
import { loadAutosave, saveAutosave } from "@/lib/ship-builder/persist/local";
import { droppedPartsNotice } from "@/lib/ship-builder/persist/schema";
import { decodeShareHash } from "@/lib/ship-builder/persist/share";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

export const AUTOSAVE_DELAY_MS = 500;
const STORAGE_NOTICE =
  "Browser storage is unavailable — your ship won't be saved";
const RESTORE_NOTICE = "Couldn't restore your last ship";

export default function useShipPersistence() {
  // StrictMode re-runs this effect but keeps refs. The initial load must run
  // once: the first run clears the hash, so a second run would restore the
  // autosave over a just-loaded shared ship.
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

    /**
     * Returns true only when a shared ship was loaded. A bad link leaves the
     * current ship alone, so on page load the caller still restores the
     * autosave instead of letting an empty hull autosave over it.
     */
    function loadFromHash(): boolean {
      const result = decodeShareHash(window.location.hash);
      if (result.kind === "none") return false;
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      if (result.kind === "invalid") {
        store.getState().setNotice("Couldn't load that ship");
        return false;
      }
      // A share link is an explicit "replace my ship"; loadShip does nothing
      // mid-trial, so leave the trial first.
      store.getState().endTrial();
      store.getState().loadShip(result.ship, null);
      const notice = droppedPartsNotice(result.dropped);
      if (notice) store.getState().setNotice(notice);
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
        // Restoring on page load isn't an edit: don't offer to undo into the
        // empty default hull.
        if (saved.kind === "ok") {
          store
            .getState()
            .loadShip(saved.ship, saved.savedId, { resetHistory: true });
          const notice = droppedPartsNotice(saved.dropped);
          if (notice) store.getState().setNotice(notice);
        } else if (saved.kind === "invalid") {
          // loadAutosave backed the unreadable autosave up, since the next
          // change overwrites it.
          store.getState().setNotice(RESTORE_NOTICE);
        }
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
