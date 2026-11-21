import {
  loopingNoise,
  type VoiceEngine,
} from "@/components/game-audio/primitives";
import type { BedState } from "./cues";

/** Each bed's loudest level; together under 0.16 (see the gain test). */
export const BED_LEVEL = {
  sea: 0.05,
  hum: 0.03,
  night: 0.01,
  steam: 0.06,
  rumble: 0.08,
} as const;
/** Steam is ducked from this speed up so it never drowns the rest. */
export const STEAM_DUCK_SPEED = 10;
export const STEAM_DUCKED = 0.35;

/** Target level of each bed for a state (pure, so it is testable). */
export function bedTargets(s: BedState, on: boolean) {
  if (!on) return { sea: 0, hum: 0, night: 0, steam: 0, rumble: 0 };
  const above = s.underwater ? 0 : 1;
  return {
    sea: BED_LEVEL.sea * above,
    hum: BED_LEVEL.hum * above * s.power * s.power,
    night: BED_LEVEL.night,
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

  // Under water: a muffled low rumble.
  const rumble = level();
  const rumbleSrc = loopingNoise(ctx, engine.brown);
  filtered(rumbleSrc, "lowpass", 110, 0.9, rumble);
  stoppers.push(rumbleSrc);

  const gains = { sea, hum, night, steam, rumble };
  let last = "";

  return {
    apply(s, on) {
      const t = bedTargets(s, on);
      // Only touch the graph when a level moved enough to matter.
      const key = `${t.sea.toFixed(3)}|${t.hum.toFixed(3)}|${t.steam.toFixed(3)}|${t.rumble.toFixed(3)}|${t.night.toFixed(3)}`;
      if (key === last) return;
      last = key;
      const now = ctx.currentTime;
      gains.sea.gain.setTargetAtTime(t.sea, now, 0.8);
      gains.hum.gain.setTargetAtTime(t.hum, now, 0.6);
      gains.night.gain.setTargetAtTime(t.night, now, 1);
      gains.steam.gain.setTargetAtTime(t.steam, now, 0.5);
      gains.rumble.gain.setTargetAtTime(t.rumble, now, 1);
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
