import type { PetEvent } from "./types";

/** The sounds the game makes. Quiet, short and cute; all synthesized. */
export type SoundName =
  | "chirp"
  | "chomp"
  | "sparkle"
  | "pip"
  | "unwrap"
  | "relight"
  | "fwoop"
  | "coin"
  | "arrive"
  | "pop"
  | "drizzle"
  | "dig"
  | "chest"
  | "wish"
  | "blow"
  | "mush0"
  | "mush1"
  | "mush2"
  | "mush3"
  | "mush4"
  | "evolve"
  | "sizzle"
  | "giggle"
  | "puff"
  | "thud"
  | "cheer";

export const SOUND_NAMES: readonly SoundName[] = [
  "chirp",
  "chomp",
  "sparkle",
  "pip",
  "unwrap",
  "relight",
  "fwoop",
  "coin",
  "arrive",
  "pop",
  "drizzle",
  "dig",
  "chest",
  "wish",
  "blow",
  "mush0",
  "mush1",
  "mush2",
  "mush3",
  "mush4",
  "evolve",
  "sizzle",
  "giggle",
  "puff",
  "thud",
  "cheer",
];

type Sink = (name: SoundName) => void;
let sink: Sink | null = null;

/** The audio hook installs its player here; null removes it. */
export function setSoundSink(next: Sink | null): void {
  sink = next;
}

/** Plays a sound if audio is on and unlocked; otherwise nothing happens. */
export function playSound(name: SoundName): void {
  sink?.(name);
}

/** Which sounds an action or a stretch of time deserves. */
export function soundsForEvents(events: readonly PetEvent[]): SoundName[] {
  const sounds = new Set<SoundName>();
  for (const event of events) {
    if (event.type === "care") {
      if (event.action === "feed") sounds.add("chomp");
      if (event.action === "pet") sounds.add("chirp");
      if (event.action === "clean") sounds.add("pip");
      if (event.action === "gift") sounds.add("unwrap");
    } else if (event.type === "evolve") {
      sounds.add("evolve");
    } else if (event.type === "levelUp") {
      sounds.add("sparkle");
    } else if (event.type === "unlock") {
      sounds.add(event.via === "gift" ? "unwrap" : "sparkle");
    } else if (event.type === "buy") {
      sounds.add("sparkle");
    } else if (event.type === "state") {
      if (event.to === "relit") sounds.add("relight");
      if (event.to === "ember") sounds.add("fwoop");
    }
  }
  return [...sounds];
}

export function playEventSounds(events: readonly PetEvent[]): void {
  for (const name of soundsForEvents(events)) playSound(name);
}
