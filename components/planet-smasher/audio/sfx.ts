import {
  buildNoise,
  loopingNoise,
  noise,
  tone,
  type VoiceEngine,
} from "@/components/game-audio/primitives";
import { softnessGain } from "@/components/game-audio/channels";
import type { ToolId } from "@/lib/planet-smasher/tools";
import { soundSetting } from "./soundSetting";

export type Cue =
  | "launch"
  | "whistle"
  | "combo"
  | "impactSmall"
  | "impactBig"
  | "nuke"
  | "rumble"
  | "zapStart"
  | "zapStop"
  | "freeze"
  | "moonWhoosh"
  | "blackHoleHum"
  | "ufoWarble"
  | "tractorBeam"
  | "gravityHum"
  | "gooPlop"
  | "mothershipCharge"
  | "endShatter"
  | "endMolten"
  | "endFrozen"
  | "endSwallowed"
  | "endConsumed"
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
  nukeTwin: { launch: "launch", impact: "nuke" },
  nukeRain: { launch: "whistle", impact: "nuke" },
  // The UFO swarm plays its own warble and tractor beam per saucer.
  ufoSwarm: { launch: null, impact: "impactSmall" },
  gravityBeam: { launch: "gravityHum", impact: "impactBig" },
  // The nanobots hold their own goo loop (startGoo and stopGoo) from the effect;
  // each of the 40 ticks is a small plop.
  nanobots: { launch: null, impact: "gooPlop" },
  // The charge whine runs until the beam fires, then the big impact.
  mothership: { launch: "mothershipCharge", impact: "impactBig" },
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
  whistle: { seconds: 1.1, gap: 0.3, play: playWhistle },
  combo: { seconds: 0.5, gap: 0.05, play: playCombo },
  impactSmall: { seconds: 0.4, gap: 0.05, play: playImpactSmall },
  impactBig: { seconds: 1, gap: 0.1, play: playImpactBig },
  nuke: { seconds: 2, gap: 0.15, play: playNuke },
  rumble: { seconds: 1.5, gap: 0.2, play: playRumble },
  freeze: { seconds: 1, gap: 0.2, play: playFreeze },
  moonWhoosh: { seconds: 1, gap: 0.2, play: playMoonWhoosh },
  blackHoleHum: { seconds: 1.7, gap: 0.2, play: playBlackHoleHum },
  ufoWarble: { seconds: 0.4, gap: 0.1, play: playUfoWarble },
  tractorBeam: { seconds: 0.95, gap: 0.1, play: playTractorBeam },
  gravityHum: { seconds: 2, gap: 0.3, play: playGravityHum },
  gooPlop: { seconds: 0.2, gap: 0.08, play: playGooPlop },
  mothershipCharge: {
    seconds: 3.5,
    gap: 0.5,
    play: playMothershipCharge,
    priority: true,
  },
  endShatter: { seconds: 2.6, gap: 0.5, play: playEndShatter, priority: true },
  endMolten: { seconds: 2.8, gap: 0.5, play: playEndMolten, priority: true },
  endFrozen: { seconds: 2.4, gap: 0.5, play: playEndFrozen, priority: true },
  endSwallowed: {
    seconds: 3,
    gap: 0.5,
    play: playEndSwallowed,
    priority: true,
  },
  endConsumed: {
    seconds: 2.8,
    gap: 0.5,
    play: playEndConsumed,
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
let goo: { stop(): void } | null = null;
/** Nanobot effects currently holding the goo loop, each with its own timer. */
const gooHolds = new Map<number, ReturnType<typeof setTimeout>>();
let gooNext = 1;

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
  endGooLoop();
  stopMothershipCharge();
  if (engine) void engine.ctx.suspend();
}

/** Frees the audio (the game left the screen); a new tap starts it again. */
export function closeSfx(): void {
  isOn = false;
  stopZap();
  endGooLoop();
  stopMothershipCharge();
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
  endGooLoop();
  stopMothershipCharge();
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

/** A falling whistle: the nuke rain coming in. */
function playWhistle(e: VoiceEngine, t: number, k: number) {
  tone(e, {
    type: "sine",
    start: t,
    duration: 1,
    freq: 2400,
    freqEnd: 500,
    gain: 0.1 * k,
    attack: 0.05,
  });
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 1,
    filter: "bandpass",
    freq: 3000,
    freqEnd: 700,
    q: 3,
    gain: 0.08 * k,
    attack: 0.1,
  });
}

