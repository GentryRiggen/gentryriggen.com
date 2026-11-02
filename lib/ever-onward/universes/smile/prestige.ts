import type { PrestigeDef } from "../../engine/types";

/**
 * Stickers: permanent upgrades. Each one only sets numbers the tick already
 * reads (`mods`), so a fresh run stays honest.
 */
export const PRESTIGE: PrestigeDef = {
  label: "Stickers",
  labelSingular: "Sticker",
  completionEmbers: 10,
  phaseEmbers: 2,
  upgrades: [
    {
      id: "sticker-giggles",
      name: "Extra giggles",
      description: "Every helper works 30% faster, in every part.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.speed = 1 + 0.3 * level;
      },
    },
    {
      id: "sticker-high-five",
      name: "A good high five",
      description: "Every tap is worth 25% more.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.tapMult = 1 + 0.25 * level;
      },
    },
    {
      id: "sticker-trades",
      name: "Friends and family prices",
      description: "Every upgrade costs 10% less.",
      cost: 3,
      maxLevel: 4,
      apply: (run, level) => {
        run.mods.costMult = 0.9 ** level;
      },
    },
    {
      id: "sticker-packet",
      name: "A packet of party hats",
      description: "Each part starts with a little extra to spend.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.headStart = level;
      },
    },
    {
      id: "sticker-bunch",
      name: "A bigger first bunch",
      description: "The first friend starts with balloons already tied on.",
      cost: 2,
      maxLevel: 3,
      apply: (run, level) => {
        run.owned.balloon = level;
      },
    },
    {
      id: "sticker-puppy",
      name: "A friend with a puppy",
      description: "The first friend starts with a wagging puppy or two.",
      cost: 3,
      maxLevel: 3,
      apply: (run, level) => {
        run.owned.puppy = level;
      },
    },
  ],
};
