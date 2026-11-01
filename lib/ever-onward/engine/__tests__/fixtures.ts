import type { UniverseDef } from "../types";

/** A tiny two-phase universe for engine tests. */
export const fixture: UniverseDef = {
  id: "fixture",
  title: "Fixture",
  goal: "Test the engine.",
  resources: [
    { id: "coins", label: "Coins", phases: ["dim"] },
    { id: "total", label: "Total" },
    { id: "glow", label: "Glow", phases: ["bright"] },
  ],
  phases: [
    {
      id: "dim",
      title: "Dim",
      manualResource: "coins",
      manualLabel: "Tap",
      isDone: (run) => run.resources.total >= 100,
    },
    {
      id: "bright",
      title: "Bright",
      intro: "It got bright.",
      manualResource: "glow",
      manualLabel: "Shine",
      isDone: () => false,
    },
  ],
  upgrades: [
    {
      id: "lens",
      name: "Lens",
      description: "More per tap.",
      phases: ["dim"],
      currency: "coins",
      baseCost: 10,
      costGrowth: 1.5,
      maxLevel: 5,
      visibleWhen: (run) => run.resources.total >= 5,
    },
    {
      id: "gen",
      name: "Generator",
      description: "Makes coins.",
      phases: ["dim"],
      currency: "coins",
      baseCost: 15,
      costGrowth: 1.2,
      maxLevel: Infinity,
      priority: 1,
    },
    {
      id: "beam",
      name: "Beam",
      description: "Makes glow.",
      phases: ["bright"],
      currency: "glow",
      baseCost: 5,
      costGrowth: 1.3,
      maxLevel: Infinity,
    },
  ],
  story: [
    { id: "hello", text: "Hello.", phase: "dim" },
    {
      id: "halfway",
      text: "Halfway.",
      phase: "dim",
      when: (run) => run.resources.total >= 50,
    },
    { id: "bright", text: "Bright now.", phase: "bright" },
  ],
  prestige: {
    completionEmbers: 5,
    phaseEmbers: 1,
    upgrades: [
      {
        id: "spark",
        name: "Spark",
        description: "Everything runs faster.",
        cost: 2,
        maxLevel: 3,
        apply: (run, level) => {
          run.mods.mult = 1 + 0.5 * level;
        },
      },
    ],
  },
  tick: (run, dt) => {
    const mult = run.mods.mult ?? 1;
    const coins = (run.owned.gen ?? 0) * 2 * mult * dt;
    run.resources.coins += coins;
    run.resources.total += coins;
    run.resources.glow += (run.owned.beam ?? 0) * 3 * mult * dt;
  },
  manualAction: (run) => {
    const phase = run.phase === 0 ? "coins" : "glow";
    const gain = (1 + (run.owned.lens ?? 0)) * (run.mods.mult ?? 1);
    run.resources[phase] += gain;
    if (phase === "coins") run.resources.total += gain;
  },
  isComplete: (run) => run.resources.glow >= 300,
};
