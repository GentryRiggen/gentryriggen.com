import {
  loopingNoise,
  type VoiceEngine,
} from "@/components/game-audio/primitives";
import type { BedState } from "./cues";

/** Each bed's loudest level, each under 0.2; the output stays under 0.3
 *  with the loudest cues on top (see the gain tests). */
export const BED_LEVEL = {
  sea: 0.05,
  hum: 0.03,
  night: 0.01,
  steam: 0.06,
  rumble: 0.08,
  engines: 0.04,
  wind: 0.05,
  wash: 0.03,
} as const;
/** Steam is ducked from this speed up so it never drowns the rest. */
export const STEAM_DUCK_SPEED = 10;
export const STEAM_DUCKED = 0.35;

/** Target level of each bed for a state (pure, so it is testable). */
export function bedTargets(s: BedState, on: boolean) {
  if (!on)
    return {
      sea: 0,
      hum: 0,
      night: 0,
      steam: 0,
      rumble: 0,
      engines: 0,
      wind: 0,
      wash: 0,
    };
  const above = s.underwater ? 0 : 1;
  // The Lusitania's afternoon: engines turning (fading with her steam)
  // instead of the Titanic's hum and cold night tone.
  const storm = s.ship === "fitzgerald";
  // The Britannic's morning is a day bed too: engines turning, a calm sea.
  const morning = s.ship === "britannic";
  const day = s.ship === "lusitania" || storm || morning;
  // The Britannic's engines follow her way (off at the stop, back as she
  // gets under way again), still gated by her power.
  const p2 = s.power * s.power * (morning ? (s.way ?? 1) : 1);
  const wind = storm ? (s.wind ?? 0) : 0;
  return {
    // The storm's breaking seas are a little louder than a calm sea.
    sea: BED_LEVEL.sea * above * (1 + 0.2 * wind),
    hum: day ? 0 : BED_LEVEL.hum * above * p2,
    night: day ? 0 : BED_LEVEL.night,
    // Her engines are a lower thrum, a little under the liners'.
    engines: day
      ? BED_LEVEL.engines * above * p2 * (storm ? 0.75 : morning ? 0.85 : 1)
      : 0,
    // The wind howls with the sea; the deck washes as she lays over.
    wind: BED_LEVEL.wind * above * wind,
    wash: BED_LEVEL.wash * above * wind * (0.4 + 0.6 * s.strain),
    steam:
      BED_LEVEL.steam *
      (s.steam ? 1 : 0) *
      above *
      (s.speed > STEAM_DUCK_SPEED ? STEAM_DUCKED : 1),
    rumble: BED_LEVEL.rumble * (s.underwater ? 1 : 0),
  };
}

export interface Beds {
  apply(s: BedState, on: boolean): void;
  dispose(): void;
}

