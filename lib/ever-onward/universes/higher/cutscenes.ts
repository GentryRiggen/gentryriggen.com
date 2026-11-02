import type { CutsceneFrame } from "../../engine/types";
import { PHASE_PLAYROOM, PHASE_SKY, PHASE_TOP, PHASE_TOWN } from "./resources";

/**
 * The cutscene of each part: where you are, what you do and why, how to do
 * well (tips that match the real mechanics), then the goal.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_PLAYROOM]: [
    {
      text: "A rug, a box of wooden blocks and one little robot with one big idea: build it higher.",
      showcase: {
        time: 30,
        owned: { bear: 3, "big-blocks": 1, ramp: 1 },
      },
    },
    {
      text: "Stack blocks by hand, and let helpers stack more while you play. A tall tower leans a little, so give it a steady hand now and then.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Press Steady when the tower leans, and the crew goes back to full speed.",
        "Keep a quarter of your blocks for the base, and every later payout grows.",
        "When a box arrives, read the cards and place the one that helps most.",
      ],
    },
    { text: "Nothing falls down in here. Take your time." },
  ],
  [PHASE_TOWN]: [
    {
      text: "The tower is out of the playroom and into the town. There are cranes, scaffolds and a crowd that cheers every floor.",
      showcase: {
        time: 30,
        owned: { mason: 3, crane: 2, scaffolding: 1 },
      },
    },
    {
      text: "Lay bricks, hire crews and learn as you go. Crews pick up know-how while they work, and you spend it on lasting ideas or an overtime shift.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Steel is quick, and timber is clever. Read the catch before you choose.",
        "Know-how buys a lasting project or an overtime shift, but not both.",
        "Foundations pay off later, floors pay off now. A quarter is a good start.",
      ],
    },
    { text: "Everybody is cheering. Keep it straight, and keep going." },
  ],
  [PHASE_SKY]: [
    {
      text: "The tower is higher than the birds now. Below the clouds, the town sits in its long shadow.",
      showcase: {
        time: 30,
        owned: { "sky-crew": 3, "cloud-crane": 2, damper: 1 },
        resources: { beams: 4000 },
      },
    },
    {
      text: "Hoist beams, spin cable and keep the tower calm in the wind. The air is thin and the work is lonely, but it is going very well.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "A damper and a good anchor keep the tower from swaying.",
        "A space elevator pays more. Cloud terraces let the light through.",
        "Place each delivery where it helps most: stuff now, a straighter tower, or anchors for later.",
      ],
    },
    { text: "There is always one more beam. That is the whole idea." },
  ],
  [PHASE_TOP]: [
    {
      text: "The last block is set. There is nothing higher to build, and nobody else up here at all.",
      showcase: {
        time: 30,
        owned: { "stair-lamp": 2, songbird: 1 },
        resources: { descent: 20 },
      },
    },
    {
      text: "The robot has one block to carry and a long way down. Take a step, then another. Quiet things keep it company.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Lamps, songbirds and a tune all help the steps come easier.",
        "Take the stairs yourself, or ride the old lift. Not both.",
        "When a moment comes, pick the one that suits what you have.",
      ],
    },
    { text: "Somewhere at the bottom there is a patch of grass. Go slowly." },
  ],
};
