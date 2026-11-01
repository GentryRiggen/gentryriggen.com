import { useSyncExternalStore } from "react";
import { applyAudioSession } from "./audioSession";

/** A recorded line: where its MP3 lives, under public/. */
export interface VoiceClip {
  file: string;
}

export interface VoicePlayerOptions {
  /** The recorded clip for a line id; lines without one stay silent. */
  getClip: (id: string) => VoiceClip | undefined;
  /**
   * Window CustomEvent fired whenever a line starts or stops, with
   * `detail: { isPlaying, id }` (music can listen and duck).
   */
  eventName: string;
  /** How many automatic lines may wait their turn (oldest dropped). */
  maxQueue?: number;
}

export interface VoicePlayer {
  /**
   * Speaks a line. With `interrupt` it replaces whatever is speaking and
   * anything waiting; otherwise it waits for the current line.
   */
  play: (id: string, opts?: { interrupt?: boolean }) => void;
  stop: () => void;
  /** The id being spoken now, or null. */
  useNowPlaying: () => string | null;
  /**
   * Lets taps and key presses (pointerdown, touchend, click, keydown) unlock
   * audio on iOS, so lines that arrive later can play; the listeners stay
   * until the context is running. It only resumes a Web Audio context, which
   * never touches the phone's Now Playing or pauses other apps. Safe to call
   * often.
   */
  unlockOnGesture: () => void;
  /** Forgets all state (tests). */
  reset: () => void;
}

const DEFAULT_MAX_QUEUE = 2;

/**
 * Gestures that may unlock audio. iOS Safari only counts touchend and click
 * as user activation for audio, so those join pointerdown and keydown.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

type AudioContextConstructor = typeof AudioContext;

function contextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const legacy = window as unknown as {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? legacy.webkitAudioContext;
}

/**
 * A voice-line player. Lines never overlap: a new automatic line waits its
 * turn (at most `maxQueue`, oldest dropped), and an interrupting line
 * replaces whatever is speaking.
 *
 * Clips play through Web Audio, not an <audio> element. On iOS a media
 * element claims the phone's "Now Playing" slot and pauses the player's
 * podcast or music, even for a split second of silence; Web Audio under an
 * ambient audio session (see `applyAudioSession`) mixes with it instead.
 * Browsers without Web Audio (and jsdom) fall back to one shared element.
 */
export function createVoicePlayer({
  getClip,
  eventName,
  maxQueue = DEFAULT_MAX_QUEUE,
}: VoicePlayerOptions): VoicePlayer {
  let ctx: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  const buffers = new Map<string, Promise<AudioBuffer>>();
  let audio: HTMLAudioElement | null = null;
  let playingId: string | null = null;
  let queue: string[] = [];
  let isUnlockWired = false;
  /** Takes the unlock listeners away, while they are wired. */
  let removeUnlock: (() => void) | null = null;
  let isVisibilityWired = false;
  const listeners = new Set<() => void>();

  function emit(): void {
    listeners.forEach((listener) => listener());
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { isPlaying: playingId !== null, id: playingId },
      })
    );
  }

  function wireVisibility(): void {
    if (isVisibilityWired) return;
    isVisibilityWired = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
    });
  }

  /** This player's context, created (ambient) on first use. */
  function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = contextConstructor();
    if (!Ctor) return null;
    try {
      applyAudioSession();
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
          if (!response.ok) throw new Error(`voice ${response.status}`);
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
    applyAudioSession();
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
    // Autoplay rules and headless browsers reject; voice is optional.
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

  function play(id: string, opts: { interrupt?: boolean } = {}): void {
    if (typeof window === "undefined" || !getClip(id)) return;
    if (opts.interrupt) {
      queue = [];
      start(id);
      return;
    }
    if (playingId === null) {
      start(id);
      return;
    }
    queue = [...queue, id].slice(-maxQueue);
  }

  function stop(): void {
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

  function unlockOnGesture(): void {
    if (typeof window === "undefined" || isUnlockWired) return;
    if (!contextConstructor()) return;
    isUnlockWired = true;
    const remove = () => {
      for (const type of UNLOCK_EVENTS) {
        document.removeEventListener(type, unlock, true);
      }
      if (removeUnlock === remove) removeUnlock = null;
    };
    // Every gesture tries again until the context is running: iOS ignores a
    // resume() from pointerdown, and lines play from frame callbacks, never
    // from inside a gesture.
    const unlock = () => {
      const c = context();
      if (!c || c.state === "running") {
        remove();
        return;
      }
      try {
        const result = c.resume?.();
        result
          ?.then(() => {
            if (c.state === "running") remove();
          })
          .catch(() => undefined);
      } catch {
        // Not allowed from this event; the next one tries again.
      }
    };
    for (const type of UNLOCK_EVENTS) {
      document.addEventListener(type, unlock, true);
    }
    removeUnlock = remove;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function useNowPlaying(): string | null {
    return useSyncExternalStore(
      subscribe,
      () => playingId,
      () => null
    );
  }

  function reset(): void {
    removeUnlock?.();
    stopSource();
    ctx = null;
    buffers.clear();
    audio = null;
    playingId = null;
    queue = [];
    isUnlockWired = false;
  }

  return { play, stop, useNowPlaying, unlockOnGesture, reset };
}