/** The held sounds: built once per engine, only their gains move. */
export function createBeds(engine: VoiceEngine): Beds {
  const { ctx, bus } = engine;
  const nodes: AudioNode[] = [];
  const stoppers: AudioScheduledSourceNode[] = [];

  function level(): GainNode {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(bus);
    nodes.push(g);
    return g;
  }
  function filtered(
    src: AudioNode,
    type: BiquadFilterType,
    freq: number,
    q: number,
    out: GainNode
  ) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(out);
    nodes.push(src, f);
  }

  // Calm sea: brown noise that swells slowly, like lapping.
  const sea = level();
  const seaSwell = ctx.createGain();
  seaSwell.gain.value = 0.6;
  seaSwell.connect(sea);
  nodes.push(seaSwell);
  const seaSrc = loopingNoise(ctx, engine.brown);
  filtered(seaSrc, "lowpass", 420, 0.7, seaSwell);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.4;
  lfo.connect(lfoDepth).connect(seaSwell.gain);
  nodes.push(lfo, lfoDepth);
  lfo.start();
  stoppers.push(seaSrc, lfo);

  // The machinery's hum: two low sines a little apart.
  const hum = level();
  for (const freq of [48, 96.6]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(hum);
    osc.start();
    nodes.push(osc);
    stoppers.push(osc);
  }

  // A cold, quiet night tone.
  const night = level();
  for (const freq of [174.6, 175.4]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(night);
    osc.start();
    nodes.push(osc);
    stoppers.push(osc);
  }

  // Steam roar.
  const steam = level();
  const steamSrc = loopingNoise(ctx, engine.white);
  filtered(steamSrc, "bandpass", 1100, 0.5, steam);
  stoppers.push(steamSrc);

  // Her engines (afternoon): a low throb, a slow beat of turning screws.
  const engines = level();
  const engSwell = ctx.createGain();
  engSwell.gain.value = 0.7;
  engSwell.connect(engines);
  nodes.push(engSwell);
  const engFilter = ctx.createBiquadFilter();
  engFilter.type = "lowpass";
  engFilter.frequency.value = 160;
  engFilter.connect(engSwell);
  nodes.push(engFilter);
  for (const freq of [38, 57.4]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.connect(engFilter);
    osc.start();
    nodes.push(osc);
    stoppers.push(osc);
  }
  const beat = ctx.createOscillator();
  beat.frequency.value = 1.9;
  const beatDepth = ctx.createGain();
  beatDepth.gain.value = 0.3;
  beat.connect(beatDepth).connect(engSwell.gain);
  beat.start();
  nodes.push(beat, beatDepth);
  stoppers.push(beat);

  // The storm's wind: a howl whose pitch climbs with its strength.
  const wind = level();
  const windSrc = loopingNoise(ctx, engine.white);
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 400;
  windFilter.Q.value = 1.4;
  const windGust = ctx.createGain();
  windGust.gain.value = 0.75;
  windSrc.connect(windFilter).connect(windGust).connect(wind);
  nodes.push(windSrc, windFilter, windGust);
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.17;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 0.25;
  gust.connect(gustDepth).connect(windGust.gain);
  gust.start();
  nodes.push(gust, gustDepth);
  stoppers.push(windSrc, gust);

  // Water washing along her deck: a slow swell of mid noise.
  const wash = level();
  const washSwell = ctx.createGain();
  washSwell.gain.value = 0.6;
  washSwell.connect(wash);
  nodes.push(washSwell);
  const washSrc = loopingNoise(ctx, engine.brown);
  filtered(washSrc, "lowpass", 700, 0.6, washSwell);
  const washLfo = ctx.createOscillator();
  washLfo.frequency.value = 0.22;
  const washDepth = ctx.createGain();
  washDepth.gain.value = 0.4;
  washLfo.connect(washDepth).connect(washSwell.gain);
  washLfo.start();
  nodes.push(washLfo, washDepth);
  stoppers.push(washSrc, washLfo);

  // Under water: a muffled low rumble.
  const rumble = level();
  const rumbleSrc = loopingNoise(ctx, engine.brown);
  filtered(rumbleSrc, "lowpass", 110, 0.9, rumble);
  stoppers.push(rumbleSrc);

  const gains = { sea, hum, night, steam, rumble, engines, wind, wash };
  let last = "";

  return {
    apply(s, on) {
      const t = bedTargets(s, on);
      // Only touch the graph when a level moved enough to matter.
      const key = `${t.sea.toFixed(3)}|${t.hum.toFixed(3)}|${t.steam.toFixed(3)}|${t.rumble.toFixed(3)}|${t.night.toFixed(3)}|${t.engines.toFixed(3)}|${t.wind.toFixed(3)}|${t.wash.toFixed(3)}`;
      if (key === last) return;
      last = key;
      const now = ctx.currentTime;
      gains.sea.gain.setTargetAtTime(t.sea, now, 0.8);
      gains.hum.gain.setTargetAtTime(t.hum, now, 0.6);
      gains.night.gain.setTargetAtTime(t.night, now, 1);
      gains.steam.gain.setTargetAtTime(t.steam, now, 0.5);
      gains.rumble.gain.setTargetAtTime(t.rumble, now, 1);
      gains.engines.gain.setTargetAtTime(t.engines, now, 0.6);
      gains.wind.gain.setTargetAtTime(t.wind, now, 0.8);
      gains.wash.gain.setTargetAtTime(t.wash, now, 0.8);
      // The howl climbs in pitch as the wind rises.
      windFilter.frequency.setTargetAtTime(350 + 650 * (s.wind ?? 0), now, 0.8);
    },
    dispose() {
      for (const src of stoppers) {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const n of nodes) n.disconnect();
    },
  };
}
