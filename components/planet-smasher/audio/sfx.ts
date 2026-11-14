import {
  buildNoise,
  noise,
  tone,
  type VoiceEngine,
} from "@/components/game-audio/primitives";
import { softnessGain } from "@/components/game-audio/channels";
import type { ToolId } from "@/lib/planet-smasher/tools";
import { soundSetting } from "./soundSetting";

export type Cue =
  | "launch"
  | "impactSmall"
  | "impactBig"
  | "nuke"
  | "rumble"
  | "zapStart"
  | "zapStop"
  | "freeze"
  | "moonWhoosh"
  | "blackHoleHum"
  | "endShatter"
  | "endMolten"
  | "endFrozen"
  | "endSwallowed"
  | "unlock"
  | "uiTap"
  | "newPlanet";

/**
 * What each weapon sounds like. `launch` plays when it is fired and `impact`
 * when it lands. The alien laser's `launch` starts a loop that `zapStop`
 * ends; its `impact` is not played per tick.
 */
export const TOOL_CUES: Record<ToolId, { launch: Cue | null; impact: Cue }> = {
  asteroid: { launch: "launch", impact: "impactSmall" },
  meteorShower: { launch: "launch", impact: "impactSmall" },
  megaBomb: { launch: "launch", impact: "impactBig" },
  nuke: { launch: "launch", impact: "nuke" },
  supervolcano: { launch: null, impact: "rumble" },
  earthquake: { launch: null, impact: "rumble" },
  alienLaser: { launch: "zapStart", impact: "impactSmall" },
  freezeRay: { launch: null, impact: "freeze" },
  moonRam: { launch: "moonWhoosh", impact: "impactBig" },
  blackHole: { launch: "blackHoleHum", impact: "impactSmall" },
};

/** The most voices sounding at once; cues past it are dropped. */
export const MAX_VOICES = 12;
const MASTER_LEVEL = 0.7;

type Voice = (engine: VoiceEngine, t: number, level: number) => void;

/** Seconds a cue sounds for (to count voices), and the gap before a repeat. */
const SPEC: Record<
  Exclude<Cue, "zapStart" | "zapStop">,
  { seconds: number; gap: number; play: Voice; priority?: boolean }
> = {
  launch: { seconds: 0.4, gap: 0.08, play: playLaunch },
  impactSmall: { seconds: 0.4, gap: 0.05, play: playImpactSmall },
  impactBig: { seconds: 1, gap: 0.1, play: playImpactBig },
  nuke: { seconds: 2, gap: 0.2, play: playNuke },
  rumble: { seconds: 1.5, gap: 0.2, play: playRumble },
  freeze: { seconds: 1, gap: 0.2, play: playFreeze },
  moonWhoosh: { seconds: 1, gap: 0.2, play: playMoonWhoosh },
  blackHoleHum: { seconds: 1.7, gap: 0.2, play: playBlackHoleHum },
  endShatter: { seconds: 2.6, gap: 0.5, play: playEndShatter, priority: true },
  endMolten: { seconds: 2.8, gap: 0.5, play: playEndMolten, priority: true },
  endFrozen: { seconds: 2.4, gap: 0.5, play: playEndFrozen, priority: true },
  endSwallowed: {
    seconds: 3,
    gap: 0.5,
    play: playEndSwallowed,
    priority: true,
  },
  unlock: { seconds: 0.8, gap: 0.2, play: playUnlock, priority: true },
  uiTap: { seconds: 0.1, gap: 0.04, play: playUiTap },
  newPlanet: { seconds: 0.9, gap: 0.3, play: playNewPlanet, priority: true },
};

