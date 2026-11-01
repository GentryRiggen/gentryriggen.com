import { PLAYABLE_UNIVERSES } from "../universes";

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

/** Every line that has a recorded clip, across all playable universes. */
export function narrationLines(): NarrationLine[] {
  const lines: NarrationLine[] = [];
  for (const def of PLAYABLE_UNIVERSES) {
    for (const phase of def.phases) {
      const text = phase.intro ? spokenText(introSpokenText(phase)) : "";
      if (text) lines.push({ id: introClipId(def.id, phase.id), text });
    }
    for (const message of def.story) {
      const text = spokenText(message.text);
      if (text) lines.push({ id: storyClipId(def.id, message.id), text });
    }
  }
  return lines;
}
