import {
  LIGHTHOUSE_DIM,
  ROBOT_COLORS,
  ROBOT_ROWS,
} from "@/lib/ever-onward/start/sprites";
import { ENDING_STORY_IDS } from "@/lib/ever-onward/universes/grow/story";
import { SCORES, TITLE_SCORE, UNEASE } from "../audio/scores";
import EmberIcon from "../game/EmberIcon";
import GrowScene from "../scenes/grow/GrowScene";
import type { TapLook, UniverseUi } from "./types";

/** Water, harvest, green and care: blues and greens. */
const LOOKS: readonly TapLook[] = [
  {
    icon: "bolt",
    classes:
      "border-sky-200 bg-sky-950 text-sky-200 shadow-[4px_4px_0_#075985,0_0_26px_rgba(56,189,248,0.5)] hover:bg-sky-900",
  },
  {
    icon: "sun",
    classes:
      "border-lime-200 bg-lime-950 text-lime-200 shadow-[4px_4px_0_#365314,0_0_26px_rgba(163,230,53,0.5)] hover:bg-lime-900",
  },
  {
    icon: "bolt",
    classes:
      "border-emerald-200 bg-emerald-950 text-emerald-200 shadow-[4px_4px_0_#065f46,0_0_26px_rgba(52,211,153,0.5)] hover:bg-emerald-900",
  },
  {
    icon: "flame",
    classes:
      "border-amber-200 bg-amber-950 text-amber-200 shadow-[4px_4px_0_#78350f,0_0_26px_rgba(251,191,36,0.5)] hover:bg-amber-900",
  },
];

/** Placeholders until the art and the music are made (Tasks 14 and 15). */
export const GROW_UI: UniverseUi = {
  Scene: GrowScene,
  panels: [],
  ending: { storyIds: ENDING_STORY_IDS },
  tapLooks: LOOKS,
  hubSprite: {
    rows: ROBOT_ROWS,
    lit: ROBOT_COLORS,
    dim: LIGHTHOUSE_DIM,
  },
  PrestigeIcon: EmberIcon,
  copy: {
    logbookEmpty: "Visitors stop by as your garden grows. They wait for you.",
    stillGoing: "The garden is still growing.",
  },
  audio: {
    scores: SCORES,
    unease: UNEASE,
    titleScore: TITLE_SCORE,
  },
};