/** The combo count the next `combo` cue plays (it cannot take a count). */
let comboCount = 3;

/** A short bright ding, a semitone higher for each count from 3 (to x10). */
export function playComboCue(count: number): void {
  comboCount = Math.min(10, Math.max(3, Math.round(count)));
  playCue("combo");
}

function playCombo(e: VoiceEngine, t: number, k: number) {
  const f = 880 * 2 ** ((comboCount - 3) / 12);
  tone(e, {
    type: "triangle",
    start: t,
    duration: 0.3,
    freq: f,
    gain: 0.2 * k,
    attack: 0.003,
  });
  tone(e, {
    type: "sine",
    start: t,
    duration: 0.22,
    freq: f * 2,
    gain: 0.1 * k,
    attack: 0.003,
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

/** A wobbly sine with a fast LFO: one saucer arriving. */
function playUfoWarble(e: VoiceEngine, t: number, k: number) {
  const { ctx, bus } = e;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = rand(520, 760);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rand(13, 18);
  const depth = ctx.createGain();
  depth.gain.value = 110;
  lfo.connect(depth).connect(osc.frequency);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.07 * k, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
  osc.connect(gain).connect(bus);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + 0.4);
  lfo.stop(t + 0.4);
  osc.onended = () => {
    for (const n of [osc, lfo, depth, gain]) n.disconnect();
  };
}

/** A filtered noise swell: one beam switching on. */
function playTractorBeam(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 0.9,
    filter: "bandpass",
    freq: 350,
    freqEnd: 1500,
    q: 2.5,
    gain: 0.16 * k,
    attack: 0.6,
  });
}

/** A low rising saw with a lowpass sweep: the gravity beam charging. */
function playGravityHum(e: VoiceEngine, t: number, k: number) {
  tone(e, {
    type: "sawtooth",
    start: t,
    duration: 1.9,
    freq: 48,
    freqEnd: 150,
    gain: 0.22 * k,
    attack: 0.9,
    filter: { type: "lowpass", freq: 180, freqEnd: 1500, q: 3 },
  });
  tone(e, {
    type: "sine",
    start: t,
    duration: 1.8,
    freq: 70,
    freqEnd: 200,
    gain: 0.25 * k,
    attack: 0.8,
  });
}

/** A tiny wet bubble: one nanobot tick. */
function playGooPlop(e: VoiceEngine, t: number, k: number) {
  const f = rand(260, 520);
  tone(e, {
    type: "sine",
    start: t,
    duration: 0.14,
    freq: f,
    freqEnd: f * 2.2,
    gain: 0.1 * k,
    attack: 0.01,
  });
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 0.08,
    filter: "bandpass",
    freq: 1800,
    q: 4,
    gain: 0.03 * k,
  });
}

/** A rising whine and growl: the mothership powering up its beam. */
/** The charge whine in flight, so the ship can cut it short. */
let charge: { hold: GainNode; ctx: AudioContext } | null = null;

/** Cuts the mothership's charge whine (the ship left before it fired). */
export function stopMothershipCharge(): void {
  const c = charge;
  charge = null;
  if (!c) return;
  try {
    const t = c.ctx.currentTime;
    c.hold.gain.cancelScheduledValues(t);
    c.hold.gain.setValueAtTime(c.hold.gain.value, t);
    c.hold.gain.linearRampToValueAtTime(0, t + 0.1);
    setTimeout(() => c.hold.disconnect(), 300);
  } catch {
    // Already closed.
  }
}

