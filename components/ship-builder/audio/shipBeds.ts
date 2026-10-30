import { loopingNoise, type VoiceEngine } from "../../game-audio/primitives";

/**
 * The held sounds of the world around the ship: a wash of waves, wind, the
 * engine's thrum, the bow wave and the water rushing in as she sinks. Two
 * shared noise sources feed every bed, so the whole set is cheap to run.
 */

export interface BedLevels {
  /** Waves washing against the hull, 0 to 1. */
  wash: number;
  /** Wind in the rigging, 0 to 1. */
  wind: number;
  /** Engine thrum, 0 (off) to 1 (flat out). */
  thrum: number;
  /** Bow wave, 0 (still) to 1 (top speed). */
  bow: number;
  /** Water rushing into the hull, 0 to 1 and rising. */
  rush: number;
}

export const SILENT_BEDS: BedLevels = {
  wash: 0,
  wind: 0,
  thrum: 0,
  bow: 0,
  rush: 0,
};

export interface ShipBeds {
  update: (levels: BedLevels) => void;
  /** Cuts every bed at once (the context is about to be suspended). */
  silence: () => void;
  dispose: () => void;
}

const WASH_GAIN = 0.18;
const WIND_GAIN = 0.1;
const THRUM_GAIN = 0.14;
const BOW_GAIN = 0.2;
const RUSH_GAIN = 0.4;
/** Smallest level change worth sending to the audio thread. */
const MIN_STEP = 0.01;

export function buildShipBeds(engine: VoiceEngine): ShipBeds {
  const { ctx, bus } = engine;
  const white = loopingNoise(ctx, engine.white);
  const brown = loopingNoise(ctx, engine.brown);
  const nodes: AudioNode[] = [white, brown];

  function bed(gainValue = 0): GainNode {
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    gain.connect(bus);
    nodes.push(gain);
    return gain;
  }

  function filtered(
    source: AudioNode,
    type: BiquadFilterType,
    freq: number,
    q: number
  ): BiquadFilterNode {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    source.connect(filter);
    nodes.push(filter);
    return filter;
  }

  // A slow oscillator that makes a bed breathe, like swells arriving.
  function swell(target: AudioParam, rate: number, depth: number) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    lfo.connect(amount).connect(target);
    lfo.start();
    nodes.push(lfo, amount);
    return lfo;
  }

  const washGain = bed();
  const washSwell = ctx.createGain();
  washSwell.gain.value = 0.7;
  nodes.push(washSwell);
  filtered(brown, "lowpass", 600, 0.7).connect(washSwell).connect(washGain);
  const washLfo = swell(washSwell.gain, 0.12, 0.3);

  const windGain = bed();
  const windGusts = ctx.createGain();
  windGusts.gain.value = 0.65;
  nodes.push(windGusts);
  const windFilter = filtered(white, "bandpass", 520, 0.9);
  windFilter.connect(windGusts).connect(windGain);
  swell(windGusts.gain, 0.07, 0.35);

  const thrumGain = bed();
  const thrumFilter = ctx.createBiquadFilter();
  thrumFilter.type = "lowpass";
  thrumFilter.frequency.value = 220;
  thrumFilter.connect(thrumGain);
  nodes.push(thrumFilter);
  const thrumOscillators = [
    { type: "sine" as const, ratio: 1, level: 1 },
    { type: "sawtooth" as const, ratio: 2, level: 0.35 },
    { type: "triangle" as const, ratio: 1.5, level: 0.4 },
  ].map(({ type, ratio, level }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = 40 * ratio;
    const mix = ctx.createGain();
    mix.gain.value = level;
    osc.connect(mix).connect(thrumFilter);
    osc.start();
    nodes.push(osc, mix);
    return { osc, ratio };
  });

  const bowGain = bed();
  const bowFilter = filtered(white, "bandpass", 700, 0.8);
  bowFilter.connect(bowGain);

  const rushGain = bed();
  const rushFilter = filtered(white, "bandpass", 500, 0.5);
  rushFilter.connect(rushGain);

  // What the audio thread was last told. Reused, so an update allocates nothing.
  const applied: BedLevels = { ...SILENT_BEDS };
  let hasApplied = false;

  function changed(next: number, previous: number | undefined) {
    return (
      !hasApplied ||
      previous === undefined ||
      Math.abs(next - previous) >= MIN_STEP
    );
  }

  function update(levels: BedLevels) {
    const t = ctx.currentTime;
    if (changed(levels.wash, applied.wash)) {
      washGain.gain.setTargetAtTime(WASH_GAIN * levels.wash, t, 0.5);
      washLfo.frequency.setTargetAtTime(0.1 + 0.25 * levels.wash, t, 1);
    }
    if (changed(levels.wind, applied.wind)) {
      windGain.gain.setTargetAtTime(WIND_GAIN * levels.wind, t, 0.6);
      windFilter.frequency.setTargetAtTime(380 + 900 * levels.wind, t, 0.6);
    }
    if (changed(levels.thrum, applied.thrum)) {
      thrumGain.gain.setTargetAtTime(
        levels.thrum > 0 ? THRUM_GAIN * (0.3 + 0.7 * levels.thrum) : 0,
        t,
        0.25
      );
      for (const { osc, ratio } of thrumOscillators) {
        osc.frequency.setTargetAtTime((38 + 26 * levels.thrum) * ratio, t, 0.3);
      }
      thrumFilter.frequency.setTargetAtTime(160 + 260 * levels.thrum, t, 0.3);
    }
    if (changed(levels.bow, applied.bow)) {
      bowGain.gain.setTargetAtTime(BOW_GAIN * levels.bow ** 1.3, t, 0.3);
      bowFilter.frequency.setTargetAtTime(500 + 1300 * levels.bow, t, 0.3);
    }
    if (changed(levels.rush, applied.rush)) {
      rushGain.gain.setTargetAtTime(RUSH_GAIN * levels.rush ** 1.5, t, 0.5);
      rushFilter.frequency.setTargetAtTime(300 + 1100 * levels.rush, t, 0.5);
    }
    applied.wash = levels.wash;
    applied.wind = levels.wind;
    applied.thrum = levels.thrum;
    applied.bow = levels.bow;
    applied.rush = levels.rush;
    hasApplied = true;
  }

  function silence() {
    const t = ctx.currentTime;
    // A suspended context would not run a fade, so cut the beds first.
    for (const gain of [washGain, windGain, thrumGain, bowGain, rushGain]) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0, t);
    }
    hasApplied = false;
  }

  function dispose() {
    for (const node of nodes) {
      if ("stop" in node) {
        try {
          (node as AudioScheduledSourceNode).stop();
        } catch {
          // Already stopped.
        }
      }
      node.disconnect();
    }
  }

  return { update, silence, dispose };
}
