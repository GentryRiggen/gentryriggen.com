import type { PlaneStats } from "../plane/stats";

export const BONUS_KINDS = [
  "coins",
  "fuel",
  "lift",
  "launch",
  "clover",
  "shield",
  "treasure",
  "star",
] as const;

export type BonusKind = (typeof BONUS_KINDS)[number];

/** How many of each Sky Map bonus the player has collected. */
export type Bonuses = Record<BonusKind, number>;

export function emptyBonuses(): Bonuses {
  return {
    coins: 0,
    fuel: 0,
    lift: 0,
    launch: 0,
    clover: 0,
    shield: 0,
    treasure: 0,
    star: 0,
  };
}

export const BONUS_INFO: Record<
  BonusKind,
  { emoji: string; name: string; effect: string }
> = {
  coins: { emoji: "🪙", name: "Golden Wind", effect: "+10% coins" },
  fuel: { emoji: "⛽", name: "Rocket Fuel", effect: "+10% fuel" },
  lift: { emoji: "🪶", name: "Feather Wings", effect: "+5% lift" },
  launch: { emoji: "🚀", name: "Turbo Spring", effect: "+5% launch speed" },
  clover: {
    emoji: "🍀",
    name: "Lucky Clover",
    effect: "Green zones are 10% wider",
  },
  shield: { emoji: "🛡️", name: "Shield Charm", effect: "+1 shield" },
  treasure: {
    emoji: "💰",
    name: "Treasure Chest",
    effect: "Each world starts with +100 coins",
  },
  star: { emoji: "⭐", name: "Star", effect: "Coins are doubled" },
};

/** Coins each Treasure Chest adds to every world's wallet on a prestige. */
export const TREASURE_COINS = 100;

const FUEL_PER_COPY = 0.1;
const LIFT_PER_COPY = 0.05;
const LAUNCH_PER_COPY = 0.05;
/** Lift and launch bonuses stop at double. */
const MAX_LIFT_LAUNCH_BONUS = 1;
export const MAX_SHIELD_BONUS = 5;
const COINS_PER_COPY = 0.1;
/** Stars stop at x64 coins. */
export const MAX_STARS = 6;

/** A copy of `stats` with the Sky Map bonuses folded in (the sim still clamps speed). */
export function applyBonuses(stats: PlaneStats, b: Bonuses): PlaneStats {
  return {
    ...stats,
    fuel: stats.fuel * (1 + FUEL_PER_COPY * b.fuel),
    lift:
      stats.lift *
      (1 + Math.min(MAX_LIFT_LAUNCH_BONUS, LIFT_PER_COPY * b.lift)),
    launchSpeed:
      stats.launchSpeed *
      (1 + Math.min(MAX_LIFT_LAUNCH_BONUS, LAUNCH_PER_COPY * b.launch)),
    shields: stats.shields + Math.min(MAX_SHIELD_BONUS, b.shield),
  };
}

/** What every payout is multiplied by: (1 + 0.1 coins) x 2^min(stars, 6). */
export function coinFactor(b: Bonuses): number {
  return (1 + COINS_PER_COPY * b.coins) * 2 ** Math.min(MAX_STARS, b.star);
}
