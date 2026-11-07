import type { RunState, StoryMessage } from "../../../engine/types";
import { visitorHereFlag } from "../../../engine/engine";
import { PHASE_SEED } from "../resources";
import { RETURN_VISITOR_ID } from "../visitors";
import {
  movesSoFar,
  potGrowth,
  skiesSoFar,
  skyOf,
  wiltsSoFar,
} from "../windowbox";

const returned = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;

const skyIs = (id: string) => (run: RunState) =>
  run.phase === 3 && skyOf(run).id === id;

const grown = (share: number) => (run: RunState) => potGrowth(run) >= share;

export const seed: StoryMessage[] = [
  {
    id: "seed-hello",
    phase: PHASE_SEED,
    text: "The robot sets down its big watering can and picks up a very small one. One pot. One seed. The whole green world goes quiet, as if it were listening.",
  },
  {
    id: "seed-first",
    phase: PHASE_SEED,
    when: (run) => movesSoFar(run) >= 1,
    text: "The robot tugs the blind, and the light lands on the soil like it never left. The window box has been empty for so long. It is nice to see something in it.",
  },
  {
    id: "seed-sprout",
    phase: PHASE_SEED,
    when: grown(0.015),
    text: "A thin green thread pushes up through the soil. The robot holds very still, the way you do when a bird lands near you.",
  },
  {
    id: "seed-window",
    phase: PHASE_SEED,
    when: (run) => skiesSoFar(run) >= 6,
    text: "The robot wipes the window with its sleeve until it shines. Outside, the whole world is green and still, and nobody is in a hurry. Neither is the pot.",
  },
  {
    id: "seed-sun",
    phase: PHASE_SEED,
    when: grown(0.08),
    text: "The sun slides along the sill, and the robot slides the pot along with it, an inch at a time. It is a very small job, and it is the best job in the world.",
  },
  {
    id: "seed-leaf",
    phase: PHASE_SEED,
    when: grown(0.12),
    text: "Two small leaves, bright as new paint. The robot counts them twice, just to be sure, and then a third time because it is nice to count something that is growing.",
  },
  {
    id: "seed-curtain",
    phase: PHASE_SEED,
    when: (run) => skiesSoFar(run) >= 11,
    text: "The robot straightens the curtain, just a little, so the window looks like somebody lives there. Out in the street, the green is very still and very kind.",
  },
  {
    id: "seed-hum",
    phase: PHASE_SEED,
    when: (run) => skiesSoFar(run) >= 9,
    text: "The robot hums along to whatever the weather is playing today. It has no idea what the song is called, and it does not need to.",
  },
  {
    id: "seed-dust",
    phase: PHASE_SEED,
    when: (run) => skiesSoFar(run) >= 14,
    text: "The robot dusts the sill with its sleeve, then the saucer, then its own elbow, just to keep busy in a nice way.",
  },
  {
    id: "seed-clock",
    phase: PHASE_SEED,
    when: (run) => skiesSoFar(run) >= 18,
    text: "Somewhere in the old house a clock ticks. The robot has never noticed it before. It sounds like a very small, very patient heart.",
  },
  {
    id: "seed-know",
    phase: PHASE_SEED,
    when: (run) => skiesSoFar(run) >= 16,
    text: "By now the robot knows the window by heart: where the light lands in the morning, how the rain sounds on the glass, which way the leaves lean when they are glad. It is not a lesson. It is just paying attention.",
  },
  {
    id: "seed-rain",
    phase: PHASE_SEED,
    when: skyIs("rain"),
    text: "Soft rain taps on the glass, the way it did on the day the first seed was planted. The robot listens, and the pot seems to listen too.",
  },
  {
    id: "seed-curl",
    phase: PHASE_SEED,
    when: (run) => wiltsSoFar(run) >= 1,
    text: "The leaves curl up, or flop down, just a little. The robot nudges the blind, and they ease back, one by one. Plants are very forgiving.",
  },
  {
    id: "seed-bud",
    phase: PHASE_SEED,
    when: grown(0.6),
    text: "A bud, tight as a small fist. The robot looks down the empty street, then back at the bud. Any day now. It is only a seed, and it is already doing its best.",
  },
  {
    id: "seed-waiting",
    phase: PHASE_SEED,
    when: grown(0.8),
    text: "The robot leaves a small light on in the window, in case anybody is passing. Somebody might be. Gardens are good at hoping, and so are robots.",
  },
  {
    id: RETURN_VISITOR_ID,
    phase: PHASE_SEED,
    when: returned,
    text: "The bud opens, and downstairs a door creaks. Slow steps climb the stairs, and a grown-up appears with a small child by the hand. It is the kid who planted the first seed, tall now, and they came back. They stop at the window and look for a long, quiet moment.",
  },
  {
    id: "seed-child",
    phase: PHASE_SEED,
    when: returned,
    text: '"Look," says the grown-up, lifting the little one up to the sill. "I planted the first one, right there." The child touches one petal very gently, and laughs. The robot stays out of the way, and stays glad.',
  },
  {
    id: "seed-end-1",
    phase: PHASE_SEED,
    when: returned,
    text: "That was what the growing was for. Not the farm, not the forests, not the world. One small plant, and someone to show it to.",
  },
  {
    id: "seed-end-2",
    phase: PHASE_SEED,
    when: returned,
    text: "The pot stays on the windowsill. Somewhere, a seed is waiting for a drop of water. Thank you for helping it grow. Ever onward.",
  },
];
