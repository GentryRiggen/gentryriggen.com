/**
 * The read-aloud player: Jim's own voice (/api/speak) through one shared
 * audio element, part by part, with the browser's speechSynthesis as the
 * fallback when the first part can't be fetched. Framework-free so its
 * state machine can be tested on its own; the page reads it through
 * `subscribe` / `getState` (useSyncExternalStore).
 */

import { chunkForVoice, clampSpeed, speakableText } from "@/lib/jim/speech";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayerState {
  /** What is playing (a message id, a persona sample), null when nothing. */
  key: string | null;
  status: PlayerStatus;
  /** The start of what is read, for the now-playing bar. */
  title: string;
  /** The part playing now (0-based) and how many there are. */
  part: number;
  parts: number;
  /** How far into the current part, 0–1. */
  partProgress: number;
  /** The reading speed (global, remembered on this device). */
  speed: number;
  /** Jim's voice, or the browser's speech (the fallback). */
  engine: "audio" | "speech" | null;
  /** Why playback stopped early, shown in the bar. */
  error: string | null;
}

/** The fallback reader: the browser's own speech (lib/jim/speech). */
export interface SpeechFallback {
  speak: (markdown: string, onEnd: () => void, rate: number) => boolean;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  unlock: () => void;
}

/** The parts of the Media Session API the player uses. */
export interface MediaSessionLike {
  metadata: unknown;
  playbackState?: string;
  setActionHandler: (
    action: "play" | "pause" | "stop",
    handler: (() => void) | null
  ) => void;
}

export interface PlayerDeps {
  /** One part as audio; rejects on any failure (or when `signal` aborts). */
  fetchAudio: (
    text: string,
    voice: string | undefined,
    signal: AbortSignal
  ) => Promise<Blob>;
  /** The shared element, made on first use; null where there's no Audio. */
  createAudio: () => HTMLAudioElement | null;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
  speech: SpeechFallback | null;
  loadSpeed: () => number;
  saveSpeed: (speed: number) => void;
  /** Lock screen / Control Center; null where the API is missing. */
  mediaSession?: () => MediaSessionLike | null;
  /** Builds the lock-screen metadata; null where MediaMetadata is missing. */
  createMetadata?: (init: { title: string; artist: string }) => unknown;
}

export interface PlayOptions {
  /** A voice other than the active persona's (a persona sample). */
  voice?: string;
  /** Who is speaking, for the lock screen. */
  artist?: string;
}

/** The bar's title: this many characters of what is read. */
export const TITLE_CHARS = 40;

export const PLAYER_ERRORS = {
  unavailable: "Couldn't play this reply.",
  rest: "Couldn't load the rest of this reply.",
};

/**
 * A tenth of a second of silence (8 kHz, 8-bit WAV). Played inside a tap,
 * it lets iOS start the shared element later without one.
 */
export const SILENT_CLIP: string = (() => {
  const samples = 800;
  const rate = 8000;
  const bytes: number[] = [];
  const text = (s: string) => {
    for (const c of s) bytes.push(c.charCodeAt(0));
  };
  const u32 = (v: number) =>
    bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255);
  const u16 = (v: number) => bytes.push(v & 255, (v >> 8) & 255);
  text("RIFF");
  u32(36 + samples);
  text("WAVEfmt ");
  u32(16);
  u16(1); // PCM
  u16(1); // mono
  u32(rate);
  u32(rate);
  u16(1);
  u16(8);
  text("data");
  u32(samples);
  for (let i = 0; i < samples; i++) bytes.push(128);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
})();

/** The first ~40 characters on one line, with an ellipsis when cut. */
export function titleFor(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= TITLE_CHARS) return line;
  return `${line.slice(0, TITLE_CHARS).trimEnd()}…`;
}

const IDLE: Omit<PlayerState, "speed"> = {
  key: null,
  status: "idle",
  title: "",
  part: 0,
  parts: 0,
  partProgress: 0,
  engine: null,
  error: null,
};

