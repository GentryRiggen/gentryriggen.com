import type { CutsceneFrame } from "../../engine/types";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT, PHASE_SKY } from "./resources";

/**
 * The intro film of each part. It follows the little robot as it finds its
 * next job and falls in love with it: wonder first, then the decision, then
 * the first brave bit of work. The first part opens on the universe's title.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_COAST]: [
    {
      card: "title",
      text: "Far away, past the edge of every map, there is a sea where the nights are very long and very dark.",
      camera: "still",
    },
    {
      card: "dark",
      text: "One night, a little robot came walking along the shore. It had a little lantern, and nothing else at all.",
      robot: { move: "enter", x: 45 },
    },
    {
      text: "Then it saw it. A lighthouse. Old, and small, and peeling, with a lamp at the top that had gone out a long, long time ago.",
      showcase: { owned: {}, resources: { ships: 0 } },
      camera: "tilt-up",
      robot: { move: "look-up", x: 40, facing: "left", emote: "!" },
    },
    {
      text: "The robot had never seen anything so wonderful in its whole life.",
      camera: "push-in",
      robot: { move: "gasp", x: 42, facing: "left", emote: "✦" },
    },
    {
      text: "Out on the water, little ships were drifting in the dark. They could not see the rocks. They could not find the way home.",
      showcase: { owned: {}, resources: { ships: 8 } },
      camera: "pan-right",
      robot: { move: "idle", x: 36 },
    },
    {
      text: "The robot looked at the ships. Then at the dark lamp. Then at its own small lantern. And it understood.",
      camera: "still",
      robot: { move: "nod", x: 38, facing: "left", emote: "…" },
    },
    {
      text: "It climbed every one of the hundred and twelve steps. It polished the glass. It trimmed the wick. It did not stop once.",
      camera: "tilt-up",
      robot: { move: "work", x: 36, facing: "left" },
    },
    {
      text: "Click. The lamp was lit.",
      showcase: { owned: { lens: 1 }, resources: { ships: 8 } },
      camera: "push-in",
      robot: { move: "lift", x: 36, facing: "left" },
      seconds: 5,
    },
    {
      text: "Far out on the water, one little boat turned toward the light. The robot's whole body hummed.",
      camera: "drift",
      robot: { move: "hop", x: 38, emote: "♥" },
    },
    {
      text: "One lighthouse is a start. But the coast is long, and the ships are many. The robot rolls up its sleeves. Clocking in. Ever onward.",
      showcase: {
        owned: { lighthouse: 3, keeper: 2, lens: 4 },
        resources: { ships: 12 },
      },
      camera: "pull-out",
      robot: { move: "walk", x: 40, emote: "✦" },
    },
  ],
  [PHASE_NIGHT]: [
    {
      text: "The whole coast glows now. Every ship gets home. The robot sits on the rocks and listens to the waves, very proud and a little tired.",
      showcase: {
        owned: { lighthouse: 8, keeper: 6, lens: 8 },
        resources: { ships: 40 },
      },
      camera: "pull-out",
      robot: { move: "sit", x: 74, facing: "left" },
    },
    {
      text: "Then it turned around, and saw something it had never noticed before.",
      camera: "still",
      robot: { move: "look-up", x: 70, facing: "left", emote: "?" },
    },
    {
      text: "Behind the hills, the whole country was dark. Children walked home by starlight. Kitchens flickered with candles. Whole cities, waiting.",
      showcase: {
        owned: { gen1: 0 },
        resources: { cities: 2, night: 100, supply: 10, demand: 70 },
      },
      camera: "pan-left",
      robot: { move: "idle", x: 20 },
    },
    {
      text: "Waiting, thought the robot, for somebody like me.",
      camera: "push-in",
      robot: { move: "gasp", x: 22, emote: "!" },
    },
    {
      text: "So it built a crank. Then a generator. Then it strung one long, careful wire over the hills, humming the whole way.",
      showcase: {
        owned: { gen1: 2, crank: 1 },
        resources: { cities: 8, night: 90, supply: 40, demand: 70 },
      },
      camera: "drift",
      robot: { move: "work", x: 26 },
    },
    {
      text: "A window woke up. Then a street. Then a whole city, glittering like somebody spilled a bag of sequins.",
      showcase: {
        owned: { gen1: 3, gen2: 1, crank: 2 },
        resources: { cities: 30, night: 70, supply: 60, demand: 70 },
      },
      camera: "pull-out",
      robot: { move: "hop", x: 24, emote: "♥" },
    },
    {
      text: "No more night. Not here, not anywhere. It is a very big job. The robot has never wanted anything more.",
      camera: "drift",
      robot: { move: "walk", x: 34, emote: "✦" },
    },
  ],
  [PHASE_SKY]: [
    {
      text: "The whole planet shines now, even at midnight. The robot climbed the tallest tower in the world to look at it all.",
      showcase: {
        owned: { gen1: 8, gen2: 4, crank: 4 },
        resources: { cities: 100, night: 0, supply: 90, demand: 70 },
      },
      camera: "pull-out",
      robot: { move: "idle", x: 70, facing: "left" },
    },
    {
      text: "And then it looked up.",
      card: "dark",
      robot: { move: "look-up", x: 50, emote: "…" },
      seconds: 4,
    },
    {
      text: "Up there, the sun pours out more light every second than every city put together. And almost all of it just floats away.",
      showcase: { owned: { collector: 0 }, resources: { collectors: 0 } },
      camera: "push-in",
      robot: { move: "gasp", x: 20, emote: "!" },
    },
    {
      text: "Past the sun are the stars. Billions of them, burning away out there, and nobody has ever gone to say hello.",
      showcase: { owned: { collector: 1 }, resources: { stars: 800 } },
      camera: "pan-right",
      robot: { move: "look-up", x: 18, emote: "✦" },
    },
    {
      text: "The robot built its first sun collector out of spare parts and a lot of hope. Then a tiny probe, with a smile painted on the side.",
      camera: "drift",
      robot: { move: "work", x: 24 },
    },
    {
      text: "Three. Two. One.",
      card: "dark",
      robot: { move: "lift", x: 50 },
      seconds: 4,
    },
    {
      text: "Off they went, out into the deep dark, to catch the light and bring it home.",
      showcase: {
        owned: { collector: 4 },
        resources: { collectors: 6, probes: 20, stars: 800 },
      },
      camera: "pull-out",
      robot: { move: "spin", x: 22, emote: "♥" },
    },
    {
      text: "The sky is very big, and the robot is very small. It does not mind one bit.",
      camera: "drift",
      robot: { move: "nod", x: 26, emote: "✦" },
    },
  ],
  [PHASE_LAST]: [
    {
      text: "One day, the robot looked up, and the sky was empty. Every star had been caught. Every light was in its hands.",
      showcase: { resources: { lights: 3, flame: 700 } },
      camera: "pull-out",
      robot: { move: "look-up", x: 50, emote: "…" },
    },
    {
      text: "It had never been this quiet before. The robot sat down for the first time in a very long time.",
      card: "dark",
      robot: { move: "sit", x: 50 },
    },
    {
      text: "Light does not keep. It leaks away, a little every second. The robot cannot hold on to all of it. Nobody could.",
      camera: "drift",
      robot: { move: "idle", x: 30 },
    },
    {
      text: "But one small flame is left. And far out on the dark water, one small boat is still looking for the shore.",
      camera: "pan-right",
      robot: { move: "look-up", x: 22, emote: "!" },
    },
    {
      text: "The robot stood up. It checked its lantern. It knew exactly what to do. It had always known.",
      camera: "push-in",
      robot: { move: "nod", x: 26 },
    },
    {
      text: "One light at a time, it will let go. And it will keep one light on, just long enough to bring that boat home.",
      camera: "still",
      robot: { move: "lift", x: 26, emote: "♥" },
    },
  ],
};

/** The closing card's tips: short, kind and true to the real mechanics. */
export const TIPS: Readonly<Record<string, readonly string[]>> = {
  [PHASE_COAST]: [
    "Hire keepers early: they flash the lamp for you.",
    "Keep oil in the tank, and fill up when the price says cheap.",
    "Turn the lamp up when oil is cheap, and down when it is dear.",
  ],
  [PHASE_NIGHT]: [
    "Build generators early: they make power while you rest.",
    "Balance the grid when it gets uneasy: a steady glow pays more.",
    "Ride the evening rush when it arrives. It waits for you.",
  ],
  [PHASE_SKY]: [
    "Add sun collectors: they gather light for you.",
    "Send a course correction when the fleet drifts. A steady fleet works faster.",
    "Catch the solar flare when it shines. It waits for you.",
  ],
  [PHASE_LAST]: [
    "Spend resolve in the shop to let lights go dark. Each one you let go moves the goal.",
    "Watch the FLAME meter up top. A few taps warm it, and a warm flame earns resolve faster.",
    "When the little boat sails, tap the beam to keep it true. Garden blooms give resolve too.",
  ],
};
