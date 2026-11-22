"use client";

import { useStore } from "zustand";
import { PLACES_BY_SHIP } from "@/lib/shipwreck/places";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { SceneRuntime } from "./runtime";

interface PlacePinsProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
}

/**
 * The place pins: plain buttons over the canvas. The X-ray layer moves each
 * one to its place on screen every frame (riding with the ship) and writes
 * the live water depth under the selected one. Tapping a pin flies there.
 */
export default function PlacePins({ store, runtime }: PlacePinsProps) {
  const place = useStore(store, (s) => s.place);
  const ship = useStore(store, (s) => s.ship);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PLACES_BY_SHIP[ship].map(({ id, label }) => {
        const selected = place === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`shipwreck-pin-${id}`}
            ref={(el) => {
              const label = el?.querySelector<HTMLElement>("[data-water]");
              if (el && label) runtime.pins.set(id, { el, label });
              else runtime.pins.delete(id);
            }}
            onClick={() => store.getState().flyToPlace(id)}
            className={`pointer-events-auto absolute left-0 top-0 hidden min-h-11 touch-manipulation select-none flex-col items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold shadow-lg backdrop-blur ${
              selected
                ? "z-10 border-sky-300 bg-sky-500/80 text-white"
                : "border-white/40 bg-slate-900/60 text-slate-100 dark:bg-slate-900/60"
            }`}
          >
            <span>{label}</span>
            <span
              data-water
              className={`text-xs font-normal text-sky-50 ${selected ? "" : "hidden"}`}
            >
              …
            </span>
          </button>
        );
      })}
    </div>
  );
}
