import { applyAudioSession, type SessionType } from "./audioSession";
import { buildNoise, type VoiceEngine } from "./primitives";
import { softnessGain } from "./channels";

/**
 * A Web Audio context that survives iOS. Extracted from Ever Onward's synth
 * (15d23605, d7542e7e), which learned each of these the hard way:
 *
 * - A context may only start (or resume) inside a user gesture, and iOS only
 *   counts `touchend` and `click` as one for audio.
 * - The audio session is set BEFORE the context is created: "ambient" (the
 *   default) mixes with the player's music or podcast; "playback" plays on
 *   silent but pauses other audio.
 * - A home-screen app can come back from the app switcher, a call or Siri
 *   with a context that is "interrupted", or claims "running" while its clock
 *   is frozen, or whose resume() never settles. Resuming does nothing then:
 *   it is thrown away and rebuilt on the next gesture.
 * - Never use an <audio> element for effects: it takes over Now Playing and
 *   pauses a podcast (4c8ac886).
 */

/** Gestures that may unlock audio (iOS counts only touchend and click). */
export const UNLOCK_EVENTS = [
  "pointerdown",
  "touchend",
  "click",
  "keydown",
] as const;

/** How long after a resume the clock is checked again. */
export const HEALTH_CHECK_MS = 500;
/** A gesture this long after the last look at a frozen clock means it's stuck. */
export const STUCK_MS = 250;

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const legacy = window as unknown as {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? legacy.webkitAudioContext;
}

export function isAudioSupported(): boolean {
  return audioContextConstructor() !== undefined;
}

export interface ResilientAudioOptions {
  /** "ambient" (default) mixes with other apps' audio; "playback" plays on silent. */
  session?: SessionType;
  /** Loudness of the master bus, before the reduced-motion softening. */
  masterLevel?: number;
}

export interface ResilientAudio {
  isSupported(): boolean;
  /**
   * Call from every gesture (the first one creates the context). Rebuilds a
   * dead or frozen context, resumes a suspended one. Returns whether sound
   * can play afterwards.
   */
  wake(): boolean;
  /** The page hid: suspend the context. */
  pause(): void;
  /** The page is back (or a gesture landed): resume if needed. */
  resume(): void;
  /**
   * The graph to play into (ctx, bus, noise buffers), or null while locked,
   * paused or broken. Never cache it: a rebuild replaces it.
   */
  engine(): VoiceEngine | null;
  /** Whether the next gesture will build a new context. */
  isBroken(): boolean;
  /** Called with each new engine (first creation and every rebuild). */
  onEngine(listener: (engine: VoiceEngine) => void): () => void;
  /** Closes the context. */
  dispose(): void;
}

export function createResilientAudioContext(
  options: ResilientAudioOptions = {}
): ResilientAudio {
  const { session, masterLevel = 0.8 } = options;
  let current: VoiceEngine | null = null;
  let isUnlocked = false;
  let isPaused = false;
  let isBroken = false;
  let clockSeen: { ctx: AudioContext; time: number; at: number } | null = null;
  let healthTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(engine: VoiceEngine) => void>();

  function build(): VoiceEngine | null {
    const Ctor = audioContextConstructor();
    if (!Ctor) return null;
    // Before the context exists, or the session type is ignored.
    applyAudioSession(session);
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = masterLevel * softnessGain();
      const limiter = ctx.createDynamicsCompressor();
      master.connect(limiter).connect(ctx.destination);
      const bus = ctx.createGain();
      bus.connect(master);
      ctx.addEventListener?.("statechange", () => {
        if (current?.ctx !== ctx || isPaused || !isUnlocked) return;
        if (ctx.state === "interrupted" || ctx.state === "closed") {
          isBroken = true;
        }
      });
      return {
        ctx,
        bus,
        white: buildNoise(ctx, false),
        brown: buildNoise(ctx, true),
      };
    } catch {
      return null;
    }
  }

  function noteClock(ctx: AudioContext) {
    if (clockSeen?.ctx === ctx && ctx.currentTime <= clockSeen.time) return;
    clockSeen = { ctx, time: ctx.currentTime, at: Date.now() };
  }

  function isClockFrozen(ctx: AudioContext): boolean {
    if (ctx.state !== "running" || clockSeen?.ctx !== ctx) return false;
    if (Date.now() - clockSeen.at < STUCK_MS) return false;
    return ctx.currentTime <= clockSeen.time;
  }

  function clearHealthCheck() {
    if (healthTimer !== null) clearTimeout(healthTimer);
    healthTimer = null;
  }

  /** Looks at the clock shortly after a resume: a working one has moved on. */
  function scheduleHealthCheck(ctx: AudioContext) {
    if (healthTimer !== null) return;
    const time = ctx.currentTime;
    healthTimer = setTimeout(() => {
      healthTimer = null;
      if (current?.ctx !== ctx || isPaused || !isUnlocked) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (ctx.state !== "running" || ctx.currentTime <= time) isBroken = true;
    }, HEALTH_CHECK_MS);
  }

  function announce(engine: VoiceEngine) {
    for (const listener of listeners) listener(engine);
  }

  function rebuild() {
    const old = current;
    clearHealthCheck();
    current = null;
    try {
      void old?.ctx.close?.()?.catch?.(() => undefined);
    } catch {
      // Already closed.
    }
    isBroken = false;
    isPaused = false;
    clockSeen = null;
    current = build();
    if (!current) {
      isUnlocked = false;
      return;
    }
    void current.ctx.resume?.()?.catch?.(() => undefined);
    noteClock(current.ctx);
    scheduleHealthCheck(current.ctx);
    announce(current);
  }

  const audio: ResilientAudio = {
    isSupported: isAudioSupported,

    wake() {
      if (!isUnlocked) {
        current ??= build();
        if (!current) return false;
        isUnlocked = true;
        void current.ctx.resume?.()?.catch?.(() => undefined);
        noteClock(current.ctx);
        scheduleHealthCheck(current.ctx);
        announce(current);
        return true;
      }
      if (!current) return false;
      if (isBroken || isClockFrozen(current.ctx)) {
        rebuild();
        return current !== null;
      }
      audio.resume();
      return !isPaused;
    },

    pause() {
      if (isPaused) return;
      isPaused = true;
      clearHealthCheck();
      clockSeen = null;
      void current?.ctx.suspend?.();
    },

    resume() {
      if (!isUnlocked || !current) return;
      const { ctx } = current;
      isPaused = false;
      noteClock(ctx);
      scheduleHealthCheck(ctx);
      if (ctx.state !== "running") {
        void ctx.resume?.()?.catch?.(() => undefined);
      }
    },

    engine() {
      return isUnlocked && !isPaused && !isBroken ? current : null;
    },

    isBroken: () => isBroken,

    onEngine(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      clearHealthCheck();
      listeners.clear();
      try {
        void current?.ctx.close?.()?.catch?.(() => undefined);
      } catch {
        // Already closed.
      }
      current = null;
      isUnlocked = false;
    },
  };
  return audio;
}
