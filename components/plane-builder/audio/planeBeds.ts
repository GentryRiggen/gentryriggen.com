import { loopingNoise, type VoiceEngine } from "../../game-audio/primitives";

/**
 * The held sounds of a flight: the engine (pitch and brightness follow burn
 * and speed, boost opens it up) and the wind rush (follows speed, so even a
 * glider has a voice).
 */

export interface FlightSound {
  /** Engine burn, 0 (silent: no fuel or no engine) to 1 (boost). */
  engine: number;
  /** Speed as a share of a fast flight, 0 to 1. */
  speed: number;
  boosting: boolean;
  /** Stall warning urgency, 0 (none) to 1 (about to stall). */
  stall: number;
}

export const SILENT_FLIGHT: FlightSound = {
  engine: 0,
  speed: 0,
  boosting: false,
  stall: 0,
};

export interface FlightBeds {
  update: (sound: FlightSound) => void;
  /** Cuts the beds at once (the context is about to be suspended). */
  silence: () => void;
  dispose: () => void;
}

const ENGINE_GAIN = 0.1;
const WIND_GAIN = 0.17;
const ENGINE_BASE_HZ = 52;
const MIN_STEP = 0.02;

export function buildFlightBeds(
  engine: VoiceEngine,
  isCalm: boolean
): FlightBeds {
  const { ctx, bus } = engine;
  const nodes: AudioNode[] = [];

  // Engine: two slightly detuned saws and a sub, over a brown-noise rush.
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  const flutter = ctx.createGain();
  flutter.gain.value = 1;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 400;
  engineFilter.connect(flutter).connect(engineGain).connect(bus);
  nodes.push(engineGain, flutter, engineFilter);

  const voices = [
    { type: "sawtooth" as const, ratio: 1, detune: -7, level: 0.6 },
    { type: "sawtooth" as const, ratio: 1, detune: 7, level: 0.6 },
    { type: "sine" as const, ratio: 0.5, detune: 0, level: 0.8 },
  ].map(({ type, ratio, detune, level }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.value = ENGINE_BASE_HZ * ratio;
    const mix = ctx.createGain();
    mix.gain.value = level;
    osc.connect(mix).connect(engineFilter);
    osc.start();
    nodes.push(osc, mix);
    return { osc, ratio };
  });

  const rush = loopingNoise(ctx, engine.brown);
  const rushMix = ctx.createGain();
  rushMix.gain.value = 0.5;
  rush.connect(rushMix).connect(engineFilter);
  nodes.push(rush, rushMix);

  // A slow propeller flutter on the engine's loudness (skipped when the
  // player asked for less motion).
  let flutterRate: AudioParam | null = null;
  if (!isCalm) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12;
    const depth = ctx.createGain();
    depth.gain.value = 0.16;
    lfo.connect(depth).connect(flutter.gain);
    lfo.start();
    nodes.push(lfo, depth);
    flutterRate = lfo.frequency;
  }

  // Wind: bandpassed white noise that rises and brightens with speed.
  const windSource = loopingNoise(ctx, engine.white);
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 400;
  windFilter.Q.value = 0.7;
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  windSource.connect(windFilter).connect(windGain).connect(bus);
  nodes.push(windSource, windFilter, windGain);

  let applied: FlightSound | null = null;

  function changed(next: number, previous: number | undefined) {
    return previous === undefined || Math.abs(next - previous) >= MIN_STEP;
  }

  function update(sound: FlightSound) {
    const t = ctx.currentTime;
    const engineChanged =
      changed(sound.engine, applied?.engine) ||
      changed(sound.speed, applied?.speed) ||
      sound.boosting !== applied?.boosting;
    if (engineChanged) {
      const level = sound.engine;
      const open = sound.boosting ? 1.3 : 1;
      engineGain.gain.setTargetAtTime(ENGINE_GAIN * level, t, 0.1);
      const pitch = ENGINE_BASE_HZ + 62 * level + 28 * sound.speed;
      for (const { osc, ratio } of voices) {
        osc.frequency.setTargetAtTime(pitch * ratio, t, 0.12);
      }
      engineFilter.frequency.setTargetAtTime(
        (240 + 1000 * level + 600 * sound.speed) * open,
        t,
        0.1
      );
      flutterRate?.setTargetAtTime(10 + 12 * level, t, 0.2);
    }
    if (changed(sound.speed, applied?.speed)) {
      windGain.gain.setTargetAtTime(WIND_GAIN * sound.speed ** 1.6, t, 0.15);
      windFilter.frequency.setTargetAtTime(350 + 2400 * sound.speed, t, 0.15);
    }
    applied = { ...sound };
  }

  function silence() {
    const t = ctx.currentTime;
    // A suspended context would not run a fade, so cut the beds first.
    for (const gain of [engineGain, windGain]) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0, t);
    }
    applied = null;
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
