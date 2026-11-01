import { useSyncExternalStore } from "react";
import { getClip } from "@/lib/ever-onward/narration/manifest";

/**
 * One shared audio element for all narration. Lines never overlap: a new
 * automatic line waits its turn (at most MAX_QUEUE, oldest dropped), and a
 * deliberate Play replaces whatever is speaking.
 *
 * Music ducking: whenever narration starts or stops the window gets a
 * CustomEvent named NARRATION_EVENT with `detail: { isPlaying, id }`; the
 * audio module can listen and lower the music.
 */
export const NARRATION_EVENT = "ever-onward:narration";
const MAX_QUEUE = 2;
/** A 0.1s silent WAV, played once to let iOS use the element later. */
const SILENCE =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

let audio: HTMLAudioElement | null = null;
let playingId: string | null = null;
let queue: string[] = [];
let isUnlockWired = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(
    new CustomEvent(NARRATION_EVENT, {
      detail: { isPlaying: playingId !== null, id: playingId },
    })
  );
}

function safePlay(element: HTMLAudioElement, id: string): void {
  // Autoplay rules and headless browsers reject; narration is optional. A
  // rejection from a clip that was already replaced must not end the new one.
  const fail = () => {
    if (playingId === id) finish(element);
  };
  try {
    const result = element.play() as Promise<void> | undefined;
    result?.catch(fail);
  } catch {
    fail();
  }
}

function element(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("ended", () => finish(audio));
  audio.addEventListener("error", () => finish(audio));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopNarration();
  });
  return audio;
}

/** Moves on to the next queued clip, or goes quiet. */
function finish(from: HTMLAudioElement | null): void {
  if (from !== audio) return;
  playingId = null;
  const next = queue.shift();
  if (next) {
    start(next);
    return;
  }
  emit();
}

function start(id: string): void {
  const clip = getClip(id);
  if (!clip) {
    finish(audio);
    return;
  }
  const el = element();
  playingId = id;
  el.src = clip.file;
  emit();
  safePlay(el, id);
}

/** Plays at once, replacing anything speaking and anything waiting. */
export function playNarration(id: string): void {
  if (typeof window === "undefined" || !getClip(id)) return;
  queue = [];
  start(id);
}

/** Plays after the current line; waits at most two deep. */
export function queueNarration(id: string): void {
  if (typeof window === "undefined" || !getClip(id)) return;
  if (playingId === null) {
    start(id);
    return;
  }
  queue = [...queue, id].slice(-MAX_QUEUE);
}

export function stopNarration(): void {
  queue = [];
  if (!audio) return;
  try {
    audio.pause();
  } catch {
    // Nothing to stop.
  }
  playingId = null;
  emit();
}

/** Lets the first tap or key press unlock audio on iOS. Safe to call often. */
export function unlockNarrationOnGesture(): void {
  if (typeof window === "undefined" || isUnlockWired) return;
  isUnlockWired = true;
  const unlock = () => {
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    if (playingId !== null) return;
    const el = element();
    el.src = SILENCE;
    try {
      const result = el.play() as Promise<void> | undefined;
      result
        ?.then(() => {
          if (playingId === null) el.pause();
        })
        .catch(() => undefined);
    } catch {
      // Not allowed; a later tap tries again through Play.
    }
  };
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The id being spoken now, or null. */
export function useNarrationPlaying(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => playingId,
    () => null
  );
}

/** Forgets all state (tests). */
export function resetNarrationPlayer(): void {
  audio = null;
  playingId = null;
  queue = [];
  isUnlockWired = false;
}
