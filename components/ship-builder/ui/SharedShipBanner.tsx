"use client";

import { Gift } from "lucide-react";
import { useEffect } from "react";
import { saveShip } from "@/lib/ship-builder/persist/local";
import { useSharedLinkStore } from "@/lib/ship-builder/state/sharedLink";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, primaryButtonClass } from "./styles";

const SAVE_FAILED_NOTICE = "Couldn't save a copy: browser storage is full";

/**
 * Shown when the builder opened from a friend's share link: a friendly hello
 * with two ways forward, keeping a copy or starting a fresh ship.
 */
export default function SharedShipBanner() {
  const sharedShip = useSharedLinkStore((s) => s.ship);
  const dismiss = useSharedLinkStore((s) => s.dismiss);
  const currentShip = useShipBuilderStore((s) => s.ship);

  // Once the ship on screen is no longer the one from the link, the hello is
  // out of date.
  const isStale = sharedShip !== null && currentShip !== sharedShip;
  useEffect(() => {
    if (isStale) dismiss();
  }, [isStale, dismiss]);
  if (!sharedShip || isStale) return null;

  function handleKeep() {
    const { ship, savedId, markSaved, setNotice } =
      useShipBuilderStore.getState();
    const saved = saveShip(ship, savedId);
    if (!saved) {
      setNotice(SAVE_FAILED_NOTICE);
      return;
    }
    markSaved(saved.id);
    setNotice("Saved to My Ships");
    dismiss();
  }

  function handleBuildOwn() {
    const { ship, newShip } = useShipBuilderStore.getState();
    newShip(ship.kind);
    dismiss();
  }

  return (
    <section
      aria-label="Shared ship"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-sky-200 bg-sky-50 px-3 py-2 text-sky-950 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"
    >
      <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
        <Gift aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span>
          A friend shared this ship!
          {sharedShip.name.trim() ? (
            <span className="ml-1 font-semibold">{sharedShip.name.trim()}</span>
          ) : null}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleKeep}
          className={`${primaryButtonClass} min-h-11`}
        >
          Keep a copy
        </button>
        <button
          type="button"
          onClick={handleBuildOwn}
          className={`${buttonClass} min-h-11`}
        >
          Build your own
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="min-h-11 min-w-11 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ✕
        </button>
      </div>
    </section>
  );
}
