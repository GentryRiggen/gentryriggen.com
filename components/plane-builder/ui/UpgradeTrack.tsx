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
import { planeSynth } from "../audio/planeSynth";
import { formatCoins } from "./format";
import { coinButtonClass } from "./styles";

const FLASH_MS = 600;
/** Long enough for a screen reader to pick the message up before it clears. */
const ANNOUNCE_MS = 2500;

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
  const [announcement, setAnnouncement] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(flashTimer.current);
      clearTimeout(announceTimer.current);
    },
    []
  );

  const def = catalog[track];
  const label = TRACK_LABELS[track];
  const price = tierPrice(def, tier);
  const isMaxed = price === null;
  const missing = isMaxed ? 0 : Math.max(0, price - coins);
  const canAfford = !isMaxed && missing === 0;

  let buyName = `Buy ${label} for ${price} coins`;
  if (isMaxed) buyName = `${label} maxed`;
  else if (!canAfford) buyName = `Buy ${label}, need ${missing} more coins`;

  const handleBuy = () => {
    if (isMaxed || !onBuy(track)) return;
    planeSynth.play("buy");
    setIsFlashing(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setIsFlashing(false), FLASH_MS);
    setAnnouncement(`Bought ${def.parts[tier + 1]}!`);
    clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => setAnnouncement(""), ANNOUNCE_MS);
  };

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 short:gap-2 short:p-2 dark:border-slate-700 dark:bg-slate-800 ${
        isFlashing ? "motion-safe:animate-pulse" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {label}{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {def.parts[tier]}
          </span>
          <span className="sr-only">
            , tier {tier} of {MAX_TIER}
          </span>
        </p>
        <div aria-hidden="true" className="my-1 flex gap-1 short:my-0.5">
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
        {isMaxed ? null : (
          <p className="text-sm text-slate-600 short:sr-only dark:text-slate-300">
            Next: {TRACK_EFFECTS[track]}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={!canAfford}
        aria-label={buyName}
        onClick={handleBuy}
        className={coinButtonClass}
      >
        {isMaxed ? "Maxed" : `Buy 🪙${formatCoins(price)}`}
      </button>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </li>
  );
}
