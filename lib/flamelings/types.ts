import type { Happening, HappeningKind } from "./happenings";
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

/** A grown-up form, picked at Blaze from how the pet was cared for. */
export type FormId = "cozy" | "wild" | "sparkly";

/** What the child has done with this pet, for picking its form (never sent anywhere). */
export interface CareStats {
  feeds: number;
  cleans: number;
  plays: number;
  /** Pet taps and emotes. */
  pets: number;
  /** Dress-ups and purchases. */
  styles: number;
}

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
  /** This window's happening (null for a quiet one), with its done state. */
  happening: Happening | null;
  /** Sparks a shooting-star wish is holding for the morning (0 when none). */
  wish: number;
  care: CareStats;
  /** Care credit given today for emotes, taps and dress-ups (see CARE_CREDIT_CAP). */
  careCredit: { day: string; count: number };
  /** The grown-up form picked at level 10; permanent (null before). */
  form: FormId | null;
  online: PetOnline;
}

/** The public face of a pet that friends see (what a card online holds). */
export interface CardLook extends Look {
  hat: HatId | "none";
  face: FaceId | "none";
  neck: NeckId | "none";
}

export interface PetCard {
  look: CardLook;
  level: number;
  stage: StageId;
  form: FormId | "none";
  /** An index into ONLINE_NAMES: a pet's typed name never leaves the device. */
  nameId: number;
}

/** A friend as saved on this device: their code and the card last seen. */
export interface Friend {
  code: string;
  card: PetCard;
}

export const MAX_FRIENDS = 20;

/** A pet's online side: its friend code, chosen online name and friends. */
export interface PetOnline {
  /** The friend code once the pet's card exists online. */
  code: string | null;
  /** The chosen index into ONLINE_NAMES, or null to use the typed name or a seeded pick. */
  nameId: number | null;
  friends: Friend[];
  /** Per friend code, the check-in window of the last playdate here (for the local reward limit). */
  played: Record<string, string>;
}

export interface Memorial {
  id: string;
  name: string;
  look: Look;
  worn: Worn;
  level: number;
  form: FormId | null;
  daysLived: number;
  bornAt: number;
  outAt: number;
}

/**
 * The shape of the saved data, bumped whenever a build adds fields (1.0 = 1,
 * 1.1 = 2, 1.2 = 3, 1.3 = 4, 1.4 = 5). A build never writes over a save from a newer schema.
 */
export const SAVE_SCHEMA = 5;

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
  | { type: "buy"; key: UnlockKey; price: number }
  | { type: "happening"; kind: HappeningKind; done: boolean }
  | { type: "evolve"; form: FormId }
  | { type: "friend"; action: FriendAction };

/** What the Friends screen counts: a friend added, a playdate played, a visit received. */
export type FriendAction = "add" | "playdate" | "visited";

/** Where sparks came from: the screen flies them in from the matching spot. */
export type SparkSource =
  | "feed"
  | "clean"
  | "play"
  | "gift"
  | "level"
  | "relight"
  | "happening"
  | "friend";

/** The mini-games in the Play picker; all share one cap of paying rounds. */
export type PlayGame = "fireflies" | "marshmallow" | "logs";

export type CareAction = "feed" | "play" | "clean" | "pet" | "gift" | "relight";

export interface Outcome {
  pet: Pet;
  events: PetEvent[];
}