export class JimPlayer {
  private state: PlayerState;
  private readonly listeners = new Set<() => void>();
  private readonly deps: PlayerDeps;
  private audio: HTMLAudioElement | null = null;
  private audioMade = false;
  /** Bumped by every play and stop: anything older drops what it gets. */
  private run = 0;
  private controller: AbortController | null = null;
  private chunks: string[] = [];
  private markdown = "";
  private voice: string | undefined;
  private artist = "Jim";
  /** Fetches per part, started early so the next part is ready. */
  private fetches: Promise<Blob | null>[] = [];
  /** Parts whose fetch has settled (no "loading" flash between parts). */
  private settled: boolean[] = [];
  /** The blob URL on the element now. */
  private url: string | null = null;

  constructor(deps: PlayerDeps) {
    this.deps = deps;
    this.state = { ...IDLE, speed: clampSpeed(deps.loadSpeed()) };
  }

  // ---------- store ----------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): PlayerState => this.state;

  private set(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    this.syncMediaSession();
    for (const listener of this.listeners) listener();
  }

  /** Something can be read here: Jim's voice or the browser's. */
  get supported(): boolean {
    return this.element() !== null || this.deps.speech !== null;
  }

  // ---------- controls ----------

  /**
   * Reads `markdown` aloud, replacing whatever is on. Returns false when
   * there is nothing to say (or no way to say it).
   */
  play(key: string, markdown: string, options: PlayOptions = {}): boolean {
    this.stop();
    const text = speakableText(markdown);
    const chunks = chunkForVoice(text);
    if (chunks.length === 0 || !this.supported) return false;
    const run = this.run;
    this.controller = new AbortController();
    this.chunks = chunks;
    this.markdown = markdown;
    this.voice = options.voice;
    if (options.artist) this.artist = options.artist;
    this.fetches = [];
    this.settled = [];
    this.set({
      ...IDLE,
      key,
      status: "loading",
      title: titleFor(text),
      parts: chunks.length,
      engine: "audio",
    });
    if (this.element() === null) this.fallBack(run);
    else void this.playPart(run, 0);
    return true;
  }

  /** Stops and forgets what was on; the bar goes away. */
  stop(): void {
    this.run += 1;
    this.controller?.abort();
    this.controller = null;
    const { engine } = this.state;
    if (this.audio && engine === "audio") this.audio.pause();
    if (engine === "speech") this.deps.speech?.stop();
    this.dropUrl();
    this.fetches = [];
    this.settled = [];
    if (this.state.status !== "idle") this.set({ ...IDLE });
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    if (this.state.engine === "speech") this.deps.speech?.pause();
    else this.audio?.pause();
    this.set({ status: "paused" });
  }

  /** Call from a tap (or a lock-screen control): iOS needs one to resume. */
  resume(): void {
    if (this.state.status !== "paused") return;
    if (this.state.engine === "speech") {
      this.deps.speech?.resume();
      this.set({ status: "playing" });
      return;
    }
    if (!this.audio || !this.url) return;
    this.set({ status: "playing" });
    this.startElement(this.run);
  }

  togglePause(): void {
    if (this.state.status === "playing") this.pause();
    else if (this.state.status === "paused") this.resume();
  }

  /** The global speed: applies now to Jim's voice, from the next reply to speech. */
  setSpeed(speed: number): void {
    const next = clampSpeed(speed);
    this.deps.saveSpeed(next);
    if (this.audio) {
      this.audio.defaultPlaybackRate = next;
      this.audio.playbackRate = next;
    }
    if (next !== this.state.speed) this.set({ speed: next });
  }

  /** Clears an error from the bar. */
  dismiss(): void {
    if (this.state.status === "error") this.set({ ...IDLE });
  }

  /** Who is speaking, for the lock screen (the active persona). */
  setArtist(name: string): void {
    this.artist = name || "Jim";
    this.syncMediaSession();
  }

