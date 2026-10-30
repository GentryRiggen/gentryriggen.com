/**
 * Small Web Audio building blocks shared by both games' synths. Every voice
 * is a short graph of oscillators or noise that disconnects itself when it
 * ends, so nothing lingers in the audio graph.
 */

export const NOISE_SECONDS = 3;

/** The part of a synth's engine that a one-shot voice needs. */
export interface VoiceEngine {
  ctx: AudioContext;
  /** Everything audible connects here. */
  bus: GainNode;
  white: AudioBuffer;
  brown: AudioBuffer;
}

export function buildNoise(ctx: AudioContext, isBrown: boolean): AudioBuffer {
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

/** Disconnects every node once `last` ends, so nothing lingers. */
export function disconnectOnEnd(
  last: AudioScheduledSourceNode,
  nodes: AudioNode[]
) {
  last.onended = () => {
    for (const node of nodes) node.disconnect();
  };
}

export interface NoiseOptions {
  buffer: AudioBuffer;
  start: number;
  duration: number;
  filter: BiquadFilterType;
  freq: number;
  /** Where the filter ends up (a sweep), defaults to `freq`. */
  freqEnd?: number;
  q?: number;
  gain: number;
  attack?: number;
  /** Randomly chop the loudness every `chop` seconds (tearing, gurgling). */
  chop?: number;
}

/** A shaped burst of filtered noise. */
export function noise(engine: VoiceEngine, opts: NoiseOptions) {
  const { ctx, bus } = engine;
  const source = ctx.createBufferSource();
  source.buffer = opts.buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter;
  filter.Q.value = opts.q ?? 1;
  filter.frequency.setValueAtTime(opts.freq, opts.start);
  if (opts.freqEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(
      opts.freqEnd,
      opts.start + opts.duration
    );
  }
  const gain = ctx.createGain();
  const attack = opts.attack ?? 0.005;
  const end = opts.start + opts.duration;
  gain.gain.setValueAtTime(0.0001, opts.start);
  gain.gain.linearRampToValueAtTime(opts.gain, opts.start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  if (opts.chop !== undefined) {
    for (let t = opts.start + attack; t < end; t += opts.chop) {
      const fade = 1 - (t - opts.start) / opts.duration;
      gain.gain.setValueAtTime(
        Math.max(0.0001, opts.gain * fade * (0.15 + Math.random() * 0.85)),
        t
      );
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  source.connect(filter).connect(gain).connect(bus);
  source.start(opts.start, Math.random() * (NOISE_SECONDS - 0.1));
  source.stop(end + 0.05);
  disconnectOnEnd(source, [source, filter, gain]);
}

export interface ToneOptions {
  type: OscillatorType;
  start: number;
  duration: number;
  freq: number;
  freqEnd?: number;
  detune?: number;
  gain: number;
  attack?: number;
  /** Optional filter between the oscillator and the gain. */
  filter?: {
    type: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    q: number;
  };
}

/** A shaped tone, optionally bent in pitch and run through a filter. */
export function tone(engine: VoiceEngine, opts: ToneOptions) {
  const { ctx, bus } = engine;
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  osc.detune.value = opts.detune ?? 0;
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
  const nodes: AudioNode[] = [osc, gain];
  let head: AudioNode = osc;
  if (opts.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter.type;
    filter.Q.value = opts.filter.q;
    filter.frequency.setValueAtTime(opts.filter.freq, opts.start);
    if (opts.filter.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(opts.filter.freqEnd, end);
    }
    head.connect(filter);
    head = filter;
    nodes.push(filter);
  }
  head.connect(gain).connect(bus);
  osc.start(opts.start);
  osc.stop(end + 0.05);
  disconnectOnEnd(osc, nodes);
}

/** A looping noise source, started now, for the held beds. */
export function loopingNoise(
  ctx: AudioContext,
  buffer: AudioBuffer
): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(0, Math.random() * (NOISE_SECONDS - 0.1));
  return source;
}
