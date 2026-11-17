/**
 * Speed knobs for the mini-games. Always 1 for players; the test hook turns
 * them so a Playwright run is quick and steady instead of racing a swinging
 * log. (Time scale only: nothing here changes the rules.)
 */
export const playTuning = { toast: 1, logs: 1 };

export function tunePlay(next: Partial<typeof playTuning>): void {
  if (next.toast !== undefined) playTuning.toast = Math.max(0.001, next.toast);
  if (next.logs !== undefined) playTuning.logs = Math.max(0.001, next.logs);
}

export function resetPlayTuning(): void {
  playTuning.toast = 1;
  playTuning.logs = 1;
}
