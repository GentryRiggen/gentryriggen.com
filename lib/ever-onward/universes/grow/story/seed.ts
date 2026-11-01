import type { RunState, StoryMessage } from "../../../engine/types";
import { visitorHereFlag } from "../../../engine/engine";
import { PHASE_SEED } from "../resources";
import { RETURN_VISITOR_ID } from "../visitors";

const returned = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;

export const seed: StoryMessage[] = [
  {
    id: "seed-hello",
    phase: PHASE_SEED,
    text: "One pot. One seed. The whole busy world fades to a hum, and you give the little thing a drop of water, just because.",
  },
  {
    id: RETURN_VISITOR_ID,
    phase: PHASE_SEED,
    when: returned,
    text: "A green shoot unfurls, and a child at the window gasps. It is the very same child who planted it, years ago, and now they are tall. They came back to see.",
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
