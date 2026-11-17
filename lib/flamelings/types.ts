import type {
  ColourId,
  DecorId,
  EyesId,
  FaceId,
  HatId,
  NeckId,
  ShapeId,
  UnlockKey,
} from "./catalog";

export type StageId = "spark" | "flicker" | "flame" | "blaze" | "bonfire";

export type PetState = "alive" | "ember";

export interface Look {
  colour: ColourId;
  shape: ShapeId;
  eyes: EyesId;
}

export interface Worn {
  hat: HatId | null;
  face: FaceId | null;
  neck: NeckId | null;
}

export interface Pet {
  id: string;
  name: string;
  look: Look;
  worn: Worn;
  /** Hunger, joy and (hidden) health, each 0 to 100. */
  fuel: number;
  joy: number;
  glow: number;
  /** Uncleaned ash piles, 0 to 4, and the awake hours towards the next one. */
  ash: number;
  ashHours: number;
  state: PetState;
  /** Wall-clock ms when the pet became an ember (null while alive). */
  emberAt: number | null;
  /** Feeds so far towards a relight (0 to 2 while an ember). */
  relightFeeds: number;
  level: number;
  xp: number;
  unlocked: UnlockKey[];
  /** The shop currency this pet has earned and not spent yet. */
  sparks: number;
  /** The decor shown in this pet's glade (each must be in `unlocked`). */
  decor: DecorId[];
  /** Wall-clock ms the pet was hatched, and the last moment simulated. */
  bornAt: number;
  tickedAt: number;
  /** The check-in window whose gift was opened, e.g. `2026-11-16:am`. */
  giftWindow: string | null;
  /** Pet taps that earned XP today, for the daily cap. */
  petTaps: { day: string; count: number };
  /** Firefly rounds that paid sparks in a check-in window (see MAX_SPARK_ROUNDS). */
  sparkRounds: { window: string; count: number };
}

export interface Memorial {
  id: string;
  name: string;
  look: Look;
  worn: Worn;
  level: number;
  daysLived: number;
  bornAt: number;
  outAt: number;
}

/**
 * The shape of the saved data, bumped whenever a build adds fields (1.0 = 1,
 * 1.1 = 2, 1.2 = 3). A build never writes over a save from a newer schema.
 */
export const SAVE_SCHEMA = 3;

export interface SaveData {
  v: 1;
  /** The schema this save was written with (older saves read as 1). */
  schema: number;
  pets: Pet[];
  memorial: Memorial[];
  /** Every item any pet on this device ever unlocked. */
  collection: UnlockKey[];
  updatedAt: number;
}

/** What happened as a result of an action or a stretch of time. */
export type PetEvent =
  | {
      type: "levelUp";
      level: number;
      stage: StageId;
      unlocked: UnlockKey | null;
    }
  | { type: "unlock"; key: UnlockKey; via: "level" | "gift" }
  | { type: "state"; to: "ember" | "relit" | "out" }
  | { type: "care"; action: CareAction }
  | { type: "overfed" }
  | { type: "bonusXp"; amount: number }
  | { type: "sparks"; amount: number; source: SparkSource }
  | { type: "buy"; key: UnlockKey; price: number };

/** Where sparks came from: the screen flies them in from the matching spot. */
export type SparkSource =
  "feed" | "clean" | "play" | "gift" | "level" | "relight";

export type CareAction = "feed" | "play" | "clean" | "pet" | "gift" | "relight";

export interface Outcome {
  pet: Pet;
  events: PetEvent[];
}
