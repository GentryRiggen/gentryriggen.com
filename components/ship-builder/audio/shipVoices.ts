import { noise, tone, type VoiceEngine } from "../../game-audio/primitives";

/**
 * Short one-shot sounds for building, sailing and the trial's endings. Peaks
 * stay modest: the loud, dramatic voices live in `synth.ts`.
 */

/** A part clicks into place: a soft wooden tock. */
export function playPlace(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.1,
    freq: 360,
    freqEnd: 190,
    gain: 0.34,
    attack: 0.003,
  });
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.04,
    filter: "bandpass",
    freq: 1400,
    q: 1.5,
    gain: 0.12,
    attack: 0.001,
  });
}

/** A part comes off: a lower, hollower pop with a short scrape. */
export function playRemove(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.16,
    freq: 220,
    freqEnd: 80,
    gain: 0.4,
    attack: 0.004,
  });
  noise(engine, {
    buffer: engine.brown,
    start: now,
    duration: 0.14,
    filter: "lowpass",
    freq: 700,
    freqEnd: 200,
    gain: 0.3,
    attack: 0.005,
  });
}

/** A brush of paint: a soft wet swish and a small bright blip. */
export function playPaint(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.18,
    filter: "bandpass",
    freq: 2200,
    freqEnd: 900,
    q: 1.2,
    gain: 0.14,
    attack: 0.04,
  });
  tone(engine, {
    type: "sine",
    start: now + 0.02,
    duration: 0.1,
    freq: 700,
    freqEnd: 920,
    gain: 0.08,
    attack: 0.005,
  });
}

/** Undo sweeps down, redo sweeps up: a short airy whoosh. */
export function playWhoosh(engine: VoiceEngine, isRedo: boolean) {
  const now = engine.ctx.currentTime;
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.24,
    filter: "bandpass",
    freq: isRedo ? 500 : 1800,
    freqEnd: isRedo ? 1800 : 500,
    q: 1.4,
    gain: 0.2,
    attack: 0.05,
  });
}

/** A ship's horn: two low, slightly sour notes blown for just over a second. */
export function playHorn(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  for (const [freq, detune] of [
    [98, -6],
    [123.5, 5],
    [196, 0],
  ] as const) {
    tone(engine, {
      type: "sawtooth",
      start: now,
      duration: 1.25,
      freq,
      detune,
      gain: freq > 150 ? 0.05 : 0.11,
      attack: 0.09,
      filter: { type: "lowpass", freq: 520, freqEnd: 380, q: 1.2 },
    });
  }
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 1.1,
    filter: "bandpass",
    freq: 600,
    q: 3,
    gain: 0.03,
    attack: 0.08,
  });
}

/** A buoy's bell: a bright strike with two inharmonic partials ringing out. */
export function playBell(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  for (const [delay, level] of [
    [0, 1],
    [0.42, 0.45],
  ] as const) {
    for (const [ratio, decay, gain] of [
      [1, 1.7, 0.2],
      [1.5, 1.1, 0.1],
      [2.51, 0.6, 0.06],
    ] as const) {
      tone(engine, {
        type: "sine",
        start: now + delay,
        duration: decay,
        freq: 760 * ratio,
        gain: gain * level,
        attack: 0.002,
      });
    }
  }
}

/** Seconds a snapped funnel takes to topple down onto the water. */
const FUNNEL_TOPPLE_S = 1.0;

/**
 * A funnel snaps (a sharp crack), topples, then strikes the water or the
 * deck: a clang over a thud.
 */
export function playFunnelCrash(engine: VoiceEngine) {
  const snap = engine.ctx.currentTime;
  noise(engine, {
    buffer: engine.white,
    start: snap,
    duration: 0.12,
    filter: "highpass",
    freq: 2200,
    gain: 0.3,
    attack: 0.002,
  });
  const now = snap + FUNNEL_TOPPLE_S;
  for (const [freq, decay, gain] of [
    [182, 1.0, 0.22],
    [267, 0.8, 0.16],
    [431, 0.55, 0.1],
  ] as const) {
    tone(engine, {
      type: "triangle",
      start: now,
      duration: decay,
      freq,
      freqEnd: freq * 0.96,
      gain,
      attack: 0.003,
    });
  }
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.25,
    filter: "highpass",
    freq: 1800,
    freqEnd: 800,
    gain: 0.35,
    attack: 0.002,
  });
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.5,
    freq: 80,
    freqEnd: 30,
    gain: 0.6,
    attack: 0.005,
  });
  noise(engine, {
    buffer: engine.brown,
    start: now + 0.05,
    duration: 0.8,
    filter: "lowpass",
    freq: 500,
    freqEnd: 120,
    gain: 0.5,
    attack: 0.03,
  });
}

export type StingKind = "survived" | "sank";

const SURVIVED_NOTES = [293.66, 369.99, 440, 587.33] as const;
const SANK_NOTES = [293.66, 261.63, 220, 174.61] as const;

/**
 * The trial's result sting. Survived is a brief rising D major run that ends
 * on a held chord; sank is a slow fall into a low, quiet minor.
 */
export function playSting(engine: VoiceEngine, kind: StingKind) {
  const now = engine.ctx.currentTime;
  if (kind === "survived") {
    SURVIVED_NOTES.forEach((freq, i) => {
      tone(engine, {
        type: "triangle",
        start: now + i * 0.13,
        duration: i === SURVIVED_NOTES.length - 1 ? 1.6 : 0.3,
        freq,
        gain: 0.16,
        attack: 0.01,
      });
    });
    for (const freq of [293.66, 369.99, 440]) {
      tone(engine, {
        type: "sine",
        start: now + 0.52,
        duration: 1.6,
        freq,
        gain: 0.09,
        attack: 0.1,
      });
    }
    return;
  }
  SANK_NOTES.forEach((freq, i) => {
    tone(engine, {
      type: "triangle",
      start: now + i * 0.42,
      duration: 0.9,
      freq,
      gain: 0.13,
      attack: 0.02,
    });
  });
  tone(engine, {
    type: "sine",
    start: now + 0.3,
    duration: 2.8,
    freq: 73.42,
    freqEnd: 55,
    gain: 0.3,
    attack: 0.5,
  });
}
