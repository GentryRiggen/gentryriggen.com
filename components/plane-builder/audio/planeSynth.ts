/**
 * Every sound here is synthesized with the Web Audio API (no audio files).
 * Each one-shot builds a small graph of oscillators and noise that
 * disconnects itself when it ends. Nothing touches the AudioContext until
 * `enable()`, which must run inside a click or key press.
 */

export type PlaneCue =
  | "launch"
  | "coin"
  | "ring"
  | "bump"
  | "shield"
  | "crash"
  | "land"
  | "cheer"
  | "buy";

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
}

const NOISE_SECONDS = 2;
const MASTER_LEVEL = 0.7;
const ENGINE_GAIN = 0.1;
const ENGINE_BASE_HZ = 55;
const ENGINE_SPAN_HZ = 75;
/** Smallest engine change worth sending to the audio thread. */
const MIN_ENGINE_STEP = 0.02;

interface Engine {
  ctx: AudioContext;
  bus: GainNode;
  white: AudioBuffer;
  brown: AudioBuffer;
}

interface Hum {
  gain: GainNode;
  osc: OscillatorNode;
  filter: BiquadFilterNode;
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
  bus.gain.value = MASTER_LEVEL;
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

const CUES: Record<PlaneCue, (engine: Engine) => void> = {
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

/** A held sawtooth plus noise whose pitch and loudness follow the level. */
function buildHum(engine: Engine): Hum {
  const { ctx, bus } = engine;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = ENGINE_BASE_HZ;
  const rush = ctx.createBufferSource();
  rush.buffer = engine.brown;
  rush.loop = true;
  const rushGain = ctx.createGain();
  rushGain.gain.value = 0.6;
  osc.connect(filter);
  rush.connect(rushGain).connect(filter);
  filter.connect(gain).connect(bus);
  osc.start();
  rush.start();
  return { gain, osc, filter };
}

export function createPlaneSynth(): PlaneSynth {
  let engine: Engine | null = null;
  let hum: Hum | null = null;
  let isOn = false;
  // What the audio thread was last told, so a steady frame sends nothing.
  let appliedLevel: number | null = null;

  function enable(): boolean {
    const Ctor = audioContextConstructor();
    if (!Ctor) return false;
    try {
      if (!engine) {
        engine = buildEngine(Ctor);
        hum = buildHum(engine);
      }
      void engine.ctx.resume();
    } catch {
      engine = null;
      hum = null;
      appliedLevel = null;
      return false;
    }
    isOn = true;
    return true;
  }

  function silenceHum() {
    appliedLevel = null;
    if (!engine || !hum) return;
    // A suspended context would not run a fade, so cut the hum first.
    const t = engine.ctx.currentTime;
    hum.gain.gain.cancelScheduledValues(t);
    hum.gain.gain.setValueAtTime(0, t);
  }

  function disable() {
    isOn = false;
    silenceHum();
    if (engine) void engine.ctx.suspend();
  }

  function pause() {
    silenceHum();
    if (engine) void engine.ctx.suspend();
  }

  function resume() {
    if (isOn && engine) void engine.ctx.resume();
  }

  function play(cue: PlaneCue) {
    if (!isOn || !engine) return;
    CUES[cue](engine);
  }

  function setEngine(next: number) {
    if (!isOn || !engine || !hum) return;
    const level = Math.min(1, Math.max(0, next));
    if (
      appliedLevel !== null &&
      Math.abs(level - appliedLevel) < MIN_ENGINE_STEP
    ) {
      return;
    }
    appliedLevel = level;
    const t = engine.ctx.currentTime;
    hum.gain.gain.setTargetAtTime(ENGINE_GAIN * level, t, 0.1);
    hum.osc.frequency.setTargetAtTime(
      ENGINE_BASE_HZ + ENGINE_SPAN_HZ * level,
      t,
      0.1
    );
    hum.filter.frequency.setTargetAtTime(250 + 1100 * level, t, 0.1);
  }

  return {
    enable,
    disable,
    isEnabled: () => isOn,
    pause,
    resume,
    play,
    setEngine,
  };
}

/** The one synth that the toggle, the cues and the flight share. */
export const planeSynth: PlaneSynth = createPlaneSynth();
