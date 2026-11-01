import type { StoryMessage } from "../../../engine/types";
import { farm } from "./farm";
import { seed } from "./seed";
import { world } from "./world";
import { yard } from "./yard";

export const STORY: readonly StoryMessage[] = [
  ...yard,
  ...farm,
  ...world,
  ...seed,
];

/** The closing lines, in order. */
export const ENDING_STORY_IDS = [
  "seed-return",
  "seed-child",
  "seed-end-1",
  "seed-end-2",
];