  /**
   * Call inside a tap (Send): plays a moment of silence on the shared
   * element, so a reply read later without a tap may start on iOS. The
   * speech fallback is unlocked too.
   */
  unlock(): void {
    this.deps.speech?.unlock();
    const audio = this.element();
    // Something on already has the element unlocked; don't cut it off.
    if (
      !audio ||
      (this.state.status !== "idle" && this.state.status !== "error")
    ) {
      return;
    }
    try {
      audio.src = SILENT_CLIP;
      const started = audio.play() as Promise<void> | undefined;
      started
        ?.then(() => {
          if (audio.src === SILENT_CLIP) audio.pause();
        })
        .catch(() => {});
    } catch {
      // A browser that won't play silence won't play the reply either.
    }
  }

  /** Stops for good (the page is going away). */
  destroy(): void {
    this.stop();
    this.clearMediaSession();
  }

  // ---------- parts ----------

  private element(): HTMLAudioElement | null {
    if (!this.audioMade) {
      this.audioMade = true;
      try {
        this.audio = this.deps.createAudio();
      } catch {
        this.audio = null;
      }
      this.audio?.addEventListener("ended", this.onEnded);
      this.audio?.addEventListener("timeupdate", this.onTime);
      this.audio?.addEventListener("pause", this.onPaused);
      this.audio?.addEventListener("error", this.onError);
    }
    return this.audio;
  }

  /** The fetch for part `i`, started once; null when it failed. */
  private fetchPart(i: number): Promise<Blob | null> {
    const existing = this.fetches[i];
    if (existing) return existing;
    const signal = this.controller?.signal ?? new AbortController().signal;
    const fetched = this.deps
      .fetchAudio(this.chunks[i], this.voice, signal)
      .then(
        (blob) => blob,
        () => null
      )
      .then((blob) => {
        if (this.fetches[i] === fetched) this.settled[i] = true;
        return blob;
      });
    this.fetches[i] = fetched;
    return fetched;
  }

  private async playPart(run: number, i: number): Promise<void> {
    const audio = this.audio;
    if (!audio) return;
    const waiting = this.fetchPart(i);
    if (!this.settled[i] && this.state.status === "playing") {
      this.set({ status: "loading" });
    }
    const blob = await waiting;
    if (run !== this.run) return;
    if (!blob) {
      if (i === 0) this.fallBack(run);
      else this.fail(PLAYER_ERRORS.rest);
      return;
    }
    // While this part plays, the next one is on its way.
    if (i + 1 < this.chunks.length) void this.fetchPart(i + 1);
    this.dropUrl();
    const url = this.deps.createUrl(blob);
    this.url = url;
    audio.src = url;
    // A new source resets the rate to the default rate: set both.
    audio.defaultPlaybackRate = this.state.speed;
    audio.playbackRate = this.state.speed;
    this.set({ status: "playing", part: i, partProgress: 0 });
    this.startElement(run);
  }

  private startElement(run: number): void {
    const audio = this.audio;
    if (!audio) return;
    let started: Promise<void> | undefined;
    try {
      started = audio.play() as Promise<void> | undefined;
    } catch {
      this.whenRefused(run, new Error("play failed"));
      return;
    }
    started?.catch((err: unknown) => this.whenRefused(run, err));
  }

  /** play() refused: with no tap to start it (iOS), wait for one. */
  private whenRefused(run: number, err: unknown): void {
    if (run !== this.run || this.state.engine !== "audio") return;
    const name =
      typeof err === "object" && err !== null && "name" in err
        ? (err as { name: unknown }).name
        : undefined;
    // A newer source replaced this one: not a failure.
    if (name === "AbortError") return;
    if (name === "NotAllowedError") {
      this.set({ status: "paused" });
      return;
    }
    if (this.state.part === 0) this.fallBack(run);
    else this.fail(PLAYER_ERRORS.rest);
  }

