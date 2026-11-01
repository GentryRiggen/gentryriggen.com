import type { PrestigeDef } from "../../engine/types";

/**
 * Acorns: permanent upgrades. Each one only sets numbers the tick already
 * reads (`mods`), so a fresh run stays honest.
 */
export const PRESTIGE: PrestigeDef = {
  label: "Acorns",
  labelSingular: "Acorn",
  completionEmbers: 10,
  phaseEmbers: 2,
  upgrades: [
    {
      id: "acorn-roots",
      name: "Deep roots",
      description: "Every helper works 25% faster, in every phase.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.speed = 1 + 0.25 * level;
      },
    },
    {
      id: "acorn-thumbs",
      name: "Green thumbs",
      description: "Every tap is worth 25% more.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.tapMult = 1 + 0.25 * level;
      },
    },
    {
      id: "acorn-trades",
      name: "Fair trades",
      description: "Every upgrade costs 10% less.",
      cost: 3,
      maxLevel: 4,
      apply: (run, level) => {
        run.mods.costMult = 0.9 ** level;
      },
    },
    {
      id: "acorn-packet",
      name: "A packet of seeds",
      description: "Each phase starts with a little extra to spend.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.headStart = level;
      },
    },
    {
      id: "acorn-barrel",
      name: "A bigger first barrel",
      description: "The garden starts with rain barrels already set out.",
      cost: 2,
      maxLevel: 3,
      apply: (run, level) => {
        run.owned["rain-barrel"] = level;
      },
    },
    {
      id: "acorn-friend",
      name: "A friend with a watering can",
      description: "The backyard starts with sprinklers already at work.",
      cost: 3,
      maxLevel: 3,
      apply: (run, level) => {
        run.owned.sprinkler = 2 * level;
      },
    },
  ],
};
