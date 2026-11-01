import type { PrestigeDef } from "../../engine/types";

/**
 * Embers: permanent upgrades. Each one only sets numbers the tick already
 * reads (`mods`), or a few starting levels, so a fresh run stays honest.
 */
export const PRESTIGE: PrestigeDef = {
  label: "Embers",
  labelSingular: "Ember",
  completionEmbers: 10,
  phaseEmbers: 2,
  upgrades: [
    {
      id: "ember-tempo",
      name: "Quick start",
      description: "Everything runs 30% faster, in every phase.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.speed = 1 + 0.3 * level;
      },
    },
    {
      id: "ember-tap",
      name: "Steady hands",
      description: "Every tap is worth 30% more.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.tapMult = 1 + 0.3 * level;
      },
    },
    {
      id: "ember-keeper",
      name: "An old friend at the lamp",
      description: "Start every run with keepers already at work.",
      cost: 4,
      maxLevel: 3,
      apply: (run, level) => {
        run.owned.keeper = 2 * level;
      },
    },
    {
      id: "ember-thrift",
      name: "Good haggler",
      description: "Every upgrade costs 12% less.",
      cost: 3,
      maxLevel: 4,
      apply: (run, level) => {
        run.mods.costMult = 0.88 ** level;
      },
    },
    {
      id: "ember-gift",
      name: "A gift from the last run",
      description: "Each phase starts with a little extra to spend.",
      cost: 3,
      maxLevel: 5,
      apply: (run, level) => {
        run.mods.headStart = level * 10;
      },
    },
    {
      id: "ember-calm",
      name: "Calm seas",
      description: "Oil prices wobble less and storms are shorter.",
      cost: 2,
      maxLevel: 3,
      apply: (run, level) => {
        run.mods.calm = Math.min(0.9, 0.3 * level);
      },
    },
    {
      id: "ember-glow",
      name: "A warmer ending",
      description: "In The Last Light, the lights fade more slowly.",
      cost: 2,
      maxLevel: 3,
      apply: (run, level) => {
        run.mods.bright = level;
      },
    },
  ],
};
