import type { WhatIfStorm, WhatIfWave } from "./save";
import type { ShipSpec } from "./ships/types";
import { FINISHER_SPOT, VENTS_SPOT, whatIfSpots } from "./sim/run";
import { clockText } from "./story";

/**
 * Words for a What-if's spots (shared by the editor and the hull diagram):
 * a compartment's label, or a storm ship's hatch, vents and shoal strips.
 */

/** Where a storm ship's shoal strip k (from 1) is: "front, starboard". */
function shoalWhere(spec: ShipSpec, k: number): string {
  const o = spec.shoalOpenings?.[k - 1];
  if (!o) return "";
  const hold = /(\d)/.exec(o.compartmentId)?.[1];
  const part = hold === "1" ? "front" : hold === "2" ? "middle" : "back";
  return `${part}, ${o.side}`;
}

/** The U-boat's return (`FINISHER_SPOT`): its toggle's label. */
export const FINISHER_LABEL = "The U-boat comes back";

/** When a torpedo ship's later torpedo lands, on her clock ("10:50 AM"). */
export function finisherClock(spec: ShipSpec): string | null {
  const fin = spec.torpedo?.finisher;
  return fin ? clockText(fin.t, spec.clockStartS) : null;
}

/** A spot's short label: "Hatch 3", "Vents and railing", "Boiler room 1". */
export function spotLabel(spec: ShipSpec, id: string): string {
  const wave = spec.wave?.spots.find((s) => s.id === id);
  if (wave) return wave.label;
  if (id === FINISHER_SPOT && spec.torpedo?.finisher) return FINISHER_LABEL;
  if (spec.cause === "storm") {
    if (id === VENTS_SPOT) return "Vents and railing";
    const hatch = /^hatch-(\d+)$/.exec(id);
    if (hatch) return `Hatch ${hatch[1]}`;
    const shoal = /^shoal-(\d+)$/.exec(id);
    if (shoal) return `Shoal scrape ${shoal[1]}`;
  }
  return spec.compartments.find((c) => c.id === id)?.label ?? id;
}

/** A spot's spoken label, with what choosing it means. */
export function spotAria(spec: ShipSpec, id: string, on: boolean): string {
  const label = spotLabel(spec, id);
  if (spec.cause === "wave")
    return `${label}: ${on ? "the wave smashes it" : "the wave leaves it whole"}`;
  if (spec.cause === "storm") {
    if (id === VENTS_SPOT)
      return `Her two broken vents and the split by her railing: ${on ? "broken, letting water in" : "whole"}`;
    if (id.startsWith("hatch-"))
      return `${label} cover: ${on ? "leaking" : "sealed tight"}`;
    const k = Number(id.slice(6));
    return `${label}, ${shoalWhere(spec, k)}, where she may have touched Six Fathom Shoal: ${on ? "scraped" : "not touched"}`;
  }
  if (spec.cause === "torpedo" && spec.torpedo) {
    if (id === FINISHER_SPOT)
      return `${label}: ${on ? `a last torpedo at ${finisherClock(spec)}` : "no last torpedo"}`;
    return `${label}: ${on ? `a torpedo hits her ${spec.torpedo.side} side here` : "no torpedo"}`;
  }
  if (spec.cause === "torpedo")
    return `${label}: ${on ? "a torpedo hits here" : "no torpedo"}`;
  if (spec.cause === "mine")
    return `${label}: ${on ? "a mine hits here" : "no mine"}`;
  if (spec.cause === "rocks")
    return `${label}: ${on ? "the rock tears it open" : "not torn"}`;
  return `${label}: ${on ? "open" : "closed"}`;
}

/** A storm ship's spots in the editor's groups. */
export function stormSpotGroups(spec: ShipSpec): {
  hatches: string[];
  vents: string[];
  shoal: string[];
} {
  const spots = whatIfSpots(spec);
  return {
    hatches: spots.filter((id) => id.startsWith("hatch-")),
    vents: spots.filter((id) => id === VENTS_SPOT),
    shoal: spots.filter((id) => id.startsWith("shoal-")),
  };
}

/** A wave ship's What-if wave: its chip's words, spoken label and help. */
export interface WaveChoice {
  id: WhatIfWave;
  /** The chip's picture. */
  icon: "wave-big" | "wave-small" | "wave-ahead";
  label: string;
  aria: string;
  /** One short line under the chip while it is chosen. */
  help: string;
}