interface Engine extends VoiceEngine {
  /** End times (audio clock) of the voices still sounding. */
  ends: number[];
  lastAt: Partial<Record<Cue, number>>;
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

let engine: Engine | null = null;
let isOn = false;
let zap: { stop(): void } | null = null;

function buildEngine(Ctor: AudioContextConstructor): Engine {
  const ctx = new Ctor();
  const bus = ctx.createGain();
  bus.gain.value = MASTER_LEVEL * softnessGain();
  // A simple limiter, so stacked booms never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 6;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  bus.connect(limiter).connect(ctx.destination);
  return {
    ctx,
    bus,
    white: buildNoise(ctx, false),
    brown: buildNoise(ctx, true),
    ends: [],
    lastAt: {},
  };
}

/** Creates (first call) and resumes the audio. Call it from a user gesture. */
export function enableSfx(): boolean {
  const Ctor = audioContextConstructor();
  if (!Ctor) return false;
  try {
    if (!engine) engine = buildEngine(Ctor);
    void engine.ctx.resume();
  } catch {
    engine = null;
    return false;
  }
  isOn = true;
  return true;
}

export function disableSfx(): void {
  isOn = false;
  stopZap();
  if (engine) void engine.ctx.suspend();
}

/** Frees the audio (the game left the screen); a new tap starts it again. */
export function closeSfx(): void {
  isOn = false;
  stopZap();
  const old = engine;
  engine = null;
  if (old) void old.ctx.close();
}

export function isSfxEnabled(): boolean {
  return isOn && engine !== null;
}

/** Suspends the audio while the tab is hidden. */
export function pauseSfx(): void {
  stopZap();
  if (engine) void engine.ctx.suspend();
}

export function resumeSfx(): void {
  if (isOn && engine) void engine.ctx.resume();
}

/** Plays a cue at `intensity` (about 0.2 to 1.5). No-op when sound is off. */
export function playCue(cue: Cue, intensity = 1): void {
  if (!isOn || !engine || !soundSetting.get()) return;
  if (cue === "zapStart") return startZap(engine);
  if (cue === "zapStop") return stopZap();
  const spec = SPEC[cue];
  const { ctx } = engine;
  const now = ctx.currentTime;
  const last = engine.lastAt[cue];
  if (last !== undefined && now - last < spec.gap) return;
  engine.ends = engine.ends.filter((end) => end > now);
  if (!spec.priority && engine.ends.length >= MAX_VOICES) return;
  engine.lastAt[cue] = now;
  engine.ends.push(now + spec.seconds);
  try {
    spec.play(engine, now + 0.005, Math.min(1.5, Math.max(0.2, intensity)));
  } catch {
    // A failed voice must never break the game.
  }
}

/* ------------------------------------------------------------------ */
/* Voices                                                              */
/* ------------------------------------------------------------------ */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function playLaunch(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 0.35,
    filter: "bandpass",
    freq: 500,
    freqEnd: 2600,
    q: 1.2,
    gain: 0.16 * k,
    attack: 0.08,
  });
}

function playImpactSmall(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.brown,
    start: t,
    duration: 0.35,
    filter: "lowpass",
    freq: 900,
    freqEnd: 120,
    gain: 0.6 * k,
  });
  tone(e, {
    type: "sine",
    start: t,
    duration: 0.3,
    freq: 130,
    freqEnd: 45,
    gain: 0.5 * k,
  });
}

function playImpactBig(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.brown,
    start: t,
    duration: 0.9,
    filter: "lowpass",
    freq: 1500,
    freqEnd: 90,
    gain: 0.9 * k,
  });
  tone(e, {
    type: "sine",
    start: t,
    duration: 0.8,
    freq: 95,
    freqEnd: 30,
    gain: 0.8 * k,
  });
}

function playNuke(e: VoiceEngine, t: number, k: number) {
  playImpactBig(e, t, k);
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 0.25,
    filter: "highpass",
    freq: 1800,
    gain: 0.3 * k,
  });
  noise(e, {
    buffer: e.brown,
    start: t + 0.15,
    duration: 1.8,
    filter: "lowpass",
    freq: 500,
    freqEnd: 50,
    gain: 0.8 * k,
    attack: 0.2,
  });
  tone(e, {
    type: "sine",
    start: t + 0.1,
    duration: 1.7,
    freq: 55,
    freqEnd: 24,
    gain: 0.7 * k,
    attack: 0.15,
  });
}

function playRumble(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.brown,
    start: t,
    duration: 1.4,
    filter: "lowpass",
    freq: 220,
    freqEnd: 60,
    gain: 0.8 * k,
    attack: 0.15,
    chop: 0.06,
  });
  tone(e, {
    type: "sine",
    start: t,
    duration: 1.3,
    freq: 52,
    freqEnd: 34,
    gain: 0.5 * k,
    attack: 0.2,
  });
}

function playFreeze(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 0.8,
    filter: "highpass",
    freq: 3500,
    freqEnd: 7000,
    gain: 0.16 * k,
    attack: 0.1,
  });
  tinkles(e, t + 0.05, 6, 0.18 * k);
}

/** A few glassy high pings. */
function tinkles(e: VoiceEngine, t: number, count: number, gain: number) {
  for (let i = 0; i < count; i++) {
    tone(e, {
      type: "sine",
      start: t + i * rand(0.05, 0.11),
      duration: 0.28,
      freq: rand(2200, 4600),
      gain,
      attack: 0.003,
    });
  }
}

function playMoonWhoosh(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 1,
    filter: "bandpass",
    freq: 180,
    freqEnd: 1400,
    q: 0.9,
    gain: 0.3 * k,
    attack: 0.7,
  });
  tone(e, {
    type: "sine",
    start: t,
    duration: 0.9,
    freq: 70,
    freqEnd: 160,
    gain: 0.35 * k,
    attack: 0.5,
  });
}

function playBlackHoleHum(e: VoiceEngine, t: number, k: number) {
  for (const f of [55, 58]) {
    tone(e, {
      type: "sine",
      start: t,
      duration: 1.6,
      freq: f,
      freqEnd: f * 0.8,
      gain: 0.3 * k,
      attack: 0.7,
    });
  }
  noise(e, {
    buffer: e.brown,
    start: t,
    duration: 1.6,
    filter: "lowpass",
    freq: 160,
    gain: 0.35 * k,
    attack: 0.8,
  });
}