  /** The first part didn't come: the browser's own voice reads it all. */
  private fallBack(run: number): void {
    if (run !== this.run) return;
    this.dropUrl();
    const speech = this.deps.speech;
    if (!speech) {
      this.fail(PLAYER_ERRORS.unavailable);
      return;
    }
    this.controller?.abort();
    this.set({ status: "playing", engine: "speech", part: 0, parts: 1 });
    const started = speech.speak(
      this.markdown,
      () => {
        if (run === this.run) this.finish();
      },
      this.state.speed
    );
    if (!started && run === this.run) this.finish();
  }

  private fail(message: string): void {
    this.run += 1;
    this.controller?.abort();
    this.controller = null;
    this.audio?.pause();
    this.dropUrl();
    this.fetches = [];
    this.settled = [];
    this.set({ ...IDLE, status: "error", error: message });
  }

  private finish(): void {
    this.run += 1;
    this.controller = null;
    this.dropUrl();
    this.fetches = [];
    this.settled = [];
    this.set({ ...IDLE });
  }

  private dropUrl(): void {
    if (this.url) this.deps.revokeUrl(this.url);
    this.url = null;
  }

  /** An event from the element for the part on now (not the unlock clip). */
  private isCurrent(): boolean {
    return (
      this.state.engine === "audio" &&
      this.url !== null &&
      this.audio?.src === this.url
    );
  }

  private onEnded = (): void => {
    if (!this.isCurrent() || this.state.status !== "playing") return;
    const next = this.state.part + 1;
    if (next < this.chunks.length) void this.playPart(this.run, next);
    else this.finish();
  };

  private onTime = (): void => {
    const audio = this.audio;
    if (!audio || !this.isCurrent()) return;
    const { duration, currentTime } = audio;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    // A few percent at a time is plenty for a thin bar.
    if (Math.abs(progress - this.state.partProgress) >= 0.02) {
      this.set({ partProgress: progress });
    }
  };

  /** Paused by the system (a call, headphones out): the bar follows. */
  private onPaused = (): void => {
    if (!this.isCurrent() || this.audio?.ended) return;
    if (this.state.status === "playing") this.set({ status: "paused" });
  };

  private onError = (): void => {
    if (!this.isCurrent()) return;
    if (this.state.part === 0) this.fallBack(this.run);
    else this.fail(PLAYER_ERRORS.rest);
  };

  // ---------- lock screen ----------

  private syncMediaSession(): void {
    const session = this.deps.mediaSession?.() ?? null;
    if (!session) return;
    const { status } = this.state;
    if (status === "idle" || status === "error") {
      this.clearMediaSession();
      return;
    }
    try {
      const metadata = this.deps.createMetadata?.({
        title: "Jim",
        artist: this.artist,
      });
      if (metadata !== undefined && metadata !== null) {
        session.metadata = metadata;
      }
      session.playbackState = status === "paused" ? "paused" : "playing";
      session.setActionHandler("play", () => this.resume());
      session.setActionHandler("pause", () => this.pause());
      session.setActionHandler("stop", () => this.stop());
    } catch {
      // A partial Media Session is fine to ignore: the bar still works.
    }
  }

  private clearMediaSession(): void {
    const session = this.deps.mediaSession?.() ?? null;
    if (!session) return;
    try {
      session.metadata = null;
      session.playbackState = "none";
      for (const action of ["play", "pause", "stop"] as const) {
        session.setActionHandler(action, null);
      }
    } catch {
      // Ignored, as above.
    }
  }
}

/** The player wired to this browser: Jim's voice, speech as the fallback. */
export function browserPlayerDeps(
  fetchAudio: PlayerDeps["fetchAudio"],
  speech: SpeechFallback | null,
  loadSpeed: () => number,
  saveSpeed: (speed: number) => void
): PlayerDeps {
  return {
    fetchAudio,
    createAudio: () => {
      if (typeof Audio === "undefined") return null;
      const audio = new Audio();
      audio.preload = "auto";
      return audio;
    },
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
    speech,
    loadSpeed,
    saveSpeed,
  };
}
