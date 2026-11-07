import type { RunState } from "@/lib/ever-onward/engine/types";
import { ENDING_STORY_IDS } from "@/lib/ever-onward/universes/smile/story";
import {
  SMILE_SCORES,
  SMILE_TITLE_SCORE,
  SMILE_UNEASE,
} from "../audio/smileScores";
import type { CueName } from "../audio/everOnwardSynth";
import FriendPanel from "../game/smile/FriendPanel";
import KnowHowPanel from "../game/smile/KnowHowPanel";
import SmileEndingArt from "../game/smile/SmileEndingArt";
import SpeakersPanel from "../game/smile/SpeakersPanel";
import SmileForkPanel from "../game/smile/SmileForkPanel";
import TogetherPanel from "../game/smile/TogetherPanel";
import TownPanel from "../game/smile/TownPanel";
import StickerIcon from "../game/smile/StickerIcon";
import { SMILEY_DIM, SMILEY_LIT, SMILEY_ROWS } from "../game/smile/sprites";
import SmileScene from "../scenes/smile/SmileScene";
import type { TapLook, UniverseUi } from "./types";

/** Warm yellows, oranges, pinks and, for the quiet, a soft blue. */
const LOOKS: readonly TapLook[] = [
  {
    icon: "sun",
    classes:
      "border-yellow-200 bg-yellow-950 text-yellow-200 shadow-[4px_4px_0_#854d0e,0_0_26px_rgba(250,204,21,0.5)] hover:bg-yellow-900",
  },
  {
    icon: "flame",
    classes:
      "border-orange-200 bg-orange-950 text-orange-200 shadow-[4px_4px_0_#9a3412,0_0_26px_rgba(251,146,60,0.5)] hover:bg-orange-900",
  },
  {
    icon: "bolt",
    classes:
      "border-pink-200 bg-pink-950 text-pink-200 shadow-[4px_4px_0_#9d174d,0_0_26px_rgba(244,114,182,0.5)] hover:bg-pink-900",
  },
  {
    icon: "lantern",
    classes:
      "border-sky-200 bg-sky-950 text-sky-200 shadow-[4px_4px_0_#075985,0_0_26px_rgba(56,189,248,0.4)] hover:bg-sky-900",
  },
];

/** Sounds for what the side machines did between two renders. */
function cuesBetween(before: RunState, now: RunState): CueName[] {
  const cues: CueName[] = [];
  const rose = (id: string) =>
    (now.resources[id] ?? 0) > (before.resources[id] ?? 0);
  if (rose("tgLits")) cues.push("chime");
  if (rose("tgSighs")) cues.push("flutter");
  if (rose("pdCount")) cues.push("ribbon");
  if (rose("tnArriveAt")) cues.push("ribbon");
  if (rose("tnGrumpAt")) cues.push("flutter");
  if (rose("tnDays")) cues.push("chime");
  if (rose("qtTends")) cues.push("flutter");
  if (rose("wsLosses")) cues.push("flutter");
  if (rose("wsHeals")) cues.push("bloom");
  if (rose("wsDrones")) cues.push("buzz");
  if (rose("wsDays")) cues.push("chime");
  return cues;
}

/** The Make Everyone Smile screens: scene, panels, ending, sounds. */
export const SMILE_UI: UniverseUi = {
  Scene: SmileScene,
  primaryPanels: [TogetherPanel, TownPanel, SpeakersPanel, FriendPanel],
  panels: [SmileForkPanel, KnowHowPanel],
  ending: { storyIds: ENDING_STORY_IDS, Art: SmileEndingArt },
  tapLooks: LOOKS,
  hubSprite: { rows: SMILEY_ROWS, lit: SMILEY_LIT, dim: SMILEY_DIM },
  PrestigeIcon: StickerIcon,
  copy: {
    logbookEmpty:
      "Friendly faces stop by as the cheer grows. They wait for you.",
    stillGoing: "Someone smiled. Sit with them again?",
  },
  audio: {
    scores: SMILE_SCORES,
    unease: SMILE_UNEASE,
    titleScore: SMILE_TITLE_SCORE,
    cuesBetween,
  },
};
