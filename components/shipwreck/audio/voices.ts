import {
  noise,
  tone,
  type VoiceEngine,
} from "@/components/game-audio/primitives";
import type { Cue } from "./cues";

/**
 * One synthesised voice per cue: filtered noise and low tones. Every voice
 * is short-lived, disconnects itself and peaks at no more than
 * `VOICE_PEAK_MAX`; cues play through a sub-bus at `CUE_BUS_LEVEL`, so even
 * the breakup, plunge, thud and rush over every bed stay under 0.3 at the
 * output (after the kit's 0.8 master). Nothing
 * here imitates a person.
 */
type Voice = (e: VoiceEngine, t: number, level: number) => void;

/** The loudest any one voice of a cue gets. */
export const VOICE_PEAK_MAX = 0.1;
/** The cues' sub-bus level (the beds play at full on the night bus). */
export const CUE_BUS_LEVEL = 0.45;

const VOICES: Record<Cue, Voice> = {
  scrape(e, t, l) {
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 6,
      filter: "bandpass",
      freq: 320,
      freqEnd: 170,
      q: 2,
      gain: 0.09 * l,
      attack: 0.4,
      chop: 0.05,
    });
    noise(e, {
      buffer: e.brown,
      start: t,
      duration: 6,
      filter: "lowpass",
      freq: 140,
      gain: 0.1 * l,
      attack: 0.3,
    });
    tone(e, {
      type: "sawtooth",
      start: t,
      duration: 5,
      freq: 62,
      freqEnd: 44,
      gain: 0.05 * l,
      attack: 0.5,
      filter: { type: "lowpass", freq: 200, q: 1 },
    });
  },
  rocket(e, t, l) {
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 1.4,
      filter: "bandpass",
      freq: 600,
      freqEnd: 3200,
      q: 1.5,
      gain: 0.08 * l,
      attack: 0.15,
    });
    noise(e, {
      buffer: e.white,
      start: t + 1.4,
      duration: 0.25,
      filter: "highpass",
      freq: 1800,
      gain: 0.09 * l,
    });
    tone(e, {
      type: "sine",
      start: t + 1.4,
      duration: 0.2,
      freq: 220,
      freqEnd: 60,
      gain: 0.08 * l,
    });
  },
  davit(e, t, l) {
    for (let k = 0; k < 3; k += 1) {
      tone(e, {
        type: "sawtooth",
        start: t + k * 0.35,
        duration: 0.45,
        freq: 85 + k * 9,
        freqEnd: 105 + k * 9,
        gain: 0.05 * l,
        attack: 0.08,
        filter: { type: "bandpass", freq: 420, q: 8 },
      });
    }
  },
  creak(e, t, l) {
    const dur = 0.9 + l * 0.8;
    tone(e, {
      type: "sawtooth",
      start: t,
      duration: dur,
      freq: 52 + l * 20,
      freqEnd: 70 + l * 40,
      gain: 0.03 + 0.07 * l,
      attack: 0.15,
      filter: { type: "bandpass", freq: 170 + l * 120, q: 10 },
    });
    if (l > 0.5)
      tone(e, {
        type: "sine",
        start: t,
        duration: dur,
        freq: 46,
        freqEnd: 38,
        gain: 0.07 * l,
        attack: 0.2,
      });
  },
  creakFar(e, t, l) {
    tone(e, {
      type: "sawtooth",
      start: t,
      duration: 1.6,
      freq: 48,
      freqEnd: 40,
      gain: 0.05 * l,
      attack: 0.4,
      filter: { type: "bandpass", freq: 110, q: 8 },
    });
  },
  rush(e, t, l) {
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 3,
      filter: "lowpass",
      freq: 500,
      freqEnd: 1800,
      gain: 0.1 * l,
      attack: 0.8,
    });
    noise(e, {
      buffer: e.brown,
      start: t,
      duration: 3,
      filter: "lowpass",
      freq: 220,
      gain: 0.1 * l,
      attack: 0.6,
    });
  },
  funnel(e, t, l) {
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 1.2,
      filter: "bandpass",
      freq: 1200,
      freqEnd: 400,
      q: 1,
      gain: 0.09 * l,
      chop: 0.03,
    });
    tone(e, {
      type: "sine",
      start: t,
      duration: 1,
      freq: 80,
      freqEnd: 35,
      gain: 0.09 * l,
    });
    noise(e, {
      buffer: e.white,
      start: t + 0.7,
      duration: 1.5,
      filter: "highpass",
      freq: 1500,
      freqEnd: 4000,
      gain: 0.08 * l,
      attack: 0.05,
    });
  },
  powerDown(e, t, l) {
    tone(e, {
      type: "sine",
      start: t,
      duration: 0.7,
      freq: 120,
      freqEnd: 38,
      gain: 0.08 * l,
    });
  },
  breakup(e, t, l) {
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 4,
      filter: "bandpass",
      freq: 420,
      freqEnd: 240,
      q: 3,
      gain: 0.09 * l,
      attack: 0.1,
      chop: 0.04,
    });
    noise(e, {
      buffer: e.brown,
      start: t,
      duration: 5,
      filter: "lowpass",
      freq: 150,
      gain: 0.09 * l,
    });
    for (const at of [0, 0.9, 2]) {
      tone(e, {
        type: "sine",
        start: t + at,
        duration: 1.5,
        freq: 62,
        freqEnd: 30,
        gain: 0.09 * l,
      });
    }
  },
  plunge(e, t, l) {
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 5,
      filter: "lowpass",
      freq: 800,
      freqEnd: 2500,
      gain: 0.1 * l,
      attack: 1.5,
    });
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 5,
      filter: "bandpass",
      freq: 500,
      freqEnd: 900,
      q: 4,
      gain: 0.06 * l,
      attack: 0.8,
      chop: 0.08,
    });
    tone(e, {
      type: "sine",
      start: t,
      duration: 5,
      freq: 45,
      gain: 0.08 * l,
      attack: 1,
    });
  },
  // Heard from the water around her: a low, muffled thud, no crack.
  torpedo(e, t, l) {
    tone(e, {
      type: "sine",
      start: t,
      duration: 1.1,
      freq: 58,
      freqEnd: 28,
      gain: 0.1 * l,
      attack: 0.03,
    });
    noise(e, {
      buffer: e.brown,
      start: t,
      duration: 1.6,
      filter: "lowpass",
      freq: 90,
      gain: 0.09 * l,
      attack: 0.02,
    });
  },
  // The second explosion: deeper and longer, then a settling rumble.
  boom(e, t, l) {
    tone(e, {
      type: "sine",
      start: t,
      duration: 2.6,
      freq: 44,
      freqEnd: 22,
      gain: 0.1 * l,
      attack: 0.05,
    });
    noise(e, {
      buffer: e.brown,
      start: t,
      duration: 4.5,
      filter: "lowpass",
      freq: 100,
      freqEnd: 60,
      gain: 0.1 * l,
      attack: 0.06,
    });
    noise(e, {
      buffer: e.white,
      start: t + 0.1,
      duration: 3,
      filter: "lowpass",
      freq: 260,
      freqEnd: 120,
      gain: 0.05 * l,
      attack: 0.2,
      chop: 0.06,
    });
  },
  // A gull, far off: a thin whistle that rises, falls and fades. A bird
  // on the wind, not a voice.
  gull(e, t, l) {
    for (const [k, f] of [
      [0, 1500],
      [0.45, 1750],
    ] as const) {
      tone(e, {
        type: "sine",
        start: t + k,
        duration: 0.5,
        freq: f,
        freqEnd: f * 0.75,
        gain: 0.012 * l,
        attack: 0.12,
        filter: { type: "bandpass", freq: 1700, q: 3 },
      });
    }
  },
  splash(e, t, l) {
    // Going in: a bright rush of water falling to a low churn, and a few
    // drips after.
    noise(e, {
      buffer: e.white,
      start: t,
      duration: 0.7,
      filter: "bandpass",
      freq: 2400,
      freqEnd: 500,
      q: 0.8,
      gain: 0.09 * l,
      attack: 0.01,
    });
    noise(e, {
      buffer: e.brown,
      start: t,
      duration: 1.3,
      filter: "lowpass",
      freq: 420,
      freqEnd: 160,
      gain: 0.08 * l,
      attack: 0.04,
    });
    for (let k = 0; k < 3; k += 1) {
      tone(e, {
        type: "sine",
        start: t + 0.45 + k * 0.22,
        duration: 0.09,
        freq: 900 + k * 260,
        freqEnd: 1500 + k * 300,
        gain: 0.025 * l,
        attack: 0.005,
      });
    }
  },
  thud(e, t, l) {
    tone(e, {
      type: "sine",
      start: t,
      duration: 0.9,
      freq: 70,
      freqEnd: 30,
      gain: 0.1 * l,
    });
    noise(e, {
      buffer: e.brown,
      start: t,
      duration: 1.2,
      filter: "lowpass",
      freq: 120,
      gain: 0.09 * l,
    });
  },
};

export function playCue(engine: VoiceEngine, cue: Cue, level: number) {
  VOICES[cue](engine, engine.ctx.currentTime + 0.02, level);
}
