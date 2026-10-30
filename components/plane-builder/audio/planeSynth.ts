/**
 * Every sound here is synthesized with the Web Audio API (no audio files).
 * Each one-shot builds a small graph of oscillators and noise that
 * disconnects itself when it ends. Nothing touches the AudioContext until
 * `enable()`, which must run inside a click or key press.
 */

import type { MusicSpec } from "../../game-audio/music";
import {
  createMusicPlayer,
  type MusicPlayer,
} from "../../game-audio/musicPlayer";
import { softnessGain, watchReducedMotion } from "../../game-audio/channels";
import {
  buildFlightBeds,
  SILENT_FLIGHT,
  type FlightBeds,
  type FlightSound,
} from "./planeBeds";
import {
  playBoost,
  playDailySting,
  playGhostPass,
  playNearMiss,
  playStallBeep,
} from "./planeVoices";

export type PlaneCue =
  | "launch"
  | "coin"
  | "ring"
  | "bump"
  | "shield"
  | "crash"
  | "land"
  | "fuel"
  | "flag"
  | "cheer"
  | "buy"
  | "boost"
  | "nearMiss"
  | "ghostPass"
  | "daily";

/** Cues whose voices live in `planeVoices.ts`. */
type SoundPassCue = "boost" | "nearMiss" | "ghostPass" | "daily";

function isSoundPassCue(cue: PlaneCue): cue is SoundPassCue {
  return (
    cue === "boost" ||
    cue === "nearMiss" ||
    cue === "ghostPass" ||
    cue === "daily"
  );
}

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

export interface PlaneSynth {
  /** Creates (first call) and resumes the context. Call from a user gesture. */
  enable: () => boolean;
  /** Silences everything and suspends the context. */
  disable: () => void;
  isEnabled: () => boolean;
  /** Cuts the engine and suspends the context. Stays enabled. */
  pause: () => void;
  /** Wakes a paused context. The next `setEngine` brings the hum back. */
  resume: () => void;
  play: (cue: PlaneCue) => void;
  /** 0 (silent, no fuel) to 1 (boost); a normal burn is about 0.5. */
  setEngine: (level: number) => void;
  /**
   * The flight's held sounds in one call: engine, wind, the boost whoosh (on
   * the press) and the stall warning. Call it every frame; it only sends
   * changes to the audio thread.
   */
  setFlight: (sound: FlightSound) => void;
  /** Whether a one-shot cue would be heard right now. */
  canPlay: () => boolean;
  /**
   * A sound component calls this while it is mounted and calls the returned
   * function on unmount. When the last one lets go, the engine, wind and
   * music are torn down and the context is suspended; the next `acquire`
   * rebuilds them.
   */
  acquire: () => () => void;
  /** Sound effects on or off (the held sounds follow). */
  setEffectsEnabled: (isOn: boolean) => void;
  /** Music on or off. It only plays while the audio is unlocked. */
  setMusicEnabled: (isOn: boolean) => void;
  /** The bed to play, or null for none. */
  setMusic: (spec: MusicSpec | null) => void;
  /** 0 to 1: a screen can turn the bed down. */
  setMusicLevel: (level: number) => void;
}

const NOISE_SECONDS = 2;
const MASTER_LEVEL = 0.7;
/** Stall beeps come this often (seconds), faster as the stall nears. */
const STALL_SLOW_S = 0.75;
const STALL_FAST_S = 0.3;

interface Engine {
  ctx: AudioContext;
  bus: GainNode;
  white: AudioBuffer;
  brown: AudioBuffer;
}

