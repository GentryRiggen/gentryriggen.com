import type { PrestigeDef } from "../../engine/types";

/**
 * Gold stars: permanent upgrades. Each one only sets numbers the tick already
 * reads (`mods`), so a fresh run stays honest.
 */
export const PRESTIGE: PrestigeDef = {
  label: "Gold stars",
  labelSingular: "Gold star",
  completionEmbers: 10,
  phaseEmbers: 2,
  upgrades: [
    {
      id: "star-hands",
      name: "Busy hands",
      description: "Every helper works 30% faster, in every part.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.speed = 1 + 0.3 * level;
      },
    },
    {
      id: "star-grip",
      name: "A firm grip",
      description: "Every tap is worth 25% more.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.tapMult = 1 + 0.25 * level;
      },
    },
    {
      id: "star-deals",
      name: "Friendly suppliers",
      description: "Every upgrade costs 10% less.",
      cost: 3,
      maxLevel: 4,
      apply: (run, level) => {
        run.mods.costMult = 0.9 ** level;
      },
    },
    {
      id: "star-box",
      name: "A box of blocks",
      description: "Each part starts with a little extra to spend.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.headStart = level;
      },
    },
    {
      id: "star-tape",
      name: "A roll of tape",
      description:
        "The playroom starts with the rug corners already taped, so the tower sways slower.",
      cost: 2,
      maxLevel: 3,
      apply: (run, level) => {
        run.owned["rug-corners"] = level;
      },
    },
    {
      id: "star-friend",
      name: "A friend with a teddy",
      description: "The playroom starts with teddy stackers already at work.",
      cost: 3,
      maxLevel: 3,
      apply: (run, level) => {
        run.owned.bear = 2 * level;
      },
    },
  ],
};
