import type { WhatIfStorm } from "./save";
import type { ShipSpec } from "./ships/types";
import { VENTS_SPOT, whatIfSpots } from "./sim/run";

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

/** A spot's short label: "Hatch 3", "Vents and railing", "Boiler room 1". */
export function spotLabel(spec: ShipSpec, id: string): string {
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
  if (spec.cause === "storm") {
    if (id === VENTS_SPOT)
      return `Her two broken vents and the split by her railing: ${on ? "broken, letting water in" : "whole"}`;
    if (id.startsWith("hatch-"))
      return `${label} cover: ${on ? "leaking" : "sealed tight"}`;
    const k = Number(id.slice(6));
    return `${label}, ${shoalWhere(spec, k)}, where she may have touched Six Fathom Shoal: ${on ? "scraped" : "not touched"}`;
  }
  if (spec.cause === "torpedo")
    return `${label}: ${on ? "a torpedo hits here" : "no torpedo"}`;
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
