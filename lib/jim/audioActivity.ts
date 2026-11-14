/**
 * Whether Jim is reading aloud right now (playing or loading; paused does
 * not count). The app lock's idle timer treats it as activity, so the
 * morning brief isn't cut off by five minutes of listening hands-free.
 * The read-aloud player reports here; the lock listens.
 *
 * Loading counts for at most LOADING_MAX_MS from when it started: a hung
 * request must not keep Jim unlocked indefinitely.
 */

export const LOADING_MAX_MS = 60_000;

let busy = false;
/** Date.now() when the current loading began (null: not loading). */
let loadingSince: number | null = null;
const listeners = new Set<(busy: boolean) => void>();

export function isAudioBusy(): boolean {
  return busy;
}

/**
 * The latest moment audio counts as activity, as of `now`: `now` while
 * playing, at most LOADING_MAX_MS after loading began, null when idle.
 */
export function audioActiveAt(now: number): number | null {
  if (!busy) return null;
  if (loadingSince === null) return now;
  return Math.min(now, loadingSince + LOADING_MAX_MS);
}

/** `loading`: busy only because the audio is still loading. */
export function setAudioBusy(next: boolean, loading = false): void {
  const nextLoading = next && loading;
  if (!nextLoading) loadingSince = null;
  else if (loadingSince === null) loadingSince = Date.now();
  if (next === busy) return;
  busy = next;
  for (const listener of listeners) listener(busy);
}

/** Called on each change; returns unsubscribe. */
export function onAudioBusy(listener: (busy: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
