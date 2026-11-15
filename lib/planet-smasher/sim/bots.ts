import type { PlanetId } from "../planets";
import { seeded } from "../rng";
import type { ToolId } from "../tools";

export type Rng = () => number;

export interface Bot {
  id: string;
  /** Seconds between taps. */
  tapGap: number;
  /** `unlocked` is in unlock order, oldest first (asteroid first). */
  pickTool(unlocked: readonly ToolId[], rng: Rng): ToolId;
  /** Called when a planet ends; return a planet to switch to, or null. */
  pickPlanet(
    unlocked: readonly PlanetId[],
    planetsWrecked: number,
    rng: Rng
  ): PlanetId | null;
}

/** Highest first. */
const NUKE_TIERS: readonly ToolId[] = ["nukeRain", "nukeTwin", "nuke"];

const pick = <T>(list: readonly T[], rng: Rng): T =>
  list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

export function nukeLover(): Bot {
  return {
    id: "nukeLover",
    tapGap: 0.5,
    pickTool(unlocked, rng) {
      const newest = unlocked[unlocked.length - 1];
      const nuke = NUKE_TIERS.find((t) => unlocked.includes(t));
      return nuke && rng() < 0.7 ? nuke : newest;
    },
    pickPlanet: () => null,
  };
}

export function explorer(): Bot {
  let i = 0;
  return {
    id: "explorer",
    tapGap: 0.9,
    pickTool(unlocked) {
      const newestFirst = [...unlocked].reverse();
      return newestFirst[i++ % newestFirst.length];
    },
    pickPlanet: () => null,
  };
}

export function casual(): Bot {
  return {
    id: "casual",
    tapGap: 1.5,
    pickTool: (unlocked, rng) => pick(unlocked, rng),
    pickPlanet: (unlocked, planetsWrecked, rng) =>
      planetsWrecked > 0 && planetsWrecked % 3 === 0
        ? pick(unlocked, rng)
        : null,
  };
}

export const BOT_FACTORIES: Record<string, () => Bot> = {
  nukeLover,
  explorer,
  casual,
};

export const BOT_IDS = Object.keys(BOT_FACTORIES);

export { seeded };
