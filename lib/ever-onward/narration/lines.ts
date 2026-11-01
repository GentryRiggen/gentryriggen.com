import type { PhaseDef } from "../engine/types";
import { playableUniverses } from "../universes/staging";

export interface NarrationLine {
  /** `<universe>/<line>`; also the clip's path under public/ever-onward/voice. */
  id: string;
  /** Exactly what the voice reads. */
  text: string;
}

const NEWS_PREFIX = "NEWS:";

/** Id of a story message's clip. */
export const storyClipId = (universeId: string, storyId: string): string =>
  `${universeId}/${storyId}`;

/** Id of a phase intro's clip. */
export const introClipId = (universeId: string, phaseId: string): string =>
  `${universeId}/intro-${phaseId}`;

/** Id of a cutscene frame's clip (`frame` counts from 1). */
export const cutClipId = (
  universeId: string,
  phaseId: string,
  frame: number
): string => `${universeId}/cut-${phaseId}-${frame}`;

/**
 * What the voice reads for a cutscene frame (0-based): its line, then its
 * tips, and on the last frame the goal.
 */
export function cutSpokenText(phase: PhaseDef, frameIndex: number): string {
  const frames = phase.cutscene ?? [];
  const frame = frames[frameIndex];
  if (!frame) return "";
  const isLast = frameIndex === frames.length - 1;
  return [
    frame.text,
    ...(frame.tips ?? []),
    isLast && phase.goal ? `Your goal: ${phase.goal}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** What the voice reads for a phase intro: the briefing, then the goal. */
export const introSpokenText = (phase: {
  intro?: string;
  goal?: string;
}): string =>
  [phase.intro, phase.goal && `Your goal: ${phase.goal}`]
    .filter(Boolean)
    .join(" ");

/** What a newsreader would say: no "NEWS:" tag. Empty when nothing is said. */
export function spokenText(text: string): string {
  const body = text.startsWith(NEWS_PREFIX)
    ? text.slice(NEWS_PREFIX.length)
    : text;
  const trimmed = body.trim();
  // A line like "NEWS: ..." is a deliberate silence.
  return /[A-Za-z]/.test(trimmed) ? trimmed : "";
}

/** Every line that has a recorded clip, across every built universe, released or not. */
export function narrationLines(): NarrationLine[] {
  const lines: NarrationLine[] = [];
  for (const def of playableUniverses(true)) {
    for (const phase of def.phases) {
      const text = phase.intro ? spokenText(introSpokenText(phase)) : "";
      if (text) lines.push({ id: introClipId(def.id, phase.id), text });
    }
    for (const phase of def.phases) {
      (phase.cutscene ?? []).forEach((_, i) => {
        const text = spokenText(cutSpokenText(phase, i));
        if (text) lines.push({ id: cutClipId(def.id, phase.id, i + 1), text });
      });
    }
    for (const message of def.story) {
      const text = spokenText(message.text);
      if (text) lines.push({ id: storyClipId(def.id, message.id), text });
    }
  }
  return lines;
}