function buildNoise(ctx: AudioContext, isBrown: boolean): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (isBrown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function buildEngine(Ctor: AudioContextConstructor): Engine {
  const ctx = new Ctor();
  const bus = ctx.createGain();
  bus.gain.value = MASTER_LEVEL * softnessGain();
  const limiter = ctx.createDynamicsCompressor();
  bus.connect(limiter).connect(ctx.destination);
  return {
    ctx,
    bus,
    white: buildNoise(ctx, false),
    brown: buildNoise(ctx, true),
  };
}

/** Disconnects every node once `last` ends, so nothing lingers. */
function disconnectOnEnd(last: AudioScheduledSourceNode, nodes: AudioNode[]) {
  last.onended = () => {
    for (const node of nodes) node.disconnect();
  };
}

interface ToneOptions {
  type: OscillatorType;
  start: number;
  duration: number;
  freq: number;
  freqEnd?: number;
  gain: number;
  attack?: number;
}

/** A shaped tone, optionally bent in pitch. */
function tone(engine: Engine, opts: ToneOptions) {
  const { ctx, bus } = engine;
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freq, opts.start);
  const end = opts.start + opts.duration;
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, end);
  }
  const gain = ctx.createGain();
  const attack = opts.attack ?? 0.01;
  gain.gain.setValueAtTime(0.0001, opts.start);
  gain.gain.linearRampToValueAtTime(opts.gain, opts.start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(bus);
  osc.start(opts.start);
  osc.stop(end + 0.05);
  disconnectOnEnd(osc, [osc, gain]);
}

interface NoiseOptions {
  buffer: AudioBuffer;
  start: number;
  duration: number;
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  gain: number;
  attack?: number;
}

/** A shaped burst of filtered noise. */
function noise(engine: Engine, opts: NoiseOptions) {
  const { ctx, bus } = engine;
  const source = ctx.createBufferSource();
  source.buffer = opts.buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter;
  filter.frequency.setValueAtTime(opts.freq, opts.start);
  const end = opts.start + opts.duration;
  if (opts.freqEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, end);
  }
  const gain = ctx.createGain();
  const attack = opts.attack ?? 0.005;
  gain.gain.setValueAtTime(0.0001, opts.start);
  gain.gain.linearRampToValueAtTime(opts.gain, opts.start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter).connect(gain).connect(bus);
  source.start(opts.start, Math.random() * (NOISE_SECONDS - 0.1));
  source.stop(end + 0.05);
  disconnectOnEnd(source, [source, filter, gain]);
}

/** Plays `freqs` one after another, `gap` seconds apart. */
function arpeggio(
  engine: Engine,
  freqs: readonly number[],
  gap: number,
  opts: Pick<ToneOptions, "type" | "duration" | "gain">
) {
  const now = engine.ctx.currentTime;
  freqs.forEach((freq, i) => {
    tone(engine, { ...opts, freq, start: now + i * gap });
  });
}

const CUES: Record<
  Exclude<PlaneCue, SoundPassCue>,
  (engine: Engine) => void
> = {
  // Two quick square blips, 880 to 1320 Hz.
  coin: (e) => {
    arpeggio(e, [880, 1320], 0.07, {
      type: "square",
      duration: 0.12,
      gain: 0.12,
    });
  },
  ring: (e) => {
    arpeggio(e, [523, 659, 784, 1047], 0.06, {
      type: "triangle",
      duration: 0.2,
      gain: 0.2,
    });
  },
  bump: (e) => {
    tone(e, {
      type: "sine",
      start: e.ctx.currentTime,
      duration: 0.25,
      freq: 130,
      freqEnd: 50,
      gain: 0.8,
    });
  },
  shield: (e) => {
    const now = e.ctx.currentTime;
    tone(e, {
      type: "triangle",
      start: now,
      duration: 0.5,
      freq: 1760,
      gain: 0.18,
      attack: 0.003,
    });
    tone(e, {
      type: "sine",
      start: now,
      duration: 0.4,
      freq: 2640,
      gain: 0.1,
      attack: 0.003,
    });
  },
  crash: (e) => {
    const now = e.ctx.currentTime;
    noise(e, {
      buffer: e.white,
      start: now,
      duration: 0.9,
      filter: "lowpass",
      freq: 4000,
      freqEnd: 200,
      gain: 0.9,
    });
    tone(e, {
      type: "sine",
      start: now,
      duration: 0.5,
      freq: 100,
      freqEnd: 35,
      gain: 0.7,
    });
  },
  land: (e) => {
    const now = e.ctx.currentTime;
    tone(e, {
      type: "sine",
      start: now,
      duration: 0.4,
      freq: 90,
      freqEnd: 40,
      gain: 0.6,
    });
    noise(e, {
      buffer: e.brown,
      start: now,
      duration: 0.5,
      filter: "lowpass",
      freq: 300,
      freqEnd: 80,
      gain: 0.5,
      attack: 0.01,
    });
  },
  // Two quick rising sine blips, like a glug.
  fuel: (e) => {
    arpeggio(e, [330, 494], 0.08, {
      type: "sine",
      duration: 0.14,
      gain: 0.22,
    });
  },
  // A short three-note fanfare, quieter than the cheer.
  flag: (e) => {
    arpeggio(e, [523, 659, 784], 0.09, {
      type: "triangle",
      duration: 0.16,
      gain: 0.14,
    });
  },
  // A major chord that swells in.
  cheer: (e) => {
    const now = e.ctx.currentTime;
    for (const freq of [262, 330, 392, 523]) {
      tone(e, {
        type: "triangle",
        start: now,
        duration: 1.4,
        freq,
        gain: 0.14,
        attack: 0.5,
      });
    }
  },
  // A cash-register blip.
  buy: (e) => {
    arpeggio(e, [1175, 1568], 0.08, {
      type: "square",
      duration: 0.25,
      gain: 0.1,
    });
  },
  // A band twang: a sine sweep from 300 down to 120 Hz.
  launch: (e) => {
    tone(e, {
      type: "sine",
      start: e.ctx.currentTime,
      duration: 0.35,
      freq: 300,
      freqEnd: 120,
      gain: 0.7,
      attack: 0.005,
    });
  },
};

