import type { StoryMessage } from "../../../engine/types";
import { PHASE_WORLD } from "../resources";

export const world: StoryMessage[] = [
  {
    id: "world-hello",
    phase: PHASE_WORLD,
    text: "From up here the world is a big round map with a lot of bare spots on it. You pick one and plant a tree. It is a start.",
  },
];
