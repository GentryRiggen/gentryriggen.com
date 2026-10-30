"use client";

import { useSyncExternalStore } from "react";
import { flightInput } from "@/lib/plane-builder/state/flightInput";
import { flightLive } from "@/lib/plane-builder/state/flightLive";

export interface FlightSnapshot {
  /** Sim seconds since launch. */
  time: number;
  /** Sim seconds at the finish line, once crossed. */
  finishTime: number | null;
  maxX: number;
  speed: number;
  fuel: number;
  shields: number;
  coins: number;
  /** Coins from near misses so far. */
  nearMissCoins: number;
  /** Near misses in the running combo. */
  combo: number;
  finished: boolean;
  /** Boost held (Shift, Space or the button), whether or not it has fuel. */
  boost: boolean;
}

let cached: FlightSnapshot | null = null;

function read(): FlightSnapshot | null {
  const s = flightLive.get();
  if (!s) return null;
  return {
    time: s.time,
    finishTime: s.finishTime,
    maxX: s.maxX,
    speed: s.speed,
    fuel: s.fuel,
    shields: s.shields,
    coins: s.coins,
    nearMissCoins: s.nearMissCoins,
    combo: s.combo,
    finished: s.finished,
    boost: flightInput.boost,
  };
}

function subscribe(onChange: () => void): () => void {
  cached = read();
  const unsubscribe = flightLive.subscribe(() => {
    // Rebuilt only here, so getSnapshot is stable between notifies.
    cached = read();
    onChange();
  });
  return () => {
    unsubscribe();
    cached = null;
  };
}

/** The running flight as the HUD sees it, refreshed on `flightLive.notify`. */
export default function useFlightSnapshot(): FlightSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    () => cached,
    () => null
  );
}
