import type { ComponentType } from "react";
import type { MusicSpec } from "@/components/game-audio/music";
import type { Palette } from "@/lib/ever-onward/start/sprites";
import type {
  RunState,
  SaveData,
  UniverseDef,
} from "@/lib/ever-onward/engine/types";
import type { CueName } from "../audio/everOnwardSynth";
import type { UneaseSpec } from "../audio/scores";
import type { PixelIconName } from "../game/retro/PixelIcon";

/** The most recent purchase, handed from the game screen to the scene. */
export interface LastBuy {
  /** Counts up with every purchase so a repeat buy replays the callout. */
  id: number;
  upgradeId: string;
  /** How many of it are owned now. */
  n: number;
}

export interface SceneProps {
  run: RunState;
  lastBuy?: LastBuy | null;
}

export interface PanelProps {
  def: UniverseDef;
  run: RunState;
  onAct: (id: string) => void;
}

export interface TapLook {
  icon: PixelIconName;
  classes: string;
}

export interface UniverseAudio {
  /** One per phase index. */
  scores: readonly MusicSpec[];
  unease: readonly (UneaseSpec | null)[];
  /** A hub theme. */
  titleScore?: MusicSpec;
  /** Storm bed and the tap button's storm look. */
  isStormy?(run: RunState): boolean;
  cuesBetween?(before: RunState, now: RunState): CueName[];
}

export interface UniverseEnding {
  /** Closing lines, in order. */
  storyIds: readonly string[];
  /** Drawn above the lines. */
  Art?: ComponentType<{ run: RunState }>;
  /** Not narrated. */
  afterword?(save: SaveData): string | null;
}

export interface UniverseUi {
  Scene: ComponentType<SceneProps>;
  /** Rendered in order after the action panel. */
  panels: readonly ComponentType<PanelProps>[];
  Opening?: ComponentType<{
    run: RunState;
    onChoose: (value: number) => void;
  }>;
  ending: UniverseEnding;
  /** Per phase index. */
  tapLooks: readonly TapLook[];
  hubSprite: { rows: readonly string[]; lit: Palette; dim: Palette };
  PrestigeIcon: ComponentType<{ className?: string }>;
  /** An extra logbook block. */
  Keepsakes?: ComponentType<{ run: RunState }>;
  copy: { logbookEmpty: string; stillGoing: string };
  audio: UniverseAudio;
}
