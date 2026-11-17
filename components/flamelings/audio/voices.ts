import {
  noise,
  tone,
  type VoiceEngine,
} from "@/components/game-audio/primitives";
import type { SoundName } from "@/lib/flamelings/sound";

/** One short, soft voice per sound. Everything stays well under 0.2 gain. */
type Voice = (engine: VoiceEngine, t: number) => void;

const sparkleNotes = [1047, 1319, 1568, 2093];

/** One round, bell-like mushroom note (five of them make a little tune). */
function mushNote(engine: VoiceEngine, t: number, freq: number): void {
  tone(engine, {
    type: "triangle",
    start: t,
    duration: 0.32,
    freq,
    gain: 0.11,
    attack: 0.008,
  });
  tone(engine, {
    type: "sine",
    start: t,
    duration: 0.2,
    freq: freq * 2,
    gain: 0.03,
    attack: 0.008,
  });
}

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
  /** A bright two-note "ting" when a spark lands in the counter. */
  coin(engine, t) {
    tone(engine, {
      type: "square",
      start: t,
      duration: 0.06,
      freq: 1568,
      gain: 0.04,
      attack: 0.004,
    });
    tone(engine, {
      type: "sine",
      start: t + 0.06,
      duration: 0.2,
      freq: 2093,
      gain: 0.07,
      attack: 0.004,
    });
  },
  /** A friendly two-note "boop-beep": someone has come to visit. */
  arrive(engine, t) {
    tone(engine, {
      type: "triangle",
      start: t,
      duration: 0.14,
      freq: 523,
      gain: 0.1,
      attack: 0.01,
    });
    tone(engine, {
      type: "triangle",
      start: t + 0.15,
      duration: 0.2,
      freq: 784,
      gain: 0.1,
      attack: 0.01,
    });
  },
  /** A bubble popping: a quick blip upward. */
  pop(engine, t) {
    tone(engine, {
      type: "sine",
      start: t,
      duration: 0.09,
      freq: 520,
      freqEnd: 1250,
      gain: 0.1,
      attack: 0.003,
    });
  },
  /** A soft patter of rain. */
  drizzle(engine, t) {
    noise(engine, {
      buffer: engine.white,
      start: t,
      duration: 0.7,
      filter: "bandpass",
      freq: 4200,
      gain: 0.035,
      attack: 0.15,
      chop: 0.05,
    });
  },
  /** A muffled thump of the spade in soft earth. */
  dig(engine, t) {
    tone(engine, {
      type: "sine",
      start: t,
      duration: 0.12,
      freq: 170,
      freqEnd: 80,
      gain: 0.16,
      attack: 0.005,
    });
    noise(engine, {
      buffer: engine.brown,
      start: t,
      duration: 0.14,
      filter: "lowpass",
      freq: 900,
      gain: 0.1,
      attack: 0.005,
    });
  },
  /** A creaky lid, then a sparkle: the chest pops open. */
  chest(engine, t) {
    tone(engine, {
      type: "sawtooth",
      start: t,
      duration: 0.3,
      freq: 180,
      freqEnd: 420,
      gain: 0.05,
      attack: 0.05,
    });
    VOICES.sparkle(engine, t + 0.28);
  },
  /** A twinkling wish: a high shimmer that floats up and away. */
  wish(engine, t) {
    [1319, 1760, 2349, 2637].forEach((freq, i) =>
      tone(engine, {
        type: "sine",
        start: t + i * 0.12,
        duration: 0.45,
        freq,
        gain: 0.06,
        attack: 0.02,
      })
    );
  },
  /** Blowing out the candles: a puff of air, then a cheer. */
  blow(engine, t) {
    noise(engine, {
      buffer: engine.white,
      start: t,
      duration: 0.35,
      filter: "highpass",
      freq: 1200,
      freqEnd: 3500,
      gain: 0.06,
      attack: 0.05,
    });
    VOICES.sparkle(engine, t + 0.3);
  },
  mush0: (engine, t) => mushNote(engine, t, 523),
  mush1: (engine, t) => mushNote(engine, t, 587),
  mush2: (engine, t) => mushNote(engine, t, 659),
  mush3: (engine, t) => mushNote(engine, t, 784),
  mush4: (engine, t) => mushNote(engine, t, 880),
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
  coin: 0.07,
  drizzle: 0.4,
  dig: 0.12,
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
