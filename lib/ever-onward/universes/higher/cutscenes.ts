import type { CutsceneFrame } from "../../engine/types";
import { PHASE_PLAYROOM, PHASE_SKY, PHASE_TOP, PHASE_TOWN } from "./resources";

/**
 * The intro film of each part. It follows the little robot as it climbs: the
 * wonder of each new height, the moment it decides, then the first brave bit
 * of work. The first part opens on the universe's title.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_PLAYROOM]: [
    {
      card: "title",
      text: "Once, in a quiet house, there was a rug, a box of wooden blocks and a very tall afternoon.",
      camera: "still",
    },
    {
      card: "dark",
      text: "Into the room came a little robot. It had been told just one thing, and it held on to it with both hands: build it higher.",
      robot: { move: "enter", x: 45 },
    },
    {
      text: "A rug. A box of blocks, each one nearly as big as the robot's head. It had never seen anything so full of promise.",
      showcase: { time: 0, owned: {} },
      camera: "pan-right",
      robot: { move: "gasp", x: 18, emote: "!" },
    },
    {
      text: "It picked up one block and set it down on the rug. Then it stood back and looked at it for a long time, as if it were the grandest thing in the world.",
      camera: "push-in",
      robot: { move: "idle", x: 20 },
    },
    {
      text: "One block is not very high. But the robot could see the tower already, tall and straight, going up past the window. And it understood.",
      camera: "tilt-up",
      robot: { move: "nod", x: 22, emote: "…" },
    },
    {
      text: "So it stacked another. Then another. Click, click, click. It did not look away once, not even to blink.",
      showcase: { owned: { bear: 1 } },
      camera: "push-in",
      robot: { move: "work", x: 22 },
    },
    {
      text: "Something stirred in the corner. A teddy bear sat up, took a block in both paws and joined in. The robot had a friend, and the friend was very good at it.",
      showcase: { owned: { bear: 3, ramp: 1 } },
      camera: "drift",
      robot: { move: "wave", x: 20, emote: "♥" },
    },
    {
      text: "The tower grew to the robot's knees. Then its waist. Then its shoulders. The robot hummed a tiny, happy hum.",
      showcase: { owned: { bear: 4, ramp: 2, "big-blocks": 2 } },
      camera: "tilt-up",
      robot: { move: "look-up", x: 20 },
    },
    {
      card: "dark",
      text: "The tower leaned a little, the way tall things do. The robot steadied it with one gentle hand.",
      robot: { move: "lift", x: 50 },
      seconds: 4,
    },
    {
      text: "First a treehouse. Then a town. Then the sky. It is a long way up, and the robot cannot wait. It rolled up its sleeves. Ever onward.",
      showcase: {
        owned: { bear: 6, ramp: 4, "toy-crane": 3, "big-blocks": 3 },
      },
      camera: "pull-out",
      robot: { move: "walk", x: 28, emote: "✦" },
    },
  ],
  [PHASE_TOWN]: [
    {
      text: "The treehouse had grown into a tower, and the whole town came out to look. The robot stood at the bottom, very proud and a little dizzy.",
      showcase: {
        time: 30,
        owned: { mason: 3, crane: 1, scaffolding: 1 },
      },
      camera: "pull-out",
      robot: { move: "idle", x: 78, facing: "left" },
    },
    {
      text: "There were cranes, and scaffolds, and a crowd that cheered every single floor. Somebody even brought a mayor with very large scissors.",
      camera: "pan-right",
      robot: { move: "wave", x: 80, facing: "left", emote: "♥" },
    },
    {
      text: "The robot waved back. Then it looked at the tower, and the tower was not finished. It looked up. And up. And up.",
      camera: "tilt-up",
      robot: { move: "look-up", x: 20, emote: "!" },
    },
    {
      card: "dark",
      text: "The cheering was lovely. But the robot was already thinking about the next floor. And it understood.",
      robot: { move: "nod", x: 50 },
      seconds: 4,
    },
    {
      text: "Cheering is kind, but floors are better. So it picked up a brick and laid it down, straight as a ruler.",
      camera: "push-in",
      robot: { move: "work", x: 22 },
    },
    {
      text: "A mason came to help, then a crane. The crews learned as they worked, and the robot wrote down every clever idea.",
      showcase: {
        owned: { mason: 5, crane: 3, scaffolding: 2, "cross-braces": 1 },
      },
      camera: "tilt-up",
      robot: { move: "work", x: 20 },
    },
    {
      text: "A floor. Then another. The crowd counted them out loud, and the robot counted along very quietly, so it would not miss its place.",
      camera: "drift",
      robot: { move: "hop", x: 22, emote: "♪" },
    },
    {
      text: "Up there somewhere was the top floor. The robot did not know how far. It checked the plumb line, tightened its bolts and set off to find out.",
      showcase: {
        owned: {
          mason: 8,
          crane: 5,
          "concrete-truck": 3,
          scaffolding: 3,
          "cross-braces": 2,
        },
      },
      camera: "pull-out",
      robot: { move: "walk", x: 28, emote: "✦" },
    },
  ],
  [PHASE_SKY]: [
    {
      text: "The tower was higher than the birds now. The robot sat on a beam with its legs over the edge, and the whole town looked like toys.",
      showcase: {
        time: 30,
        owned: { "sky-crew": 3, "cloud-crane": 2, damper: 1 },
        resources: { beams: 4000 },
      },
      camera: "pull-out",
      robot: { move: "sit", x: 76, facing: "left" },
    },
    {
      text: "The clouds drifted by so close that the robot could almost touch one. It stuck out a hand. Cool, and a little damp.",
      camera: "tilt-up",
      robot: { move: "gasp", x: 22, emote: "!" },
    },
    {
      card: "dark",
      text: "It was very quiet up here. Just wind, and a long cable going down to a town with fewer lights on.",
      robot: { move: "idle", x: 50, emote: "…" },
      seconds: 4,
    },
    {
      text: "The robot missed the cheering, just a little. Then it saw one more beam waiting to be lifted. And it understood.",
      camera: "push-in",
      robot: { move: "nod", x: 24 },
    },
    {
      text: "It hoisted the beam. It spun the cable. The wind pushed, and the tower swayed, and the robot held on and kept on working.",
      showcase: {
        owned: { "sky-crew": 4, "cloud-crane": 3, "cable-spinner": 1 },
        resources: { beams: 9000 },
      },
      camera: "tilt-up",
      robot: { move: "work", x: 22 },
    },
    {
      text: "Then the damper settled in, and the tower stood calm and still. The robot patted it, the way you pat a good horse.",
      showcase: {
        owned: {
          "sky-crew": 6,
          "cloud-crane": 4,
          "cable-spinner": 2,
          damper: 2,
          alloy: 2,
        },
        resources: { beams: 20000 },
      },
      camera: "drift",
      robot: { move: "hop", x: 20, emote: "♥" },
    },
    {
      text: "Far below, one tiny light came on in one tiny window. Somebody was looking up. The robot waved with its whole arm.",
      camera: "tilt-down",
      robot: { move: "wave", x: 78, facing: "left" },
    },
    {
      text: "A space elevator is a very long way up. The robot gathered one more beam and climbed on toward the last block.",
      showcase: {
        owned: {
          "sky-crew": 8,
          "cloud-crane": 6,
          "cable-spinner": 4,
          damper: 2,
          alloy: 3,
          "ballast-ring": 1,
        },
        resources: { beams: 60000 },
      },
      camera: "pull-out",
      robot: { move: "walk", x: 28, emote: "✦" },
    },
  ],
  [PHASE_TOP]: [
    {
      text: "The last block was set. The tower stood taller than anything ever built, and the robot stood on top of it, under very quiet stars.",
      showcase: { time: 30, owned: {}, resources: { descent: 0 } },
      camera: "pull-out",
      robot: { move: "idle", x: 76, facing: "left" },
    },
    {
      text: "It had done it. Every brick, every beam, every windy night. The robot turned a slow circle, and the whole world lay still below.",
      camera: "tilt-up",
      robot: { move: "spin", x: 24, emote: "♥" },
    },
    {
      text: "But there was one block left in its hands. And somewhere at the very bottom was a patch of grass, which was where it was meant to go.",
      camera: "tilt-down",
      robot: { move: "look-up", x: 22, emote: "?" },
    },
    {
      card: "dark",
      text: "So the robot did what it always does. It nodded. And it understood.",
      robot: { move: "nod", x: 50 },
      seconds: 4,
    },
    {
      text: "It took one step down. Then another. There was no hurry any more, and the robot found that it liked that.",
      showcase: {
        owned: { "stair-lamp": 1 },
        resources: { descent: 5 },
      },
      camera: "push-in",
      robot: { move: "walk", x: 26 },
    },
    {
      text: "A little lamp lit the stairs. A songbird landed on the rail and whistled. The robot whistled back, a little off tune.",
      showcase: {
        owned: { "stair-lamp": 3, songbird: 1 },
        resources: { descent: 30 },
      },
      camera: "drift",
      robot: { move: "hop", x: 22, emote: "♪" },
    },
    {
      text: "Down and down it went, one quiet step at a time, with the last block held carefully in both hands.",
      showcase: {
        owned: { "stair-lamp": 5, songbird: 2, hum: 1 },
        resources: { descent: 60 },
      },
      camera: "tilt-down",
      robot: { move: "walk", x: 28 },
    },
    {
      text: "Far, far below, the grass was waiting. The robot held the block close and kept going. Gently. Ever onward.",
      showcase: {
        owned: { "stair-lamp": 6, songbird: 3, hum: 2 },
        resources: { descent: 85 },
      },
      camera: "pull-out",
      robot: { move: "nod", x: 26, emote: "✦" },
    },
  ],
};

/** Short, true tips for each part's closing card. */
export const TIPS: Readonly<Record<string, readonly string[]>> = {
  [PHASE_PLAYROOM]: [
    "Rush when it is safe and go careful when the toddler comes. Bank a streak before the top tumbles.",
    "Keep a quarter of your blocks for the base, and every later payout grows.",
    "When a box arrives, read the cards and place the one that helps most.",
  ],
  [PHASE_TOWN]: [
    "Steel is quick, and timber is clever. Read the catch before you choose.",
    "Know-how buys a lasting project or an overtime shift, but not both.",
    "Foundations pay off later, floors pay off now. A quarter is a good start.",
  ],
  [PHASE_SKY]: [
    "The sky shows the wind before it comes. Tie down for a strong gust, and ease the cable for a light one.",
    "A space elevator pays more. Cloud terraces let the light through.",
    "Place each delivery where it helps most: stuff now, a spare cable, or anchors for later.",
  ],
  [PHASE_TOP]: [
    "Lamps, songbirds and a tune all help the steps come easier.",
    "Take the stairs yourself, or ride the old lift. Not both.",
    "When a moment comes, pick the one that suits what you have.",
  ],
};
