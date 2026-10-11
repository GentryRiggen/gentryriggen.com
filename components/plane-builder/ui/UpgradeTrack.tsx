"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_TIER,
  TRACK_EFFECTS,
  TRACK_LABELS,
  tierPrice,
  type PlaneCatalog,
  type TrackId,
} from "@/lib/plane-builder/plane/catalog";
import { formatCoins } from "./format";
import { coinButtonClass } from "./styles";

const FLASH_MS = 600;

interface UpgradeTrackProps {
  track: TrackId;
  catalog: PlaneCatalog;
  tier: number;
  coins: number;
  /** Returns true when the purchase went through. */
  onBuy: (track: TrackId) => boolean;
}

export default function UpgradeTrack({
  track,
  catalog,
  tier,
  coins,
  onBuy,
}: UpgradeTrackProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const def = catalog[track];
  const label = TRACK_LABELS[track];
  const price = tierPrice(def, tier);
  const isMaxed = price === null;
  const canAfford = !isMaxed && coins >= price;

  const handleBuy = () => {
    if (!onBuy(track)) return;
    setIsFlashing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsFlashing(false), FLASH_MS);
  };

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800 ${
        isFlashing ? "animate-pulse" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {label}{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {def.parts[tier]}
          </span>
        </p>
        <div aria-hidden="true" className="my-1 flex gap-1">
          {Array.from({ length: MAX_TIER }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                i < tier
                  ? "bg-sky-500 dark:bg-sky-400"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {label} {tier + 1} → {TRACK_EFFECTS[track]}
        </p>
      </div>
      <button
        type="button"
        disabled={!canAfford}
        aria-label={
          isMaxed ? `${label} maxed` : `Buy ${label} for ${price} coins`
        }
        onClick={handleBuy}
        className={coinButtonClass}
      >
        {isMaxed ? "Maxed" : `Buy 🪙${formatCoins(price)}`}
      </button>
    </li>
  );
}
