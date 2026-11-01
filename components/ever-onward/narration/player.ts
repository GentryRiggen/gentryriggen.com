import { mixWithOtherAudio } from "@/components/game-audio/audioSession";
import { useSyncExternalStore } from "react";
import { getClip } from "@/lib/ever-onward/narration/manifest";

/**
 * Plays narration. Lines never overlap: a new automatic line waits its turn
 * (at most MAX_QUEUE, oldest dropped), and a deliberate Play replaces
 * whatever is speaking.
 *
 * Clips play through Web Audio, not an <audio> element. On iOS a media
 * element claims the phone's "Now Playing" slot and pauses the player's
 * podcast or music, even for a split second of silence; Web Audio under an
 * ambient audio session (see `mixWithOtherAudio`) mixes with it instead.
 * Browsers without Web Audio (and jsdom) fall back to one shared element.
 *
 * Music ducking: whenever narration starts or stops the window gets a
 * CustomEvent named NARRATION_EVENT with `detail: { isPlaying, id }`; the
 * audio module can listen and lower the music.
 */
export const NARRATION_EVENT = "ever-onward:narration";
const MAX_QUEUE = 2;

type AudioContextConstructor = typeof AudioContext;

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let audio: HTMLAudioElement | null = null;
let playingId: string | null = null;
let queue: string[] = [];
let isUnlockWired = false;
let isVisibilityWired = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(
    new CustomEvent(NARRATION_EVENT, {
      detail: { isPlaying: playingId !== null, id: playingId },
    })
  );
}

function contextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const legacy = window as unknown as {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? legacy.webkitAudioContext;
}

function wireVisibility(): void {
  if (isVisibilityWired) return;
  isVisibilityWired = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopNarration();
  });
}

/** The shared narration context, created (ambient) on first use. */
function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = contextConstructor();
  if (!Ctor) return null;
  try {
    mixWithOtherAudio();
    ctx = new Ctor();
    wireVisibility();
    return ctx;
  } catch {
    return null;
  }
}

function resume(c: AudioContext | null): void {
  try {
    const result = c?.resume?.();
    result?.catch(() => undefined);
  } catch {
    // Not allowed outside a gesture; a later tap tries again.
  }
}

function load(c: AudioContext, file: string): Promise<AudioBuffer> {
  let buffer = buffers.get(file);
  if (!buffer) {
    buffer = fetch(file)
      .then((response) => {
        if (!response.ok) throw new Error(`narration ${response.status}`);
        return response.arrayBuffer();
      })
      .then(
        (bytes) =>
          new Promise<AudioBuffer>((resolve, reject) =>
            c.decodeAudioData(bytes, resolve, reject)
          )
      );
    // A failed load may succeed later (offline for a moment).
    buffer.catch(() => buffers.delete(file));
    buffers.set(file, buffer);
  }
  return buffer;
}

function stopSource(): void {
  const current = source;
  source = null;
  if (!current) return;
  try {
    current.stop();
  } catch {
    // Already stopped.
  }
}

/** The fallback element, only where Web Audio is missing. */
function element(): HTMLAudioElement {
  if (audio) return audio;
  mixWithOtherAudio();
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("ended", () => finish(playingId));
  audio.addEventListener("error", () => finish(playingId));
  wireVisibility();
  return audio;
}

/** Moves on from `id` to the next queued clip, or goes quiet. */
function finish(id: string | null): void {
  if (id === null || id !== playingId) return;
  playingId = null;
  const next = queue.shift();
  if (next) {
    start(next);
    return;
  }
  emit();
}

function startWebAudio(c: AudioContext, id: string, file: string): void {
  resume(c);
  load(c, file).then(
    (buffer) => {
      if (playingId !== id) return;
      stopSource();
      const node = c.createBufferSource();
      node.buffer = buffer;
      node.connect(c.destination);
      node.onended = () => {
        if (source !== node) return;
        source = null;
        finish(id);
      };
      source = node;
      node.start();
    },
    () => finish(id)
  );
}

function startElement(id: string, file: string): void {
  const el = element();
  el.src = file;
  // Autoplay rules and headless browsers reject; narration is optional.
  const fail = () => finish(id);
  try {
    const result = el.play() as Promise<void> | undefined;
    result?.catch(fail);
  } catch {
    fail();
  }
}

function start(id: string): void {
  const clip = getClip(id);
  if (!clip) {
    finish(playingId);
    return;
  }
  stopSource();
  playingId = id;
  emit();
  const c = context();
  if (c) startWebAudio(c, id, clip.file);
  else startElement(id, clip.file);
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
  stopSource();
  if (audio) {
    try {
      audio.pause();
    } catch {
      // Nothing to stop.
    }
  }
  if (playingId === null) return;
  playingId = null;
  emit();
}

/**
 * Lets the first tap or key press unlock audio on iOS, so lines that arrive
 * later can play. It only resumes a Web Audio context, which never touches
 * the phone's Now Playing or pauses other apps. Safe to call often.
 */
export function unlockNarrationOnGesture(): void {
  if (typeof window === "undefined" || isUnlockWired) return;
  if (!contextConstructor()) return;
  isUnlockWired = true;
  const unlock = () => {
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    resume(context());
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
  stopSource();
  ctx = null;
  buffers.clear();
  audio = null;
  playingId = null;
  queue = [];
  isUnlockWired = false;
}