function playMothershipCharge(voice: VoiceEngine, t: number, k: number) {
  // Everything runs through one gain so the whole whine can be cut.
  stopMothershipCharge();
  const hold = voice.ctx.createGain();
  hold.connect(voice.bus);
  charge = { hold, ctx: voice.ctx };
  const e: VoiceEngine = { ...voice, bus: hold };
  tone(e, {
    type: "sawtooth",
    start: t,
    duration: 3.4,
    freq: 40,
    freqEnd: 230,
    gain: 0.22 * k,
    attack: 2.2,
    filter: { type: "lowpass", freq: 120, freqEnd: 2600, q: 4 },
  });
  tone(e, {
    type: "sine",
    start: t + 0.6,
    duration: 2.8,
    freq: 220,
    freqEnd: 2400,
    gain: 0.1 * k,
    attack: 2.2,
  });
  tone(e, {
    type: "triangle",
    start: t,
    duration: 3.4,
    freq: 80,
    freqEnd: 480,
    gain: 0.12 * k,
    attack: 2.4,
  });
  noise(e, {
    buffer: e.white,
    start: t + 1.2,
    duration: 2.2,
    filter: "bandpass",
    freq: 500,
    freqEnd: 5000,
    q: 1.5,
    gain: 0.07 * k,
    attack: 1.8,
  });
}

/** A metallic shimmer, then a deep clang. */
function playEndConsumed(e: VoiceEngine, t: number, k: number) {
  noise(e, {
    buffer: e.white,
    start: t,
    duration: 1.8,
    filter: "bandpass",
    freq: 3000,
    freqEnd: 7000,
    q: 5,
    gain: 0.1 * k,
    attack: 1.2,
    chop: 0.03,
  });
  tinkles(e, t + 0.1, 9, 0.12 * k);
  const clang = t + 1.8;
  for (const [f, g] of [
    [310, 0.3],
    [517, 0.22],
    [803, 0.16],
    [1211, 0.1],
  ] as const) {
    tone(e, {
      type: "sine",
      start: clang,
      duration: 1.1,
      freq: f,
      gain: g * k,
      attack: 0.004,
    });
  }
  tone(e, {
    type: "sine",
    start: clang,
    duration: 1.4,
    freq: 90,
    freqEnd: 48,
    gain: 0.6 * k,
    attack: 0.006,
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

/* ------------------------------------------------------------------ */
/* The nanobots' crawl: bubbly filtered noise, looping while they work  */
/* ------------------------------------------------------------------ */

const GOO_SAFETY_MS = 12000;

/**
 * One nanobot effect takes a hold on the goo loop. Returns its token, or null
 * when sound is off. The loop plays until every hold is released.
 */
export function startGoo(): number | null {
  if (!isOn || !engine || !soundSetting.get()) return null;
  const token = gooNext++;
  gooHolds.set(
    token,
    setTimeout(() => stopGoo(token), GOO_SAFETY_MS)
  );
  if (!goo) beginGooLoop(engine);
  return token;
}

/** Releases one hold; the loop ends with the last. A second release is a no-op. */
export function stopGoo(token: number | null): void {
  if (token === null) return;
  const timer = gooHolds.get(token);
  if (timer === undefined) return;
  clearTimeout(timer);
  gooHolds.delete(token);
  if (gooHolds.size === 0) endGooLoop();
}

function beginGooLoop(e: Engine) {
  const { ctx, bus } = e;
  const now = ctx.currentTime;
  const src = loopingNoise(ctx, e.white);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;
  filter.Q.value = 5;
  // A wobbling filter and a fast flutter in loudness make it bubble.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6;
  const depth = ctx.createGain();
  depth.gain.value = 420;
  lfo.connect(depth).connect(filter.frequency);
  const flutter = ctx.createOscillator();
  flutter.frequency.value = 11;
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.value = 0.03;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
  flutter.connect(flutterDepth).connect(gain.gain);
  src.connect(filter).connect(gain).connect(bus);
  lfo.start(now);
  flutter.start(now);
  let ended = false;
  goo = {
    stop() {
      if (ended) return;
      ended = true;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      for (const o of [src, lfo, flutter]) o.stop(t + 0.25);
      src.onended = () => {
        for (const n of [
          src,
          filter,
          lfo,
          depth,
          flutter,
          flutterDepth,
          gain,
        ]) {
          n.disconnect();
        }
      };
    },
  };
}

function endGooLoop() {
  for (const timer of gooHolds.values()) clearTimeout(timer);
  gooHolds.clear();
  const g = goo;
  goo = null;
  g?.stop();
}
