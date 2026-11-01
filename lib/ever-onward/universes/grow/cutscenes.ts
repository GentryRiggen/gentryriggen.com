import type { CutsceneFrame } from "../../engine/types";
import { PHASE_FARM, PHASE_SEED, PHASE_WORLD, PHASE_YARD } from "./resources";

/**
 * The cutscene of each part: where you are, what you do and why, how to do
 * well (tips that match the real mechanics), then the goal.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_YARD]: [
    {
      text: "One small seed sits in a plain pot on a sunny windowsill, with a little garden around it.",
      showcase: {
        time: 30,
        owned: { sprinkler: 3, basket: 2, "bee-hive": 1, "rain-barrel": 1 },
      },
    },
    {
      text: "Plant seeds and keep the soil damp. Helpers grow more for you, and ripe produce waits until you pick it.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Plant in spring and pick in autumn: each season gives a boost.",
        "Keep the water tank topped up. Rain barrels help when it is dry.",
        "When the bees dance, follow them to the best patch.",
      ],
    },
    { text: "Nothing in the garden spoils or runs away. Take your time." },
  ],
  [PHASE_FARM]: [
    {
      text: "The seed grew seeds. Now there are rows of green, a scarecrow and a barn to fill.",
      showcase: { time: 30, owned: { scarecrow: 3, tractor: 2, well: 1 } },
    },
    {
      text: "Pick what is ready and plant what comes next. Scarecrows, tractors and glasshouses help the farm grow while you play.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Plant what the towns are asking for: their orders pay more.",
        "Enter the pumpkin marked best chances at the county fair.",
        "Dig wells and irrigation channels: thirsty fields grow slowly when the tank runs dry.",
      ],
    },
    { text: "A full barn is a happy barn. There is no hurry." },
  ],
  [PHASE_WORLD]: [
    {
      text: "The valley is green, and the bare places beyond are asking for more.",
      showcase: {
        time: 30,
        owned: { windbreak: 3, "planting-rover": 2, "river-bend": 1 },
        resources: { green: 4000 },
      },
    },
    {
      text: "Choose a kind of green to spread, and send seed birds to far-off places. One green thing is so much better than none.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Try a second kind of green: a new one soon beats a bigger first one.",
        "Send each flock where the weather is kind and the land is still bare.",
        "Rivers and cloud seeders keep the whole planet watered.",
      ],
    },
    { text: "Plant widely and plant kindly. The world will wait for you." },
  ],
  [PHASE_SEED]: [
    {
      text: "The whole world is green, and so quiet. Only the old window box is left, empty on its sill.",
      showcase: {
        time: 30,
        owned: { "wind-chime": 1 },
        resources: { growth: 20 },
      },
    },
    {
      text: "Tend the little pot, one small thing at a time. It shows what it wants, and a kind answer helps it grow.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Read the clue, then give the pot what it wants. The right answer helps most.",
        "A wind chime and a dew collector tend the pot between your answers.",
        "A bigger watering can helps every answer.",
      ],
    },
    { text: "The little pot is never in a hurry, and neither are you." },
  ],
};
