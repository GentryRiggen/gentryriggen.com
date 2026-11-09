import type { RunState } from "@/lib/ever-onward/engine/types";
import { ENDING_STORY_IDS } from "@/lib/ever-onward/universes/higher/story";
import {
  BLOCKS_DIM,
  BLOCKS_LIT,
  BLOCKS_ROWS,
} from "@/lib/ever-onward/universes/higher/sprites";
import {
  HIGHER_SCORES,
  HIGHER_TITLE_SCORE,
  HIGHER_UNEASE,
} from "../audio/higherScores";
import type { CueName } from "../audio/everOnwardSynth";
import DeliveryPanel from "../game/higher/DeliveryPanel";
import FootingPanel from "../game/higher/FootingPanel";
import ForkPanel from "../game/higher/ForkPanel";
import PackPanel from "../game/higher/PackPanel";
import HigherEndingArt from "../game/higher/HigherEndingArt";
import KnowHowPanel from "../game/higher/KnowHowPanel";
import StarIcon from "../game/higher/StarIcon";
import PlayroomPanel from "../game/higher/PlayroomPanel";
import WindPanel from "../game/higher/WindPanel";
import StrainPanel from "../game/higher/StrainPanel";
import NoCranePanel from "../game/higher/NoCranePanel";
import TownPanel from "../game/higher/TownPanel";
import CrewPanel from "../game/higher/CrewPanel";
import ShadowPanel from "../game/higher/ShadowPanel";
import HigherScene from "../scenes/higher/HigherScene";
import type { TapLook, UniverseUi } from "./types";

/** Blocks, bricks, beams and quiet: warm stone, rose, sky and a soft violet. */
const LOOKS: readonly TapLook[] = [
  {
    icon: "sun",
    classes:
      "border-amber-200 bg-amber-950 text-amber-200 shadow-[4px_4px_0_#78350f,0_0_26px_rgba(251,191,36,0.5)] hover:bg-amber-900",
  },
  {
    icon: "bolt",
    classes:
      "border-orange-200 bg-orange-950 text-orange-200 shadow-[4px_4px_0_#7c2d12,0_0_26px_rgba(251,146,60,0.5)] hover:bg-orange-900",
  },
  {
    icon: "flame",
    classes:
      "border-sky-200 bg-sky-950 text-sky-200 shadow-[4px_4px_0_#075985,0_0_26px_rgba(56,189,248,0.5)] hover:bg-sky-900",
  },
  {
    icon: "sapling",
    classes:
      "border-violet-200 bg-violet-950 text-violet-200 shadow-[4px_4px_0_#4c1d95,0_0_26px_rgba(167,139,250,0.5)] hover:bg-violet-900",
  },
];

/** Sounds for what the side machines did between two renders. */
function cuesBetween(before: RunState, now: RunState): CueName[] {
  const cues: CueName[] = [];
  const rose = (id: string) =>
    (now.resources[id] ?? 0) > (before.resources[id] ?? 0);
  if (rose("dlCount")) cues.push("arrive");
  if (rose("kpPicks")) cues.push("chime");
  if (rose("otCount")) cues.push("chime");
  if (rose("pcBanks")) cues.push("chime");
  if (rose("pcTumbles")) cues.push("buzz");
  if (rose("tfSwaps")) cues.push("arrive");
  if (rose("twBuys")) cues.push("chime");
  if (rose("skDrops") || rose("skSnaps")) cues.push("buzz");
  if (rose("skTies") || rose("skNcWins")) cues.push("chime");
  return cues;
}

/** The Build It Higher screens: scene, panels, ending, sounds. */
export const HIGHER_UI: UniverseUi = {
  Scene: HigherScene,
  primaryPanels: [PlayroomPanel, TownPanel, WindPanel, StrainPanel, PackPanel],
  panels: [
    CrewPanel,
    ShadowPanel,
    NoCranePanel,
    ForkPanel,
    FootingPanel,
    KnowHowPanel,
    DeliveryPanel,
  ],
  ending: { storyIds: ENDING_STORY_IDS, Art: HigherEndingArt },
  tapLooks: LOOKS,
  hubSprite: {
    rows: BLOCKS_ROWS,
    lit: BLOCKS_LIT,
    dim: BLOCKS_DIM,
  },
  PrestigeIcon: StarIcon,
  copy: {
    logbookEmpty:
      "Visitors stop by as your tower grows. They wait for you, so none can be missed.",
    stillGoing: "A kid is waiting. Build again?",
  },
  audio: {
    scores: HIGHER_SCORES,
    unease: HIGHER_UNEASE,
    titleScore: HIGHER_TITLE_SCORE,
    cuesBetween,
  },
};
