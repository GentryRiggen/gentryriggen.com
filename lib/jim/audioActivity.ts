/**
 * Whether Jim is reading aloud right now (playing or loading; paused does
 * not count). The app lock's idle timer treats it as activity, so the
 * morning brief isn't cut off by five minutes of listening hands-free.
 * The read-aloud player reports here; the lock listens.
 */

let busy = false;
const listeners = new Set<(busy: boolean) => void>();

export function isAudioBusy(): boolean {
  return busy;
}

export function setAudioBusy(next: boolean): void {
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
