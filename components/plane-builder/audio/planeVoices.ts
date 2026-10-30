import { noise, tone, type VoiceEngine } from "../../game-audio/primitives";

/**
 * One-shot voices added in the sound pass: the boost whoosh, near miss,
 * a ghost passing, the stall warning and the daily-challenge sting.
 */

/** Boost: air rushing up in pitch under a short engine surge. */
export function playBoost(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.6,
    filter: "bandpass",
    freq: 300,
    freqEnd: 2600,
    q: 1.1,
    gain: 0.26,
    attack: 0.14,
  });
  tone(engine, {
    type: "sawtooth",
    start: now,
    duration: 0.5,
    freq: 80,
    freqEnd: 200,
    gain: 0.08,
    attack: 0.08,
    filter: { type: "lowpass", freq: 700, q: 0.8 },
  });
}

/** A close shave past an obstacle: a quick high swish. */
export function playNearMiss(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.24,
    filter: "bandpass",
    freq: 2300,
    freqEnd: 600,
    q: 1.3,
    gain: 0.22,
    attack: 0.03,
  });
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.14,
    freq: 1250,
    freqEnd: 720,
    gain: 0.06,
    attack: 0.005,
  });
}

/** The ghost passing: a soft, falling whoosh like a plane sliding by. */
export function playGhostPass(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.6,
    filter: "bandpass",
    freq: 1500,
    freqEnd: 450,
    q: 3,
    gain: 0.15,
    attack: 0.18,
  });
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.55,
    freq: 540,
    freqEnd: 380,
    gain: 0.05,
    attack: 0.15,
  });
}

/** The stall warning: a gentle two-note beep that gets keener as time runs out. */
export function playStallBeep(engine: VoiceEngine, urgency: number) {
  const now = engine.ctx.currentTime;
  const gain = 0.07 + 0.06 * Math.min(1, Math.max(0, urgency));
  tone(engine, {
    type: "triangle",
    start: now,
    duration: 0.11,
    freq: 820,
    gain,
    attack: 0.006,
  });
  tone(engine, {
    type: "triangle",
    start: now + 0.13,
    duration: 0.13,
    freq: 620,
    gain,
    attack: 0.006,
  });
}

const DAILY_NOTES = [523.25, 659.25, 783.99, 1046.5] as const;

/** The daily-challenge result sting: a bright rising run into a ringing chord. */
export function playDailySting(engine: VoiceEngine) {
  const now = engine.ctx.currentTime;
  DAILY_NOTES.forEach((freq, i) => {
    tone(engine, {
      type: "triangle",
      start: now + i * 0.1,
      duration: 0.24,
      freq,
      gain: 0.15,
      attack: 0.006,
    });
  });
  const chordAt = now + DAILY_NOTES.length * 0.1;
  for (const freq of [523.25, 659.25, 783.99, 1046.5]) {
    tone(engine, {
      type: "sine",
      start: chordAt,
      duration: 1.3,
      freq,
      gain: 0.09,
      attack: 0.04,
    });
  }
  tone(engine, {
    type: "sine",
    start: chordAt + 0.05,
    duration: 1.1,
    freq: 2093,
    gain: 0.04,
    attack: 0.003,
  });
}
