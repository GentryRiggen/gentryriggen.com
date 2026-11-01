import { createVoicePlayer } from "@/components/game-audio/voicePlayer";
import { getClip } from "@/lib/ever-onward/narration/manifest";

/**
 * Plays narration through the shared voice player (see
 * `components/game-audio/voicePlayer.ts`). Lines never overlap: a new
 * automatic line waits its turn (at most two, oldest dropped), and a
 * deliberate Play replaces whatever is speaking.
 *
 * Music ducking: whenever narration starts or stops the window gets a
 * CustomEvent named NARRATION_EVENT with `detail: { isPlaying, id }`; the
 * audio module can listen and lower the music.
 */
export const NARRATION_EVENT = "ever-onward:narration";

const player = createVoicePlayer({
  getClip: (id) => getClip(id),
  eventName: NARRATION_EVENT,
  maxQueue: 2,
});

/** Plays at once, replacing anything speaking and anything waiting. */
export function playNarration(id: string): void {
  player.play(id, { interrupt: true });
}

/** Plays after the current line; waits at most two deep. */
export function queueNarration(id: string): void {
  player.play(id);
}

export function stopNarration(): void {
  player.stop();
}

/**
 * Lets the first tap or key press unlock audio on iOS, so lines that arrive
 * later can play. Safe to call often.
 */
export function unlockNarrationOnGesture(): void {
  player.unlockOnGesture();
}

/** The id being spoken now, or null. */
export function useNarrationPlaying(): string | null {
  return player.useNowPlaying();
}

/** Forgets all state (tests). */
export function resetNarrationPlayer(): void {
  player.reset();
}
