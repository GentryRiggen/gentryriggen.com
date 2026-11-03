import type { CutsceneFrame } from "../../engine/types";
import { PHASE_FARM, PHASE_SEED, PHASE_WORLD, PHASE_YARD } from "./resources";

/**
 * The intro film of each part. It follows the little robot as it falls in
 * love with growing things: a seed first, then a farm, then a whole planet,
 * and last one small pot. The first part opens on the universe's title.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_YARD]: [
    {
      card: "title",
      text: "Somewhere between the rain and the sun, there is a very small garden, and in it, a very big idea.",
      camera: "still",
    },
    {
      card: "dark",
      text: "One morning, before anyone was awake, a little robot came up the garden path. It carried a watering can, and nothing else at all.",
      robot: { move: "enter", x: 45 },
    },
    {
      text: "There on the windowsill sat a plain clay pot. In the pot was soil. In the soil, if you looked very closely, was a seed.",
      showcase: { time: 30, owned: {} },
      camera: "push-in",
      robot: { move: "look-up", x: 20, emote: "?" },
    },
    {
      text: "The robot had never met a seed before. It knelt down so its eyes were level with the pot. Nothing happened. It was the most exciting nothing ever.",
      camera: "push-in",
      robot: { move: "sit", x: 22, emote: "✦" },
    },
    {
      text: "A seed, the robot learned, is a whole tree that has not happened yet. It needs only water, sunshine, and somebody who believes in it.",
      camera: "tilt-up",
      robot: { move: "gasp", x: 24, emote: "!" },
    },
    {
      text: "The robot looked at the seed. Then at the garden, all bare dirt. Then at its watering can. And it understood.",
      camera: "still",
      robot: { move: "nod", x: 22, emote: "…" },
    },
    {
      text: "It pressed the seed into the soil. It tipped the can, one slow drop at a time. Then it waited, very still, and did not blink once.",
      camera: "push-in",
      robot: { move: "work", x: 24 },
      seconds: 6,
    },
    {
      text: "Then, a sprout. Two tiny leaves, as green as a crayon. The robot's whole body hummed. It had made a thing grow!",
      showcase: {
        time: 30,
        owned: { sprinkler: 1, basket: 1, "rain-barrel": 1 },
      },
      camera: "tilt-down",
      robot: { move: "hop", x: 24, emote: "♥" },
    },
    {
      text: "Soon there were sprinklers, a basket, and a bee hive buzzing by the fence. The bees were very busy, and very rude about it.",
      showcase: {
        time: 30,
        owned: {
          sprinkler: 3,
          basket: 2,
          "bee-hive": 1,
          "rain-barrel": 1,
          gardener: 1,
        },
      },
      camera: "pan-right",
      robot: { move: "walk", x: 78, facing: "left" },
    },
    {
      text: "One pot is a start. But the garden is wide, and there are so many seeds. The robot rolled up its sleeves. Ever onward.",
      showcase: {
        time: 30,
        owned: {
          sprinkler: 6,
          basket: 3,
          "bee-hive": 2,
          "rain-barrel": 2,
          gardener: 2,
          greenhouse: 1,
        },
      },
      camera: "pull-out",
      robot: { move: "lift", x: 22, emote: "✦" },
    },
  ],
  [PHASE_FARM]: [
    {
      text: "The little garden was a big garden now. The robot sat on the fence and swung its feet, very proud, and just a bit sleepy.",
      showcase: {
        time: 30,
        owned: { sprinkler: 6, basket: 3, "bee-hive": 2, "cold-frame": 1 },
      },
      camera: "pull-out",
      robot: { move: "sit", x: 76, facing: "left" },
    },
    {
      text: "Then a breeze came by, and it carried a smell. Dust, and hay, and wide open sky. The robot turned its head toward the hills.",
      camera: "still",
      robot: { move: "look-up", x: 74, facing: "left", emote: "?" },
    },
    {
      text: "Past the fence, the fields rolled on and on. Empty rows, waiting. Hungry towns, waiting too. And a barn with nothing in it at all.",
      showcase: { time: 30, owned: {} },
      camera: "pan-left",
      robot: { move: "idle", x: 20 },
    },
    {
      text: "Waiting, thought the robot, for somebody who likes rows.",
      camera: "push-in",
      robot: { move: "gasp", x: 22, emote: "!" },
    },
    {
      text: "It hopped down and got to work. It planted one long row, straight as a ruler. Then another. Then it put a hat on a scarecrow, because he looked cold.",
      showcase: { time: 30, owned: { scarecrow: 2, well: 1 } },
      camera: "drift",
      robot: { move: "work", x: 24 },
    },
    {
      text: "Putt, putt, putt. A green tractor rolled out of the shed and did a whole field before the robot had finished its snack.",
      showcase: { time: 30, owned: { scarecrow: 3, tractor: 2, well: 1 } },
      camera: "pan-right",
      robot: { move: "hop", x: 78, facing: "left", emote: "♪" },
    },
    {
      text: "Down the road, a little town waved. They had never had so many carrots. The robot waved back with both hands.",
      camera: "push-in",
      robot: { move: "wave", x: 24, emote: "♥" },
    },
    {
      text: "A full barn is a happy barn. And there is so much farm left. The robot picked up its pail and started on the next row.",
      showcase: {
        time: 30,
        owned: { scarecrow: 6, tractor: 3, well: 2, glasshouse: 1, silo: 1 },
      },
      camera: "pull-out",
      robot: { move: "walk", x: 30, emote: "✦" },
    },
  ],
  [PHASE_WORLD]: [
    {
      text: "The farm fed the valley, and the valley wrote back. Many letters. The robot read every one, and its eyes got bigger with each page.",
      showcase: {
        time: 30,
        owned: { windbreak: 1 },
        resources: { bmForest: 0.05 },
      },
      camera: "push-in",
      robot: { move: "idle", x: 76, facing: "left" },
    },
    {
      text: "Far-off places needed trees. Dry places needed rain. Bare places needed anything at all. The robot climbed a hill and looked out.",
      camera: "tilt-up",
      robot: { move: "look-up", x: 72, facing: "left", emote: "!" },
    },
    {
      text: "The whole world was out there. Big, round, grey in patches, and holding its breath.",
      card: "dark",
      robot: { move: "gasp", x: 50, emote: "✦" },
      seconds: 4,
    },
    {
      text: "One green thing is so much better than none. The robot looked at the world. Then at its seed bag. And it understood.",
      showcase: {
        time: 30,
        owned: { windbreak: 2, "planting-rover": 1 },
        resources: { bmForest: 0.12 },
      },
      camera: "still",
      robot: { move: "nod", x: 22, emote: "…" },
    },
    {
      text: "It planted a forest. Then a meadow beside it. Then it sent seed birds off over the sea, with tiny maps, and a lot of encouragement.",
      showcase: {
        time: 30,
        owned: { windbreak: 3, "planting-rover": 2, "sky-seeder": 1 },
        resources: { bmForest: 0.2, bmMeadow: 0.1 },
      },
      camera: "pan-right",
      robot: { move: "work", x: 24 },
    },
    {
      text: "A river bent in just where it was needed. Clouds drifted over and rained on the new trees. The robot got a little bit wet, and did not mind.",
      showcase: {
        time: 30,
        owned: {
          windbreak: 4,
          "planting-rover": 3,
          "river-bend": 2,
          "sky-seeder": 2,
        },
        resources: { bmForest: 0.3, bmMeadow: 0.2, bmWetland: 0.1 },
      },
      camera: "tilt-down",
      robot: { move: "hop", x: 24, emote: "♥" },
    },
    {
      text: "From far above, you could see it. A green speck, then a green patch, then a green sweep across the dark. The robot had made that.",
      showcase: {
        time: 30,
        owned: {
          windbreak: 6,
          "planting-rover": 4,
          "river-bend": 3,
          "sky-seeder": 3,
        },
        resources: {
          bmForest: 0.35,
          bmMeadow: 0.25,
          bmWetland: 0.15,
          bmJungle: 0.1,
        },
      },
      camera: "pull-out",
      robot: { move: "lift", x: 22 },
    },
    {
      text: "A whole planet to plant. The robot has never been so busy, and never so happy about it. Plant widely, it hummed. Plant kindly.",
      camera: "drift",
      robot: { move: "walk", x: 32, emote: "✦" },
    },
  ],
  [PHASE_SEED]: [
    {
      text: "The whole world is green now. Forests hum, rivers sing, and even the deserts have flowers. The robot walked through it, listening.",
      showcase: { time: 30, owned: {}, resources: { growth: 0 } },
      camera: "pan-right",
      robot: { move: "walk", x: 40 },
    },
    {
      text: "It was the finest garden anyone ever grew. And it was so quiet. No footsteps. No laughing. Not one small voice asking what a worm was.",
      camera: "still",
      robot: { move: "idle", x: 70, facing: "left", emote: "…" },
    },
    {
      text: "Then the robot remembered the very first seed. The kid who planted it had grown up, and gone far away.",
      card: "dark",
      robot: { move: "sit", x: 50 },
      seconds: 4,
    },
    {
      text: "Back at the old house, the window box sat empty on its sill. The robot climbed the stairs, one at a time, and looked at it for a long while.",
      showcase: { time: 30, owned: {}, resources: { growth: 0 } },
      camera: "push-in",
      robot: { move: "look-up", x: 22, emote: "?" },
    },
    {
      text: "The robot did not need a reason. It needed a pot, a little soil, and one small seed. It understood that part perfectly.",
      camera: "still",
      robot: { move: "nod", x: 24, emote: "♥" },
    },
    {
      text: "It put down its big watering can and picked up a very small one. It pressed the seed in softly. It hummed a tune it did not know it knew.",
      showcase: { time: 30, owned: {}, resources: { growth: 5 } },
      camera: "push-in",
      robot: { move: "work", x: 24 },
      seconds: 6,
    },
    {
      text: "A thin green thread pushed up through the soil. The robot held very still, the way you do when a bird lands near you.",
      showcase: {
        time: 30,
        owned: { "wind-chime": 1 },
        resources: { growth: 25 },
      },
      camera: "push-in",
      robot: { move: "gasp", x: 22, emote: "!" },
    },
    {
      text: "Maybe they will come back. Maybe not. Either way, the pot will be here, and so will the robot. Tending it is the best job in the world.",
      showcase: {
        time: 30,
        owned: { "wind-chime": 1 },
        resources: { growth: 40 },
      },
      camera: "pull-out",
      robot: { move: "sit", x: 24, emote: "♥" },
    },
  ],
};

/** The closing card's tips: short, kind and true to the real mechanics. */
export const TIPS: Readonly<Record<string, readonly string[]>> = {
  [PHASE_YARD]: [
    "Plant in spring and pick in autumn: each season gives a boost.",
    "Rain fills the tank. Rain barrels hold more for dry spells.",
    "When the bees dance, follow them to the best patch.",
  ],
  [PHASE_FARM]: [
    "Plant what the towns are asking for: their orders pay more.",
    "Enter the pumpkin marked best chances at the county fair.",
    "Dig wells and irrigation channels: dry tanks slow the fields.",
  ],
  [PHASE_WORLD]: [
    "Try a second kind of green: a new one soon beats a bigger first one.",
    "Send each flock where the weather is kind and the land is still bare.",
    "Rivers and cloud seeders keep the whole planet watered.",
  ],
  [PHASE_SEED]: [
    "Read the clue, then give the pot what it wants. The right answer helps most.",
    "A wind chime and a dew collector tend the pot between your answers.",
    "A bigger watering can helps every answer.",
  ],
};
