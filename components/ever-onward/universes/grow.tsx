import {
  SEEDLING_DIM,
  SEEDLING_LIT,
  SEEDLING_ROWS,
} from "@/lib/ever-onward/start/sprites";
import { hasStartedUniverse } from "@/lib/ever-onward/engine/progress";
import { getPlayableUniverse } from "@/lib/ever-onward/universes";
import { ENDING_STORY_IDS } from "@/lib/ever-onward/universes/grow/story";
import {
  GROW_SCORES,
  GROW_TITLE_SCORE,
  GROW_UNEASE,
} from "../audio/growScores";
import type { CueName } from "../audio/everOnwardSynth";
import AcornIcon from "../game/grow/AcornIcon";
import GrowEndingArt from "../game/grow/GrowEndingArt";
import PollinationPanel from "../game/grow/PollinationPanel";
import BiomePanel from "../game/grow/BiomePanel";
import PumpkinPanel from "../game/grow/PumpkinPanel";
import ForkPanel from "../game/grow/ForkPanel";
import KnowHowPanel from "../game/grow/KnowHowPanel";
import MarketPanel from "../game/grow/MarketPanel";
import SeedMigration from "../game/grow/SeedMigration";
import WindowBox from "../game/grow/WindowBox";
import SeasonDial from "../game/grow/SeasonDial";
import GrowScene from "../scenes/grow/GrowScene";
import type { RunState } from "@/lib/ever-onward/engine/types";
import type { TapLook, UniverseUi } from "./types";

/** Water, harvest, green and care: blues and greens. */
const LOOKS: readonly TapLook[] = [
  {
    icon: "can",
    classes:
      "border-sky-200 bg-sky-950 text-sky-200 shadow-[4px_4px_0_#075985,0_0_26px_rgba(56,189,248,0.5)] hover:bg-sky-900",
  },
  {
    icon: "wheat",
    classes:
      "border-lime-200 bg-lime-950 text-lime-200 shadow-[4px_4px_0_#365314,0_0_26px_rgba(163,230,53,0.5)] hover:bg-lime-900",
  },
  {
    icon: "sapling",
    classes:
      "border-emerald-200 bg-emerald-950 text-emerald-200 shadow-[4px_4px_0_#065f46,0_0_26px_rgba(52,211,153,0.5)] hover:bg-emerald-900",
  },
  {
    icon: "pot",
    classes:
      "border-amber-200 bg-amber-950 text-amber-200 shadow-[4px_4px_0_#78350f,0_0_26px_rgba(251,191,36,0.5)] hover:bg-amber-900",
  },
];

/** Sounds for what the side machines did between two renders. */
function cuesBetween(before: RunState, now: RunState): CueName[] {
  const cues: CueName[] = [];
  const rose = (id: string) =>
    (now.resources[id] ?? 0) > (before.resources[id] ?? 0);
  if (rose("pbRare")) cues.push("bloom");
  if (rose("pbWilts")) cues.push("buzz");
  if (rose("pkEntries")) cues.push("ribbon");
  if (rose("pkSplits")) cues.push("buzz");
  if (rose("mkDays")) cues.push("bloom");
  if (rose("mgFlights")) cues.push("flutter");
  if (rose("potStage")) cues.push("bloom");
  return cues;
}

/** The Make It Grow screens: scene, panels, ending, sounds. */
export const GROW_UI: UniverseUi = {
  Scene: GrowScene,
  primaryPanels: [SeasonDial, MarketPanel, BiomePanel, WindowBox],
  panels: [
    ForkPanel,
    KnowHowPanel,
    PollinationPanel,
    PumpkinPanel,
    SeedMigration,
  ],
  ending: {
    storyIds: ENDING_STORY_IDS,
    Art: GrowEndingArt,
    // Not narrated. Only while Build It Higher is out and still unplayed.
    afterword: (save) => {
      const higher = getPlayableUniverse("higher");
      const saved = save.universes.higher;
      if (!higher || (saved && hasStartedUniverse(saved))) return null;
      return "A new universe has opened: Build It Higher.";
    },
  },
  tapLooks: LOOKS,
  hubSprite: {
    rows: SEEDLING_ROWS,
    lit: SEEDLING_LIT,
    dim: SEEDLING_DIM,
  },
  PrestigeIcon: AcornIcon,
  copy: {
    logbookEmpty: "Visitors stop by as your garden grows. They wait for you.",
    stillGoing: "Someone came back. Plant again?",
  },
  audio: {
    scores: GROW_SCORES,
    unease: GROW_UNEASE,
    titleScore: GROW_TITLE_SCORE,
    cuesBetween,
  },
};