export const WAVE_CHOICES: readonly WaveChoice[] = [
  {
    id: "real",
    icon: "wave-big",
    label: "Real wave",
    aria: "Real wave: a giant wave, as tall as a ten-storey building, hits her side",
    help: "On the real night a giant wave hit her left side.",
  },
  {
    id: "smaller",
    icon: "wave-small",
    label: "Smaller wave",
    aria: "Smaller wave: half as tall, hits her side",
    help: "A wave half as tall hits her left side.",
  },
  {
    id: "ahead",
    icon: "wave-ahead",
    label: "Wave from ahead",
    aria: "Wave from ahead: the giant wave comes at her bow instead of her side",
    help: "The giant wave comes at her front, not her side.",
  },
];

/** A wave What-if's choice in a few words: "7 smashed spots", "Nothing smashed". */
export function waveChoiceText(ids: readonly string[]): string {
  return ids.length === 0
    ? "Nothing smashed"
    : `${ids.length} smashed ${ids.length === 1 ? "spot" : "spots"}`;
}

/** The storm setting's words. */
export const STORM_LABEL: Record<WhatIfStorm, string> = {
  real: "Real storm",
  calmer: "Calmer",
  worse: "Worse",
};

/**
 * A storm What-if's choice in a few words: "21 leaky hatches · broken
 * vents · 3 shoal scrapes", or "No damage" (every hatch sealed tight).
 */
export function stormChoiceText(
  spec: ShipSpec,
  ids: readonly string[]
): string {
  const g = stormSpotGroups(spec);
  const h = ids.filter((id) => g.hatches.includes(id)).length;
  const v = ids.some((id) => g.vents.includes(id));
  const s = ids.filter((id) => g.shoal.includes(id)).length;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} leaky ${h === 1 ? "hatch" : "hatches"}`);
  if (v) parts.push("broken vents");
  if (s > 0) parts.push(`${s} shoal ${s === 1 ? "scrape" : "scrapes"}`);
  return parts.length === 0 ? "No damage" : parts.join(" · ");
}

/** A mine ship's What-if toggle (the Britannic's, R14). */
export interface MineToggle {
  id: "portholes" | "doors" | "engines";
  /** Its picture. */
  icon: "porthole" | "door" | "engine";
  /** The button's words, on (the real morning) or off. */
  label: (on: boolean) => string;
  /** Its spoken label, with what tapping it does. */
  aria: (on: boolean) => string;
  /** One short line under it: what it was on the real morning. */
  help: string;
}

/**
 * The three things a mine What if can change besides where the mines hit,
 * each on for the real morning: her portholes open, a watertight door
 * stuck open, and her run for Kea. No blame: what happened, not who.
 */
export const MINE_TOGGLES: readonly MineToggle[] = [
  {
    id: "portholes",
    icon: "porthole",
    label: (on) => (on ? "Portholes open" : "Portholes shut"),
    aria: (on) =>
      on
        ? "Portholes open: tap to shut them"
        : "Portholes shut: tap to open them",
    help: "Low windows near her front were open for fresh air.",
  },
  {
    id: "doors",
    icon: "door",
    label: (on) => (on ? "Doors stuck open" : "Doors closed"),
    aria: (on) =>
      on
        ? "A watertight door stuck open: tap to close every door"
        : "Every watertight door closed: tap to leave one stuck open",
    help: "A door between two boiler rooms did not shut all the way.",
  },
  {
    id: "engines",
    icon: "engine",
    label: (on) => (on ? "Run for Kea" : "Engines stopped"),
    aria: (on) =>
      on
        ? "Running for the island of Kea: tap to stop her engines at once"
        : "Engines stopped at once: tap to run for the island of Kea",
    help: "She steamed for the shore of Kea. Moving pushes water in.",
  },
];

/**
 * A rocks ship's one What-if toggle (the Costa Concordia's): the wind that
 * pushed her back onto the rocks, or blowing her out to sea instead. On is
 * the real night (back to the island).
 */
export const TO_SEA_TOGGLE = {
  icon: "wind" as const,
  /** The button's words, on (the real night's wind) or off (out to sea). */
  label: (toSea: boolean) => (toSea ? "Wind out to sea" : "Wind to the island"),
  /** Its spoken label, with what tapping it does. */
  aria: (toSea: boolean) =>
    toSea
      ? "The wind blows her out to sea: tap to blow her back to the island"
      : "The wind blows her back to the island: tap to blow her out to sea",
  /** One short line under it: what the wind did on the real night. */
  help: "On the real night the wind pushed her back toward the island.",
};
