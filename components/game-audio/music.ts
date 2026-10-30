/**
 * Pure music planning for the generative beds. A `MusicSpec` describes a
 * mood (tempo, key, scale, chord loop, how busy the melody is) and `planBar`
 * turns one bar of it into note events. It is deterministic: the same spec
 * and bar index always give the same notes, and the melody repeats every
 * `PHRASE_BARS` bars so the bed feels like a loop rather than noise.
 */

export type VoiceKind = "pad" | "bass" | "lead" | "pluck";

export interface MusicSpec {
  /** Stable name; changing it restarts the bed from bar 0. */
  id: string;
  /** Beats per minute. */
  tempo: number;
  beatsPerBar: number;
  /** MIDI note of the key's tonic (60 is middle C). */
  rootMidi: number;
  /** Semitone offsets of the scale from the tonic. */
  scale: readonly number[];
  /** Scale degree of each bar's chord root, looped. */
  progression: readonly number[];
  /** 0 (no melody) to 1 (a note on most beats). */
  leadDensity: number;
  /** Lowest and highest melody scale degree. */
  leadRange: readonly [number, number];
  padWave: OscillatorType;
  leadWave: OscillatorType;
  /** A soft off-beat chord strum, the "oom-pah" of a shanty. */
  isStrummed: boolean;
  /** 0 to 1: how loud the bed is before the player's volume. */
  level: number;
  /** Mixes into the melody's random walk, so moods differ. */
  seed: number;
}

export interface NoteEvent {
  voice: VoiceKind;
  midi: number;
  /** Beats from the start of the bar. */
  beat: number;
  /** Length in beats. */
  beats: number;
  /** 0 to 1, before the spec's level. */
  gain: number;
}

/** The melody repeats exactly every this many bars. */
export const PHRASE_BARS = 8;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function barSeconds(spec: MusicSpec): number {
  return (spec.beatsPerBar * 60) / spec.tempo;
}

/** The MIDI note for a scale degree; negative and tall degrees wrap by octave. */
export function degreeToMidi(spec: MusicSpec, degree: number): number {
  const size = spec.scale.length;
  const octave = Math.floor(degree / size);
  const index = ((degree % size) + size) % size;
  return spec.rootMidi + spec.scale[index] + 12 * octave;
}

/** A small seeded generator (mulberry32): same seed, same sequence. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chordDegrees(root: number): number[] {
  return [root, root + 2, root + 4];
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function planLead(
  spec: MusicSpec,
  chordRoot: number,
  phraseBar: number
): NoteEvent[] {
  if (spec.leadDensity <= 0) return [];
  const random = createRandom(
    spec.seed * 7919 + phraseBar * 104729 + chordRoot * 31
  );
  const [low, high] = spec.leadRange;
  // The last bar of the phrase breathes, so the loop has a seam.
  const density =
    phraseBar === PHRASE_BARS - 1 ? spec.leadDensity * 0.4 : spec.leadDensity;
  const chordTones = new Set(
    chordDegrees(chordRoot).map(
      (d) => ((d % spec.scale.length) + spec.scale.length) % spec.scale.length
    )
  );
  const events: NoteEvent[] = [];
  let degree = clamp(chordRoot + 4, low, high);
  let beat = 0;
  while (beat < spec.beatsPerBar) {
    const isDownbeat = beat === 0;
    const chance = isDownbeat ? Math.min(1, density * 1.5) : density;
    if (random() >= chance) {
      beat += 1;
      continue;
    }
    // Step up or down by one or two degrees, leaning toward a chord tone.
    const move = Math.floor(random() * 5) - 2;
    degree = clamp(degree + move, low, high);
    if (isDownbeat) {
      for (let tries = 0; tries < 4; tries += 1) {
        const index =
          ((degree % spec.scale.length) + spec.scale.length) %
          spec.scale.length;
        if (chordTones.has(index)) break;
        degree = clamp(degree + (random() < 0.5 ? -1 : 1), low, high);
      }
    }
    const beats = random() < 0.35 ? 2 : 1;
    const length = Math.min(beats, spec.beatsPerBar - beat);
    events.push({
      voice: "lead",
      midi: degreeToMidi(spec, degree) + 12,
      beat,
      beats: length * 0.95,
      gain: 0.5 + random() * 0.2,
    });
    beat += length;
  }
  return events;
}

/** The notes of one bar, in time order. */
export function planBar(spec: MusicSpec, barIndex: number): NoteEvent[] {
  const bar = Math.max(0, Math.floor(barIndex));
  const chordRoot = spec.progression[bar % spec.progression.length];
  const phraseBar = bar % PHRASE_BARS;
  const events: NoteEvent[] = [];

  for (const degree of chordDegrees(chordRoot)) {
    events.push({
      voice: "pad",
      midi: degreeToMidi(spec, degree),
      beat: 0,
      beats: spec.beatsPerBar,
      gain: 0.3,
    });
  }
  const bassMidi = degreeToMidi(spec, chordRoot) - 12;
  events.push({
    voice: "bass",
    midi: bassMidi,
    beat: 0,
    beats: spec.beatsPerBar / 2,
    gain: 0.8,
  });
  if (spec.isStrummed) {
    const half = spec.beatsPerBar / 2;
    events.push({
      voice: "bass",
      midi: bassMidi + 7,
      beat: half,
      beats: half * 0.5,
      gain: 0.5,
    });
    for (const beat of [half / 3, half / 3 + half]) {
      for (const [i, degree] of chordDegrees(chordRoot).entries()) {
        events.push({
          voice: "pluck",
          midi: degreeToMidi(spec, degree),
          beat: beat + i * 0.04,
          beats: 0.5,
          gain: 0.35,
        });
      }
    }
  }
  events.push(...planLead(spec, chordRoot, phraseBar));
  return events.sort((a, b) => a.beat - b.beat);
}

/** Checks a spec for values the planner and player rely on. */
export function isValidSpec(spec: MusicSpec): boolean {
  return (
    spec.tempo > 30 &&
    spec.tempo < 240 &&
    spec.beatsPerBar >= 2 &&
    spec.scale.length >= 5 &&
    spec.progression.length >= 1 &&
    spec.leadRange[0] <= spec.leadRange[1] &&
    spec.level > 0 &&
    spec.level <= 1 &&
    spec.leadDensity >= 0 &&
    spec.leadDensity <= 1
  );
}
