import {
  noise,
  tone,
  type VoiceEngine,
} from "@/components/game-audio/primitives";
import type { SoundName } from "@/lib/flamelings/sound";

/** One short, soft voice per sound. Everything stays well under 0.2 gain. */
type Voice = (engine: VoiceEngine, t: number) => void;

const sparkleNotes = [1047, 1319, 1568, 2093];

export const VOICES: Record<SoundName, Voice> = {
  /** A little two-note chirp, like a happy bird. */
  chirp(engine, t) {
    tone(engine, {
      type: "sine",
      start: t,
      duration: 0.09,
      freq: 880,
      freqEnd: 1320,
      gain: 0.09,
    });
    tone(engine, {
      type: "sine",
      start: t + 0.1,
      duration: 0.11,
      freq: 1100,
      freqEnd: 1650,
      gain: 0.08,
    });
  },
  /** A soft chomp, then the flame flares up. */
  chomp(engine, t) {
    tone(engine, {
      type: "triangle",
      start: t,
      duration: 0.1,
      freq: 240,
      freqEnd: 110,
      gain: 0.16,
    });
    tone(engine, {
      type: "triangle",
      start: t + 0.13,
      duration: 0.1,
      freq: 220,
      freqEnd: 100,
      gain: 0.14,
    });
    noise(engine, {
      buffer: engine.white,
      start: t + 0.24,
      duration: 0.3,
      filter: "highpass",
      freq: 900,
      freqEnd: 3200,
      gain: 0.05,
      attack: 0.06,
    });
  },
  /** A rising sparkle for a new item or a level. */
  sparkle(engine, t) {
    sparkleNotes.forEach((freq, i) =>
      tone(engine, {
        type: "sine",
        start: t + i * 0.07,
        duration: 0.28,
        freq,
        gain: 0.07,
        attack: 0.008,
      })
    );
  },
  /** A tiny "pip" for a caught firefly. */
  pip(engine, t) {
    tone(engine, {
      type: "sine",
      start: t,
      duration: 0.07,
      freq: 1400,
      freqEnd: 1900,
      gain: 0.08,
      attack: 0.004,
    });
  },
  /** Paper rustle, then a sparkle: a present opening. */
  unwrap(engine, t) {
    noise(engine, {
      buffer: engine.white,
      start: t,
      duration: 0.28,
      filter: "bandpass",
      freq: 3200,
      gain: 0.05,
      chop: 0.03,
    });
    VOICES.sparkle(engine, t + 0.3);
  },
  /** A warm whoosh climbing as the ember catches. */
  relight(engine, t) {
    noise(engine, {
      buffer: engine.brown,
      start: t,
      duration: 0.8,
      filter: "lowpass",
      freq: 200,
      freqEnd: 1800,
      gain: 0.16,
      attack: 0.2,
    });
    tone(engine, {
      type: "sine",
      start: t,
      duration: 0.8,
      freq: 220,
      freqEnd: 660,
      gain: 0.07,
      attack: 0.15,
    });
    VOICES.sparkle(engine, t + 0.7);
  },
  /** A sad little downward "fwoop": the flame has gone to an ember. */
  fwoop(engine, t) {
    tone(engine, {
      type: "sine",
      start: t,
      duration: 0.38,
      freq: 620,
      freqEnd: 150,
      gain: 0.1,
      attack: 0.02,
    });
  },
};

/** The same sound twice in this many seconds is dropped, so tapping stays soft. */
const MIN_GAP: Partial<Record<SoundName, number>> = {
  chirp: 0.18,
  pip: 0.05,
  chomp: 0.3,
};

const lastPlayed = new Map<SoundName, number>();

export function playVoice(name: SoundName, engine: VoiceEngine): void {
  const now = engine.ctx.currentTime;
  const gap = MIN_GAP[name] ?? 0;
  const last = lastPlayed.get(name);
  if (last !== undefined && now - last < gap) return;
  lastPlayed.set(name, now);
  VOICES[name](engine, now);
}

export function resetVoiceLimits(): void {
  lastPlayed.clear();
}
