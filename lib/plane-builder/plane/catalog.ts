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

/** Shown as "Next: <effect>", so each reads as what the next part does. */
export const TRACK_EFFECTS: Record<TrackId, string> = {
  launcher: "launch faster",
  wings: "glide further",
  engine: "zoom faster",
  fuel: "fly longer",
  body: "fly smoother and survive more bumps",
  multiplier: "more coins every flight",
};

export interface TrackDef {
  /** Price of tier 1; each later tier costs PRICE_GROWTH times more. */
  basePrice: number;
  /** Overrides tier 1's price only, so a world can open with a cheap first buy. */
  firstPrice?: number;
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
  if (currentTier === 0 && track.firstPrice !== undefined)
    return track.firstPrice;
  return Math.round(track.basePrice * PRICE_GROWTH ** currentTier);
}

interface TrackSpec {
  basePrice: number;
  firstPrice?: number;
  from: number;
  to: number;
  curve?: number;
}

type CatalogSpec = Record<TrackId, TrackSpec> & {
  /** One name per tier (MAX_TIER + 1 each); makeCatalog throws otherwise. */
  parts: Record<TrackId, readonly string[]>;
};

function checkParts(id: TrackId, names: readonly string[]): readonly string[] {
  if (names.length !== MAX_TIER + 1) {
    throw new Error(
      `Track "${id}" needs ${MAX_TIER + 1} part names, got ${names.length}`
    );
  }
  return names;
}

export function makeCatalog(spec: CatalogSpec): PlaneCatalog {
  const entries = TRACK_IDS.map((id) => {
    const track = spec[id];
    const def: TrackDef = {
      basePrice: track.basePrice,
      firstPrice: track.firstPrice,
      values: ladder(track.from, track.to, track.curve),
      parts: checkParts(id, spec.parts[id]),
    };
    return [id, def] as const;
  });
  return Object.fromEntries(entries) as PlaneCatalog;
}
