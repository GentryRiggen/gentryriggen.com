import type { StoryMessage } from "../../../engine/types";
import { friend } from "./friend";
import { quiet } from "./quiet";
import { town } from "./town";
import { world } from "./world";

export const STORY: readonly StoryMessage[] = [
  ...friend,
  ...town,
  ...world,
  ...quiet,
];

/** The closing lines, in order. */
export const ENDING_STORY_IDS = [
  "real-smile",
  "quiet-end-1",
  "quiet-end-2",
  "quiet-end-3",
];