/** How much each cue dips the music, and for how long (seconds). */
const DUCK: Partial<Record<PlaneCue, readonly [number, number]>> = {
  coin: [0.12, 0.2],
  ring: [0.3, 0.4],
  bump: [0.5, 0.6],
  shield: [0.3, 0.5],
  crash: [0.75, 1.4],
  land: [0.4, 0.8],
  fuel: [0.15, 0.3],
  flag: [0.25, 0.5],
  cheer: [0.5, 1.5],
  boost: [0.2, 0.6],
  nearMiss: [0.2, 0.3],
  ghostPass: [0.25, 0.5],
  daily: [0.5, 1.8],
};

const SOUND_PASS_CUES: Record<SoundPassCue, (engine: Engine) => void> = {
  boost: playBoost,
  nearMiss: playNearMiss,
  ghostPass: playGhostPass,
  daily: playDailySting,
};

export function createPlaneSynth(): PlaneSynth {
  let engine: Engine | null = null;
  let beds: FlightBeds | null = null;
  let music: MusicPlayer | null = null;
  let stopWatchingMotion: (() => void) | null = null;
  let holders = 0;
  let isOn = false;
  let isEffectsOn = true;
  let isMusicOn = true;
  let isPaused = false;
  let wantedMusic: MusicSpec | null = null;
  let musicLevel = 1;
  let flight: FlightSound = SILENT_FLIGHT;
  let wasBoosting = false;
  let nextStallAt = 0;

  function applyBeds() {
    if (!beds) return;
    beds.update(isOn && isEffectsOn && !isPaused ? flight : SILENT_FLIGHT);
  }

  function applyMusic() {
    if (!music) return;
    music.setLevel(musicLevel);
    if (isOn && isMusicOn && !isPaused && wantedMusic) music.start(wantedMusic);
    else music.stop();
  }

  function applyMaster() {
    if (!engine) return;
    engine.bus.gain.setTargetAtTime(
      MASTER_LEVEL * softnessGain(),
      engine.ctx.currentTime,
      0.1
    );
    beds?.setCalm(softnessGain() < 1);
  }

  /** The beds and music hang on the engine; they can be torn down and rebuilt. */
  function buildGraph(built: Engine) {
    beds = buildFlightBeds(built, softnessGain() < 1);
    // The music runs through the master bus like everything else, so the
    // master level and reduced-motion softness apply to it too.
    music = createMusicPlayer(built.ctx, built.bus);
    stopWatchingMotion = watchReducedMotion(applyMaster);
  }

  function teardownGraph() {
    stopWatchingMotion?.();
    stopWatchingMotion = null;
    music?.dispose();
    beds?.dispose();
    music = null;
    beds = null;
  }

  function enable(): boolean {
    const Ctor = audioContextConstructor();
    if (!Ctor) return false;
    try {
      if (!engine) engine = buildEngine(Ctor);
      if (!beds) buildGraph(engine);
      void engine.ctx.resume();
    } catch {
      teardownGraph();
      engine = null;
      return false;
    }
    isOn = true;
    isPaused = false;
    applyBeds();
    applyMusic();
    return true;
  }

  function acquire(): () => void {
    holders += 1;
    if (holders === 1 && isOn && engine) {
      // Back after the last sound component left: rebuild what it dropped.
      if (!beds) buildGraph(engine);
      isPaused = false;
      void engine.ctx.resume();
      applyBeds();
      applyMusic();
    }
    let isReleased = false;
    return () => {
      if (isReleased) return;
      isReleased = true;
      holders -= 1;
      if (holders > 0) return;
      // Nothing is driving the audio any more: free the graph and go quiet.
      teardownGraph();
      if (engine) void engine.ctx.suspend();
    };
  }

  function silenceBeds() {
    beds?.silence();
  }

  function disable() {
    isOn = false;
    silenceBeds();
    music?.stop();
    if (engine) void engine.ctx.suspend();
  }

  function pause() {
    isPaused = true;
    silenceBeds();
    music?.pause();
    if (engine) void engine.ctx.suspend();
  }

  function resume() {
    if (!isOn || !engine) return;
    isPaused = false;
    void engine.ctx.resume();
    applyBeds();
    music?.resume();
    applyMusic();
  }

  function canPlay(): boolean {
    return isOn && !!engine && !!beds && isEffectsOn && !isPaused;
  }

  function play(cue: PlaneCue) {
    if (!canPlay() || !engine) return;
    const ducking = DUCK[cue];
    if (ducking) music?.duck(ducking[0], ducking[1]);
    if (isSoundPassCue(cue)) SOUND_PASS_CUES[cue](engine);
    else CUES[cue](engine);
  }

  function setFlight(next: FlightSound) {
    flight = next;
    if (!isOn || !engine || !isEffectsOn || isPaused) {
      wasBoosting = next.boosting;
      return;
    }
    applyBeds();
    if (next.boosting && !wasBoosting) play("boost");
    wasBoosting = next.boosting;

    // The stall warning paces itself on the audio clock, faster as it nears.
    if (next.stall > 0) {
      const now = engine.ctx.currentTime;
      if (now >= nextStallAt) {
        playStallBeep(engine, next.stall);
        nextStallAt =
          now + STALL_SLOW_S - (STALL_SLOW_S - STALL_FAST_S) * next.stall;
      }
    } else {
      nextStallAt = 0;
    }
  }

  // Reused by `setEngine`, which runs every frame in older call sites.
  const engineOnly: FlightSound = { ...SILENT_FLIGHT };

  function setEngine(next: number) {
    engineOnly.engine = Math.min(1, Math.max(0, next));
    engineOnly.speed = flight.speed;
    engineOnly.boosting = flight.boosting;
    engineOnly.stall = flight.stall;
    setFlight(engineOnly);
  }

  function setEffectsEnabled(next: boolean) {
    if (isEffectsOn === next) return;
    isEffectsOn = next;
    applyBeds();
  }

  function setMusicEnabled(next: boolean) {
    isMusicOn = next;
    applyMusic();
  }

  function setMusic(spec: MusicSpec | null) {
    wantedMusic = spec;
    applyMusic();
  }

  function setMusicLevel(level: number) {
    musicLevel = level;
    music?.setLevel(level);
  }

  return {
    enable,
    disable,
    isEnabled: () => isOn,
    pause,
    resume,
    play,
    setEngine,
    setFlight,
    canPlay,
    acquire,
    setEffectsEnabled,
    setMusicEnabled,
    setMusic,
    setMusicLevel,
  };
}

/** The one synth that the toggle, the cues and the flight share. */
export const planeSynth: PlaneSynth = createPlaneSynth();
