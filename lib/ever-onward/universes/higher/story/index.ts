import type { StoryMessage } from "../../../engine/types";
import { playroom } from "./playroom";
import { progress } from "./progress";
import { sky } from "./sky";
import { timed } from "./timed";
import { top } from "./top";
import { town } from "./town";

export const STORY: readonly StoryMessage[] = [
  ...playroom,
  ...town,
  ...sky,
  ...top,
  ...progress,
  ...timed,
];

/** The closing lines, in order. */
export const ENDING_STORY_IDS = [
  "kid-on-the-grass",
  "top-child",
  "top-end-1",
  "top-end-2",
];
