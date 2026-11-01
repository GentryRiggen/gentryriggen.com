import { noise, tone, type VoiceEngine } from "../../game-audio/primitives";
import { midiToHz } from "../../game-audio/music";

/**
 * One-shot voices. Each builds a tiny graph that disconnects itself when it
 * ends. `at` is the audio-clock start time.
 */

/** Base note of the tap per phase (MIDI); the combo climbs from here. */
const TAP_BASE_MIDI = [69, 64, 72, 60] as const;

/** Bright coin "ting": a bell-like pair of partials. */
function coinTing(engine: VoiceEngine, at: number, hz: number, level: number) {
  tone(engine, {
    type: "triangle",
    start: at,
    duration: 0.16,
    freq: hz,
    gain: 0.2 * level,
    attack: 0.002,
  });
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.11,
    freq: hz * 2.76,
    gain: 0.07 * level,
    attack: 0.002,
  });
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.3,
    freq: hz * 2,
    gain: 0.06 * level,
    attack: 0.002,
  });
}

/** Electric zap-click: a fast downward square sweep and a tick of noise. */
function zapClick(engine: VoiceEngine, at: number, hz: number, level: number) {
  tone(engine, {
    type: "square",
    start: at,
    duration: 0.07,
    freq: hz * 2,
    freqEnd: hz,
    gain: 0.09 * level,
    attack: 0.001,
    filter: { type: "lowpass", freq: 5000, freqEnd: 1800, q: 2 },
  });
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.14,
    freq: hz,
    gain: 0.12 * level,
    attack: 0.002,
  });
  noise(engine, {
    buffer: engine.white,
    start: at,
    duration: 0.025,
    filter: "highpass",
    freq: 5000,
    gain: 0.05 * level,
    attack: 0.001,
  });
}

/** Shimmering glass: detuned sines with a bright overtone and a long tail. */
function glass(engine: VoiceEngine, at: number, hz: number, level: number) {
  for (const detune of [-7, 7]) {
    tone(engine, {
      type: "sine",
      start: at,
      duration: 0.45,
      freq: hz,
      detune,
      gain: 0.1 * level,
      attack: 0.003,
    });
  }
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.3,
    freq: hz * 3,
    gain: 0.04 * level,
    attack: 0.003,
  });
  tone(engine, {
    type: "sine",
    start: at + 0.04,
    duration: 0.25,
    freq: hz * 2,
    detune: 5,
    gain: 0.04 * level,
    attack: 0.004,
  });
}

/** Soft, warm bell: low partials, slow-ish bloom. */
function warmBell(engine: VoiceEngine, at: number, hz: number, level: number) {
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.6,
    freq: hz,
    gain: 0.14 * level,
    attack: 0.01,
  });
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.35,
    freq: hz * 2,
    gain: 0.05 * level,
    attack: 0.01,
  });
  tone(engine, {
    type: "triangle",
    start: at,
    duration: 0.2,
    freq: hz * 3,
    gain: 0.02 * level,
    attack: 0.01,
  });
}

const TAP_VOICES = [coinTing, zapClick, glass, warmBell] as const;

/** A tap at a combo pitch (`semitones` above the phase's base). */
export function playTapVoice(
  engine: VoiceEngine,
  phase: number,
  semitones: number,
  level: number
) {
  const index = Math.min(TAP_VOICES.length - 1, Math.max(0, phase));
  // A touch of random detune keeps rapid taps from sounding mechanical.
  const jitter = (Math.random() - 0.5) * 0.03;
  const midi = TAP_BASE_MIDI[index] + semitones + jitter;
  TAP_VOICES[index](engine, engine.ctx.currentTime, midiToHz(midi), level);
}

