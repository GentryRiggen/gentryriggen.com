"use client";

import PixelSprite from "../start/PixelSprite";
import { retroFocusClass } from "../start/retroStyles";
import {
  SPEAKER_OFF,
  SPEAKER_ON,
  SPEAKER_ROWS,
} from "@/lib/ever-onward/start/sprites";
import { everOnwardChannels } from "./soundSettings";

/** A tiny pixel speaker bound to the game's music setting. */
export default function MusicToggle({
  className = "",
}: {
  className?: string;
}) {
  const isMusicOn = everOnwardChannels.music.useValue();
  return (
    <button
      type="button"
      data-testid="eo-music-toggle"
      aria-pressed={isMusicOn}
      aria-label="Music"
      title={isMusicOn ? "Music on" : "Music off"}
      onClick={(event) => {
        event.stopPropagation();
        everOnwardChannels.music.set(!isMusicOn);
      }}
      className={`grid size-11 touch-manipulation place-items-center rounded border-2 border-amber-500/70 bg-slate-950/70 hover:border-amber-300 ${retroFocusClass} ${className}`}
    >
      <PixelSprite
        rows={SPEAKER_ROWS}
        palette={isMusicOn ? SPEAKER_ON : SPEAKER_OFF}
        className="h-5"
      />
    </button>
  );
}
