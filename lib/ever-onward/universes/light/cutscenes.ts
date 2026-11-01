import type { CutsceneFrame } from "../../engine/types";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT, PHASE_SKY } from "./resources";

/**
 * The cutscene of each part: where you are, what you do and why, how to do
 * well (tips that match the real mechanics), then the goal.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_COAST]: [
    {
      text: "Your lighthouse stands on a dark coast, and little ships are out on the water.",
      showcase: {
        owned: { lighthouse: 3, keeper: 2, lens: 4 },
        resources: { ships: 12 },
      },
    },
    {
      text: "Flash the lamp to guide ships home. Every ship pays coins, and coins build more lighthouses along the coast.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Hire keepers early: they flash the lamp for you.",
        "Keep oil in the tank, and fill up when the price says cheap.",
        "Once the nets open, set them before high tide.",
      ],
    },
    { text: "Every ship you guide is a good one. Take your time." },
  ],
  [PHASE_NIGHT]: [
    {
      text: "The coast is glowing, and now the whole country wants its lights on.",
      showcase: {
        owned: { gen1: 3, gen2: 1, crank: 2 },
        resources: { cities: 30, night: 70, supply: 60, demand: 70 },
      },
    },
    {
      text: "Crank the generator and build power plants. More power lights more cities, and the cities pay you for it.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Build generators early: they make power while you rest.",
        "Balance the grid when it gets uneasy: a steady glow pays more.",
        "Ride the evening rush when it arrives. It waits for you.",
      ],
    },
    { text: "The lights come on a little at a time. Enjoy each city." },
  ],
  [PHASE_SKY]: [
    {
      text: "The ground is bright, but look up: the sun and the stars are full of light nobody uses.",
      showcase: {
        owned: { collector: 4 },
        resources: { collectors: 6, probes: 20, stars: 800 },
      },
    },
    {
      text: "Aim collectors at the sun and send probes to the stars. Every star your probes reach pays you energy.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Add sun collectors: they gather light for you.",
        "Send a course correction when the fleet drifts. A steady fleet works faster.",
        "Catch the solar flare when it shines. It waits for you.",
      ],
    },
    { text: "There is a whole sky up there, and no hurry at all." },
  ],
  [PHASE_LAST]: [
    {
      text: "The sky is empty and quiet. One small flame is left, and one small boat is out on the dark water.",
      showcase: { resources: { lights: 3, flame: 700 } },
    },
    {
      text: "Tend the flame, and let go of the lights one at a time. Each light you let go makes the next one easier.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Warm the flame with a few taps when it looks low. More taps will not help much.",
        "When the little boat sails, tap the beam to keep it true. A true beam helps you let go faster.",
        "Water the garden and pick the blooms: they help you let go too.",
      ],
    },
    { text: "There is no rush. Whatever you choose is all right." },
  ],
};