function playEndShatter(e: VoiceEngine, t: number, k: number) {
  // The cracks groan, then the big boom.
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 0.7,
    filter: "bandpass",
    freq: 1200,
    q: 2,
    gain: 0.12 * k,
    attack: 0.5,
    chop: 0.04,
  });
  const boom = t + 0.7;
  noise(e, {
    buffer: e.brown,
    start: boom,
    duration: 1.9,
    filter: "lowpass",
    freq: 2200,
    freqEnd: 60,
    gain: 1 * k,
  });
  tone(e, {
    type: "sine",
    start: boom,
    duration: 1.8,
    freq: 75,
    freqEnd: 22,
    gain: 0.9 * k,
  });
  noise(e, {
    buffer: e.white,
    start: boom,
    duration: 1.1,
    filter: "highpass",
    freq: 2500,
    gain: 0.25 * k,
    chop: 0.05,
  });
}

function playEndMolten(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.brown,
    start: t,
    duration: 2.6,
    filter: "lowpass",
    freq: 80,
    freqEnd: 700,
    gain: 0.9 * k,
    attack: 1.6,
  });
  tone(e, {
    type: "sine",
    start: t,
    duration: 2.5,
    freq: 40,
    freqEnd: 62,
    gain: 0.7 * k,
    attack: 1.4,
  });
  noise(e, {
    buffer: e.white,
    start: t + 0.6,
    duration: 2,
    filter: "bandpass",
    freq: 1800,
    q: 0.7,
    gain: 0.1 * k,
    attack: 1.2,
    chop: 0.05,
  });
}

function playEndFrozen(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 1.4,
    filter: "highpass",
    freq: 3000,
    gain: 0.18 * k,
    attack: 0.4,
    chop: 0.03,
  });
  tinkles(e, t + 0.2, 8, 0.16 * k);
  // The shatter itself, thinner and brighter than the rocky one.
  const crack = t + 1.4;
  noise(e, {
    buffer: e.white,
    start: crack,
    duration: 0.9,
    filter: "highpass",
    freq: 1800,
    gain: 0.4 * k,
    chop: 0.04,
  });
  noise(e, {
    buffer: e.brown,
    start: crack,
    duration: 0.9,
    filter: "lowpass",
    freq: 900,
    freqEnd: 100,
    gain: 0.5 * k,
  });
  tinkles(e, crack, 10, 0.14 * k);
}

function playEndSwallowed(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 2.8,
    filter: "bandpass",
    freq: 2200,
    freqEnd: 70,
    q: 1.1,
    gain: 0.4 * k,
    attack: 0.3,
  });
  tone(e, {
    type: "sawtooth",
    start: t,
    duration: 2.8,
    freq: 640,
    freqEnd: 38,
    gain: 0.12 * k,
    filter: { type: "lowpass", freq: 1400, freqEnd: 120, q: 2 },
  });
  tone(e, {
    type: "sine",
    start: t + 0.4,
    duration: 2.4,
    freq: 90,
    freqEnd: 28,
    gain: 0.6 * k,
    attack: 0.5,
  });
}

function playUnlock(e: VoiceEngine, t: number, k: number) {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(e, {
      type: "triangle",
      start: t + i * 0.09,
      duration: 0.35,
      freq: f,
      gain: 0.22 * k,
      attack: 0.005,
    });
  });
}

function playUiTap(e: VoiceEngine, t: number, k: number) {
  tone(e, {
    type: "triangle",
    start: t,
    duration: 0.08,
    freq: 620,
    freqEnd: 880,
    gain: 0.14 * k,
    attack: 0.003,
  });
}

function playNewPlanet(e: VoiceEngine, t: number, k: number) {
  [330, 495, 660, 990].forEach((f, i) => {
    tone(e, {
      type: "triangle",
      start: t + i * 0.08,
      duration: 0.4,
      freq: f,
      gain: 0.2 * k,
      attack: 0.005,
    });
  });
  tinkles(e, t + 0.15, 5, 0.12 * k);
}

/* ------------------------------------------------------------------ */
/* The alien laser's hum: a saw with vibrato, looping while held        */
/* ------------------------------------------------------------------ */

const ZAP_SAFETY_MS = 15000;

function startZap(e: Engine) {
  if (zap) return;
  const { ctx, bus } = e;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 190;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 9;
  const depth = ctx.createGain();
  depth.gain.value = 22;
  lfo.connect(depth).connect(osc.frequency);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1300;
  filter.Q.value = 3;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
  osc.connect(filter).connect(gain).connect(bus);
  osc.start(now);
  lfo.start(now);
  let ended = false;
  const timer = setTimeout(() => stopZap(), ZAP_SAFETY_MS);
  zap = {
    stop() {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.stop(t + 0.15);
      lfo.stop(t + 0.15);
      osc.onended = () => {
        for (const n of [osc, lfo, depth, filter, gain]) n.disconnect();
      };
    },
  };
}

function stopZap() {
  const z = zap;
  zap = null;
  z?.stop();
}
