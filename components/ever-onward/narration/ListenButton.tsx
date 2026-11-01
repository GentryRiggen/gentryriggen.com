"use client";

import { getClip } from "@/lib/ever-onward/narration/manifest";
import { focusRingClass } from "../styles";
import { playNarration, stopNarration, useNarrationPlaying } from "./player";
import { useNarrationSettings } from "./settings";

interface ListenButtonProps {
  clipId: string;
  /** Visible text; omit for a compact icon button. */
  label?: string;
  /** Names the line for screen readers, e.g. "Listen to this message". */
  accessibleLabel: string;
  className?: string;
}

/** Plays or stops one clip. Renders nothing when narration is off or missing. */
export default function ListenButton({
  clipId,
  label,
  accessibleLabel,
  className = "",
}: ListenButtonProps) {
  const { isEnabled } = useNarrationSettings();
  const playingId = useNarrationPlaying();
  if (!isEnabled || !getClip(clipId)) return null;
  const isPlaying = playingId === clipId;
  return (
    <button
      type="button"
      aria-pressed={isPlaying}
      aria-label={isPlaying ? "Stop listening" : accessibleLabel}
      onClick={() => (isPlaying ? stopNarration() : playNarration(clipId))}
      className={`inline-flex touch-manipulation items-center justify-center ${focusRingClass} ${className}`}
    >
      <span aria-hidden="true">{isPlaying ? "■" : "▶"}</span>
      {label && <span>{isPlaying ? "Stop" : label}</span>}
    </button>
  );
}