/** A rewarding plucked chord; one-off upgrades get more notes and a tail. */
export function playBuyChord(
  engine: VoiceEngine,
  phase: number,
  isOneOff: boolean
) {
  const at = engine.ctx.currentTime;
  const isMinor = phase >= 3;
  const root = TAP_BASE_MIDI[Math.min(3, Math.max(0, phase))] - 12;
  const intervals = isMinor ? [0, 3, 7, 12] : [0, 4, 7, 12];
  if (isOneOff) intervals.push(16, 19, 24);
  intervals.forEach((interval, i) => {
    const hz = midiToHz(root + interval);
    const start = at + i * (isOneOff ? 0.06 : 0.045);
    tone(engine, {
      type: "triangle",
      start,
      duration: isOneOff ? 0.9 : 0.5,
      freq: hz,
      gain: (isOneOff ? 0.12 : 0.1) * (1 - i * 0.05),
      attack: 0.004,
    });
    tone(engine, {
      type: "sine",
      start,
      duration: 0.25,
      freq: hz * 2,
      gain: 0.04,
      attack: 0.004,
    });
  });
}

/** A tiny, subtle chime: an upgrade just became affordable. */
export function playAffordable(engine: VoiceEngine) {
  const at = engine.ctx.currentTime;
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.28,
    freq: midiToHz(88),
    gain: 0.04,
    attack: 0.004,
  });
  tone(engine, {
    type: "sine",
    start: at + 0.07,
    duration: 0.3,
    freq: midiToHz(91),
    gain: 0.03,
    attack: 0.004,
  });
}

/** A soft pop: a new upgrade appeared. */
export function playReveal(engine: VoiceEngine) {
  const at = engine.ctx.currentTime;
  tone(engine, {
    type: "sine",
    start: at,
    duration: 0.12,
    freq: 380,
    freqEnd: 820,
    gain: 0.1,
    attack: 0.004,
  });
  tone(engine, {
    type: "sine",
    start: at + 0.05,
    duration: 0.14,
    freq: 1240,
    gain: 0.03,
    attack: 0.004,
  });
}

/** A slow swell for a new phase: a rising chord and a breath of air. */
export function playPhaseSwell(engine: VoiceEngine, phase: number) {
  const at = engine.ctx.currentTime;
  const root = TAP_BASE_MIDI[Math.min(3, Math.max(0, phase))] - 12;
  const intervals = phase >= 3 ? [0, 3, 7, 10] : [0, 7, 12, 16];
  for (const interval of intervals) {
    tone(engine, {
      type: "sine",
      start: at,
      duration: 3.2,
      freq: midiToHz(root + interval),
      gain: 0.09,
      attack: 1.3,
    });
  }
  noise(engine, {
    buffer: engine.white,
    start: at,
    duration: 2.6,
    filter: "bandpass",
    freq: 400,
    freqEnd: 3000,
    q: 0.8,
    gain: 0.03,
    attack: 1.4,
  });
}

/** A gentle, sad-sweet motif in A minor that thins out to nothing. */
export function playEndingMotif(engine: VoiceEngine) {
  const at = engine.ctx.currentTime + 0.4;
  const notes = [76, 72, 74, 69, 71, 67, 64, 57];
  notes.forEach((midi, i) => {
    const start = at + i * 0.85;
    const fade = 1 - (i / notes.length) * 0.5;
    tone(engine, {
      type: "sine",
      start,
      duration: 2.6,
      freq: midiToHz(midi),
      gain: 0.13 * fade,
      attack: 0.02,
    });
    tone(engine, {
      type: "triangle",
      start,
      duration: 1.1,
      freq: midiToHz(midi) * 2,
      gain: 0.03 * fade,
      attack: 0.02,
    });
  });
}

/** A low rumble of thunder. */
export function playThunder(engine: VoiceEngine) {
  noise(engine, {
    buffer: engine.brown,
    start: engine.ctx.currentTime,
    duration: 2.8,
    filter: "lowpass",
    freq: 180,
    freqEnd: 60,
    q: 0.7,
    gain: 0.5,
    attack: 0.5,
    chop: 0.12,
  });
}
