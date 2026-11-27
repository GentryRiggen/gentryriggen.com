"use client";

import { useEffect, useRef } from "react";
import { SHIP_IDS, getShip } from "@/lib/shipwreck/ships";
import type { ShipId } from "@/lib/shipwreck/ships/types";
import Icon, { type IconName } from "./Icon";
import { FOCUS } from "./styles";

/**
 * Any ship in any wreck (1.14): a row of picture cards, one per ship's
 * story, so a child who cannot read yet can choose what happens by its
 * picture (an iceberg, a torpedo, a snow storm, three torpedoes, a mine,
 * rocks, a giant wave) on the sky of its time of day. The chosen ship's
 * own wreck wears a star: the real one.
 */
interface WreckPickerProps {
  /** The chosen ship (her own wreck gets the star). */
  ship: ShipId;
  /** The chosen wreck (her own when none was picked). */
  wreck: ShipId;
  onWreck: (wreck: ShipId) => void;
}

interface WreckCard {
  icon: IconName;
  /** How many of the icon (the Carpathia's three torpedoes). */
  count?: number;
  /** One short word under the picture, for whoever can read it. */
  word: string;
  /** Spoken: what happens, where and when. */
  says: string;
  /** Its sky (Tailwind gradient): night, afternoon, storm, morning. */
  sky: string;
  /** A little moon or sun in the corner. */
  light: "moon" | "sun" | "snow";
}

export const WRECK_CARDS: Record<ShipId, WreckCard> = {
  titanic: {
    icon: "iceberg",
    word: "Iceberg",
    says: "an iceberg in the North Atlantic, at night",
    sky: "from-indigo-950 via-slate-900 to-sky-950",
    light: "moon",
  },
  lusitania: {
    icon: "torpedo",
    word: "Torpedo",
    says: "a torpedo off the coast of Ireland, in the afternoon",
    sky: "from-sky-400 via-sky-600 to-blue-900",
    light: "sun",
  },
  fitzgerald: {
    icon: "storm",
    word: "Snow storm",
    says: "a snow storm on Lake Superior",
    sky: "from-slate-400 via-slate-600 to-slate-800",
    light: "snow",
  },
  carpathia: {
    icon: "torpedo",
    count: 3,
    word: "3 torpedoes",
    says: "three torpedoes far out at sea, in the morning",
    sky: "from-sky-300 via-sky-500 to-blue-800",
    light: "sun",
  },
  britannic: {
    icon: "mine",
    word: "Mine",
    says: "a mine near the island of Kea, in the morning",
    sky: "from-amber-200 via-sky-400 to-blue-800",
    light: "sun",
  },
  concordia: {
    icon: "rocks",
    word: "Rocks",
    says: "rocks by the island of Giglio, at night",
    sky: "from-violet-950 via-indigo-900 to-slate-900",
    light: "moon",
  },
  poseidon: {
    icon: "wave",
    word: "Giant wave",
    says: "a giant wave far out at sea, at night",
    sky: "from-slate-950 via-blue-950 to-cyan-950",
    light: "moon",
  },
};

/** Spoken: "the Titanic's iceberg". */
export function wreckWords(wreck: ShipId): string {
  return WRECK_CARDS[wreck].says;
}

export default function WreckPicker({
  ship,
  wreck,
  onWreck,
}: WreckPickerProps) {
  const strip = useRef<HTMLDivElement>(null);
  // On a phone the cards are one sideways row: keep the chosen one in view.
  useEffect(() => {
    const el = strip.current;
    const card = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !card || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
  }, [wreck]);
  const shipName = getShip(ship).name;

  return (
    <div
      role="radiogroup"
      aria-label={`Choose what happens to the ${shipName}`}
      ref={strip}
      data-testid="shipwreck-wrecks"
      className="pointer-events-auto flex w-full shrink-0 snap-x gap-2 overflow-x-auto overscroll-x-contain px-1 py-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-x-visible short:flex-nowrap short:justify-start short:overflow-x-auto [&::-webkit-scrollbar]:hidden"
    >
      {SHIP_IDS.map((id) => {
        const card = WRECK_CARDS[id];
        const on = id === wreck;
        const own = id === ship;
        const from = getShip(id).name;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={
              own
                ? `What happens: her real wreck, ${card.says}`
                : `What happens: the ${from}'s wreck, ${card.says}`
            }
            data-testid={`shipwreck-wreck-${id}`}
            onClick={() => onWreck(id)}
            className={`relative flex h-20 w-24 shrink-0 snap-center touch-manipulation flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border bg-gradient-to-b ${card.sky} shadow-lg shadow-black/40 active:scale-95 sm:h-[5.5rem] sm:w-28 short:h-16 short:w-24 ${
              on
                ? "border-sky-200 ring-4 ring-sky-400/80"
                : "border-white/15 opacity-75 hover:opacity-100"
            } ${FOCUS}`}
          >
            <Light kind={card.light} />
            <span className="flex items-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
              {Array.from({ length: card.count ?? 1 }, (_, k) => (
                <Icon
                  key={k}
                  name={card.icon}
                  className={
                    (card.count ?? 1) > 1
                      ? "-mx-1 size-7 sm:size-8 short:size-6"
                      : "size-10 sm:size-11 short:size-8"
                  }
                />
              ))}
            </span>
            <span className="whitespace-nowrap rounded-full bg-slate-950/50 px-2 text-[0.7rem] font-semibold leading-4 text-white">
              {card.word}
            </span>
            {own && (
              <span
                role="img"
                aria-label="Her real wreck"
                data-testid={`shipwreck-wreck-real-${id}`}
                className="absolute left-1 top-1 text-base leading-none text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              >
                ★
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The card's moon, sun or falling snow, small in its top-right corner. */
function Light({ kind }: { kind: WreckCard["light"] }) {
  if (kind === "snow")
    return (
      <span aria-hidden="true" className="absolute right-1.5 top-1 flex gap-1">
        <span className="size-1 rounded-full bg-white/90" />
        <span className="mt-1.5 size-1 rounded-full bg-white/80" />
        <span className="size-1 rounded-full bg-white/90" />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={`absolute right-1.5 top-1.5 size-3 rounded-full ${
        kind === "sun"
          ? "bg-amber-200 shadow-[0_0_8px_rgba(253,230,138,0.9)]"
          : "bg-slate-100 shadow-[0_0_6px_rgba(241,245,249,0.7)]"
      }`}
    />
  );
}
