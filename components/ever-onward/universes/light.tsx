import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  LIGHTHOUSE_DIM,
  LIGHTHOUSE_LIT,
  LIGHTHOUSE_ROWS,
} from "@/lib/ever-onward/start/sprites";
import {
  keepsakeNames,
  picksSoFar,
} from "@/lib/ever-onward/universes/light/garden";
import { lanternOf } from "@/lib/ever-onward/universes/light";
import type { CueName } from "../audio/everOnwardSynth";
import { SCORES, TITLE_SCORE, UNEASE } from "../audio/scores";
import EmberIcon from "../game/EmberIcon";
import LanternPicker from "../game/LanternPicker";
import MemoryGarden from "../game/MemoryGarden";
import ProbeRaces from "../game/ProbeRaces";
import TideClock from "../game/TideClock";
import WeatherDesk from "../game/WeatherDesk";
import LightScene from "../scenes/light/LightScene";
import type { TapLook, UniverseUi } from "./types";

/** Whether the run is in the storm that blows on the coast. */
export function isStormy(run: RunState): boolean {
  return run.phase === 0 && (run.resources.storm ?? 0) > 0;
}

/** Lantern for the coast, then generator, collector and flame. */
const LOOKS: readonly TapLook[] = [
  {
    icon: "lantern",
    classes:
      "border-amber-200 bg-amber-950 text-amber-200 shadow-[4px_4px_0_#78350f,0_0_26px_rgba(251,191,36,0.55)] hover:bg-amber-900",
  },
  {
    icon: "bolt",
    classes:
      "border-lime-200 bg-lime-950 text-lime-200 shadow-[4px_4px_0_#365314,0_0_26px_rgba(163,230,53,0.5)] hover:bg-lime-900",
  },
  {
    icon: "sun",
    classes:
      "border-orange-200 bg-orange-950 text-orange-200 shadow-[4px_4px_0_#9a3412,0_0_26px_rgba(251,146,60,0.55)] hover:bg-orange-900",
  },
  {
    icon: "flame",
    classes:
      "border-rose-200 bg-rose-950 text-rose-200 shadow-[4px_4px_0_#9f1239,0_0_26px_rgba(251,113,133,0.55)] hover:bg-rose-900",
  },
];

/** Sounds for what changed on the side panels between two renders. */
function cuesBetween(before: RunState, now: RunState): CueName[] {
  const cues: CueName[] = [];
  const rose = (id: string) =>
    (now.resources[id] ?? 0) > (before.resources[id] ?? 0);
  // A storm front landing on the weather desk.
  if (rose("wxFronts")) cues.push("thunder");
  // Nets hauled in on the tide clock.
  if (rose("tdHauls")) cues.push("splash");
  // The racing probe leaving the dock, and coming home.
  if (rose("prLaunches")) cues.push("launch");
  if (rose("prRuns")) cues.push("arrive");
  // A memory flower picked in the garden.
  if (rose("gdPicks")) cues.push("chime");
  return cues;
}

export const LIGHT_UI: UniverseUi = {
  Scene: LightScene,
  panels: [TideClock, ProbeRaces, WeatherDesk, MemoryGarden],
  Opening: function LanternOpening({ run, onChoose }) {
    return <LanternPicker value={lanternOf(run)} onChange={onChoose} />;
  },
  ending: { storyIds: ["last-remember", "last-end-1", "last-end-2"] },
  tapLooks: LOOKS,
  hubSprite: {
    rows: LIGHTHOUSE_ROWS,
    lit: LIGHTHOUSE_LIT,
    dim: LIGHTHOUSE_DIM,
  },
  PrestigeIcon: EmberIcon,
  Keepsakes: function LightKeepsakes({ run }) {
    if (picksSoFar(run) <= 0) return null;
    return (
      <p
        data-testid="lm-keepsakes"
        className="font-mono text-xs text-emerald-200"
      >
        Keepsakes: {keepsakeNames(run).join(", ")}.
      </p>
    );
  },
  copy: {
    logbookEmpty:
      "Visitors stop by as your lights grow. They wait for you, so none can be missed.",
    stillGoing: "The light is still on.",
  },
  audio: {
    scores: SCORES,
    unease: UNEASE,
    titleScore: TITLE_SCORE,
    isStormy,
    cuesBetween,
  },
};
