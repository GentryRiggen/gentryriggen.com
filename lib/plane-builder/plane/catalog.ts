// lib/plane-builder/plane/catalog.ts
export const TRACK_IDS = [
  "launcher",
  "wings",
  "engine",
  "fuel",
  "body",
  "multiplier",
] as const;
export type TrackId = (typeof TRACK_IDS)[number];

/** Tiers run 0 (starter) to MAX_TIER. */
export const MAX_TIER = 8;
export const PRICE_GROWTH = 1.5;

export type Tiers = Record<TrackId, number>;

export const STARTER_TIERS: Tiers = {
  launcher: 0,
  wings: 0,
  engine: 0,
  fuel: 0,
  body: 0,
  multiplier: 0,
};

export const TRACK_LABELS: Record<TrackId, string> = {
  launcher: "Launcher",
  wings: "Wings",
  engine: "Engine",
  fuel: "Fuel",
  body: "Body",
  multiplier: "Coin boost",
};

/** Shown as "<label> <n> → <effect>". */
export const TRACK_EFFECTS: Record<TrackId, string> = {
  launcher: "launch faster",
  wings: "glide further",
  engine: "more push",
  fuel: "fly longer",
  body: "less drag and more bump shields",
  multiplier: "more coins every flight",
};

export interface TrackDef {
  /** Price of tier 1; each later tier costs PRICE_GROWTH times more. */
  basePrice: number;
  /** Stat value at tiers 0..MAX_TIER. */
  values: readonly number[];
  /** Part name at tiers 0..MAX_TIER. */
  parts: readonly string[];
}

export type PlaneCatalog = Record<TrackId, TrackDef>;

/** MAX_TIER + 1 values from `from` to `to`, eased by `curve` (1 = linear). */
export function ladder(from: number, to: number, curve = 1): number[] {
  return Array.from({ length: MAX_TIER + 1 }, (_, i) => {
    const value = from + (to - from) * (i / MAX_TIER) ** curve;
    return Math.round(value * 10000) / 10000;
  });
}

/** Coins to go from `currentTier` to the next, or null at the top. */
export function tierPrice(track: TrackDef, currentTier: number): number | null {
  if (currentTier >= MAX_TIER) return null;
  return Math.round(track.basePrice * PRICE_GROWTH ** currentTier);
}

interface TrackSpec {
  basePrice: number;
  from: number;
  to: number;
  curve?: number;
}

type CatalogSpec = Record<TrackId, TrackSpec> & {
  /** Names for the first tiers; missing ones repeat the last with a number. */
  parts: Record<TrackId, readonly string[]>;
};

function padParts(names: readonly string[]): string[] {
  return Array.from({ length: MAX_TIER + 1 }, (_, i) =>
    i < names.length ? names[i] : `${names[names.length - 1]} ${i + 1}`
  );
}

export function makeCatalog(spec: CatalogSpec): PlaneCatalog {
  const entries = TRACK_IDS.map((id) => {
    const track = spec[id];
    const def: TrackDef = {
      basePrice: track.basePrice,
      values: ladder(track.from, track.to, track.curve),
      parts: padParts(spec.parts[id]),
    };
    return [id, def] as const;
  });
  return Object.fromEntries(entries) as PlaneCatalog;
}
