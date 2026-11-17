import {
  FOOD_INFO,
  isShopKey,
  STARTING_UNLOCKS,
  parseUnlockKey,
  unlockKey,
  type DecorId,
  type FoodId,
  type UnlockKey,
} from "./catalog";
import {
  addXp,
  giftWindowAt,
  hasGiftWaiting,
  localDay,
  lockedItems,
  stageFor,
} from "./progress";
import { activeHappening, ensureHappening } from "./happenings";
import { priceOf, shopItem } from "./shop";
import { RELIGHT_FEEDS, advance, isAwake, isOut } from "./sim";
import { SAVE_SCHEMA } from "./types";
import type {
  Look,
  Memorial,
  Outcome,
  Pet,
  PetEvent,
  SaveData,
  SparkSource,
  Worn,
} from "./types";

export const MAX_PETS = 8;
export const PET_TAP_XP_CAP = 10;
const DAY_MS = 86_400_000;

/**
 * What a pet earns in sparks. For two normal visits a day (a morning and an
 * evening gift, feeds whenever it is hungry, every ash pile cleaned, and a
 * Firefly Catch round of about 6 fireflies each visit) a day pays roughly:
 *   gifts 2 x (10..25, average ~17)         ~ 34
 *   feeds ~4 x 3 = 12, ash ~4 x 2 = 8       ~ 20
 *   play 2 x 6                              ~ 12
 *   level-ups 10 x level, one every few days, fewer the higher it goes
 *                                           ~ 7 to 15
 * which is 40 to 80 over a month. The "normal day" test in actions.test.ts
 * plays 28 such days and checks the average. A round pays at most `playCap`.
 */
export const SPARKS = {
  feedHungry: 3,
  clean: 2,
  perFirefly: 1,
  playCap: 12,
  giftMin: 10,
  giftMax: 25,
  relight: 5,
  levelPerLevel: 10,
} as const;

/** Firefly rounds that pay sparks per pet per check-in window. */
export const MAX_SPARK_ROUNDS = 3;

/** Paying rounds left for this pet in the current check-in window. */
export function sparkRoundsLeft(pet: Pet, nowMs: number): number {
  const window = giftWindowAt(nowMs);
  const used =
    window !== null && pet.sparkRounds.window === window
      ? pet.sparkRounds.count
      : 0;
  return Math.max(0, MAX_SPARK_ROUNDS - used);
}

/** What happenings pay, as inclusive [min, max] sparks. */
export const HAPPENING_SPARKS = {
  visitor: [10, 30],
  treasure: [15, 35],
  mushrooms: [12, 25],
  rain: [8, 20],
  season: [5, 15],
  star: [10, 25],
} as const;
/** A soggy rain shower still pays this much. */
export const RAIN_SOGGY_SPARKS = 3;
export const HATCH_DAY_SPARKS = { monthly: 30, yearly: 100 } as const;
/** Chance a visitor's or treasure's present is a locked item (if any are left). */
const ITEM_CHANCE = { visitor: 0.35, treasure: 0.3 } as const;

/** Shop pets and sparks stay small whole numbers. */
export const MAX_SPARKS = 1_000_000;

function earn(
  pet: Pet,
  amount: number,
  source: SparkSource,
  events: PetEvent[]
): Pet {
  const gained = Math.floor(amount);
  if (gained <= 0) return pet;
  events.push({ type: "sparks", amount: gained, source });
  return { ...pet, sparks: Math.min(MAX_SPARKS, pet.sparks + gained) };
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function emptySave(now: number): SaveData {
  return {
    v: 1,
    schema: SAVE_SCHEMA,
    pets: [],
    memorial: [],
    collection: [],
    updatedAt: now,
  };
}

export function createPet(params: {
  id: string;
  name: string;
  look: Look;
  now: number;
  collection?: readonly UnlockKey[];
}): Pet {
  return {
    id: params.id,
    name: params.name,
    look: params.look,
    worn: { hat: null, face: null, neck: null },
    fuel: 100,
    joy: 100,
    glow: 100,
    ash: 0,
    ashHours: 0,
    state: "alive",
    emberAt: null,
    relightFeeds: 0,
    level: 1,
    xp: 0,
    sparks: 0,
    decor: [],
    unlocked: [
      ...new Set<UnlockKey>([
        ...STARTING_UNLOCKS,
        ...(params.collection ?? []),
      ]),
    ],
    bornAt: params.now,
    tickedAt: params.now,
    giftWindow: null,
    petTaps: { day: localDay(params.now), count: 0 },
    sparkRounds: { window: "", count: 0 },
    happening: null,
    wish: 0,
  };
}

/** Adds XP and applies any level-ups and the items they hand out. */
function grantXp(pet: Pet, amount: number, events: PetEvent[]): Pet {
  if (amount <= 0) return pet;
  const gain = addXp(pet.level, pet.xp, amount, pet.unlocked);
  let unlocked = pet.unlocked;
  let sparks = pet.sparks;
  for (const g of gain.gains) {
    events.push({
      type: "levelUp",
      level: g.level,
      stage: stageFor(g.level).id,
      unlocked: g.unlocked,
    });
    if (g.unlocked) {
      unlocked = [...unlocked, g.unlocked];
      events.push({ type: "unlock", key: g.unlocked, via: "level" });
    }
    const prize = SPARKS.levelPerLevel * g.level;
    events.push({ type: "sparks", amount: prize, source: "level" });
    sparks = Math.min(MAX_SPARKS, sparks + prize);
  }
  return { ...pet, level: gain.level, xp: gain.xp, unlocked, sparks };
}

export function canCare(pet: Pet, now: number): boolean {
  return isAwake(now) && pet.state === "alive";
}

/** Feeds a pet. A sleeping pet or a food it has not unlocked is ignored. */
export function feed(pet: Pet, food: FoodId, now: number): Outcome {
  const events: PetEvent[] = [];
  const info = FOOD_INFO[food];
  if (!isAwake(now) || !pet.unlocked.includes(unlockKey("food", food))) {
    return { pet, events };
  }
  if (pet.state === "ember") {
    const feeds = pet.relightFeeds + 1;
    if (feeds < RELIGHT_FEEDS) {
      return { pet: { ...pet, relightFeeds: feeds }, events };
    }
    const lit: Pet = {
      ...pet,
      state: "alive",
      emberAt: null,
      relightFeeds: 0,
      glow: 40,
      fuel: 50,
      // Happy and tidy again, so glow can recover instead of slipping back.
      joy: 60,
      ash: 0,
      ashHours: 0,
      tickedAt: now,
    };
    events.push(
      { type: "state", to: "relit" },
      { type: "care", action: "relight" }
    );
    return {
      pet: grantXp(earn(lit, SPARKS.relight, "relight", events), 20, events),
      events,
    };
  }
  if (pet.fuel >= 100) {
    events.push({ type: "overfed" });
    return { pet, events };
  }
  const earns = pet.fuel < 80;
  let next: Pet = {
    ...pet,
    fuel: clamp(pet.fuel + info.fuel),
    joy: clamp(pet.joy + info.joy),
  };
  events.push({ type: "care", action: "feed" });
  if (earns) {
    next = earn(next, SPARKS.feedHungry, "feed", events);
    next = grantXp(next, 10, events);
  }
  return { pet: next, events };
}

/** Puffs away one ash pile. */
export function clean(pet: Pet, now: number): Outcome {
  if (!canCare(pet, now) || pet.ash <= 0) return { pet, events: [] };
  const events: PetEvent[] = [{ type: "care", action: "clean" }];
  const tidy = earn(
    { ...pet, ash: pet.ash - 1 },
    SPARKS.clean,
    "clean",
    events
  );
  return { pet: grantXp(tidy, 3, events), events };
}

/** Firefly Catch result: +2 joy per catch (cap 40), score/2 XP (cap 20). */
export function finishPlay(pet: Pet, score: number, now: number): Outcome {
  if (!canCare(pet, now)) return { pet, events: [] };
  const caught = Math.max(0, Math.min(99, Math.floor(score)));
  const events: PetEvent[] = [{ type: "care", action: "play" }];
  const cheered = { ...pet, joy: clamp(pet.joy + Math.min(40, caught * 2)) };
  // Only the first few rounds in a window pay sparks; the rest still cheer
  // the pet up and give XP, so replaying is fine but cannot farm the shop.
  const pays = sparkRoundsLeft(pet, now) > 0;
  const window = giftWindowAt(now) ?? "";
  const used = pet.sparkRounds.window === window ? pet.sparkRounds.count : 0;
  const counted: Pet = pays
    ? { ...cheered, sparkRounds: { window, count: used + 1 } }
    : cheered;
  const next = pays
    ? earn(
        counted,
        Math.min(SPARKS.playCap, caught * SPARKS.perFirefly),
        "play",
        events
      )
    : counted;
  return {
    pet: grantXp(next, Math.min(20, Math.floor(caught / 2)), events),
    events,
  };
}

/** Tapping the pet: +1 XP, at most 10 a day. */
export function tapPet(pet: Pet, now: number): Outcome {
  if (pet.state !== "alive") return { pet, events: [] };
  const day = localDay(now);
  const taps = pet.petTaps.day === day ? pet.petTaps.count : 0;
  const events: PetEvent[] = [{ type: "care", action: "pet" }];
  let next: Pet = { ...pet, petTaps: { day, count: taps } };
  if (isAwake(now) && taps < PET_TAP_XP_CAP) {
    next = grantXp({ ...next, petTaps: { day, count: taps + 1 } }, 1, events);
  }
  return { pet: next, events };
}

/** Opens this window's present: a random locked item, 15 XP and 10-25 sparks. */
export function openGift(
  pet: Pet,
  now: number,
  random: () => number = Math.random
): Outcome {
  if (!hasGiftWaiting(pet, now)) return { pet, events: [] };
  const events: PetEvent[] = [{ type: "care", action: "gift" }];
  const locked = lockedItems(pet.unlocked);
  let next: Pet = { ...pet, giftWindow: giftWindowAt(now) };
  if (locked.length > 0) {
    const key = locked[Math.floor(random() * locked.length)];
    next = { ...next, unlocked: [...next.unlocked, key] };
    events.push({ type: "unlock", key, via: "gift" });
  } else {
    events.push({ type: "bonusXp", amount: 15 });
  }
  const span = SPARKS.giftMax - SPARKS.giftMin + 1;
  next = earn(
    next,
    SPARKS.giftMin + Math.floor(random() * span),
    "gift",
    events
  );
  return { pet: grantXp(next, 15, events), events };
}

/** How a rain shower went: drops popped and drops that reached the pet. */
export interface HappeningResult {
  popped?: number;
  missed?: number;
}

function between(range: readonly [number, number], random: () => number) {
  return range[0] + Math.floor(random() * (range[1] - range[0] + 1));
}

/** Shows the icon intro for the active happening (and counts it as started). */
export function markHappeningSeen(pet: Pet, now: number): Outcome {
  const h = activeHappening(pet, now);
  if (!h || h.seen) return { pet, events: [] };
  return {
    pet: { ...pet, happening: { ...h, seen: true } },
    events: [{ type: "happening", kind: h.kind, done: false }],
  };
}

/**
 * Finishes the active happening and pays its reward. A visitor's present or a
 * treasure may be a still-locked item instead of sparks; a shooting star's
 * wish waits in the pet until morning; a soggy rain shower costs a little joy
 * (never health). Ignored when nothing is active.
 */
export function completeHappening(
  pet: Pet,
  now: number,
  random: () => number = Math.random,
  result: HappeningResult = {}
): Outcome {
  const h = activeHappening(pet, now);
  if (!h) return { pet, events: [] };
  const events: PetEvent[] = [{ type: "happening", kind: h.kind, done: true }];
  let next: Pet = { ...pet, happening: { ...h, done: true, seen: true } };
  let xp = 10;

  const present = (chance: number, range: readonly [number, number]) => {
    const locked = lockedItems(next.unlocked);
    if (locked.length > 0 && random() < chance) {
      const key = locked[Math.floor(random() * locked.length)];
      next = { ...next, unlocked: [...next.unlocked, key] };
      events.push({ type: "unlock", key, via: "gift" });
    } else {
      next = earn(next, between(range, random), "happening", events);
    }
  };

  switch (h.kind) {
    case "visitor":
      present(ITEM_CHANCE.visitor, HAPPENING_SPARKS.visitor);
      break;
    case "treasure":
      present(ITEM_CHANCE.treasure, HAPPENING_SPARKS.treasure);
      break;
    case "mushrooms":
      next = earn(
        { ...next, joy: clamp(next.joy + 10) },
        between(HAPPENING_SPARKS.mushrooms, random),
        "happening",
        events
      );
      break;
    case "season":
      next = earn(
        next,
        between(HAPPENING_SPARKS.season, random),
        "happening",
        events
      );
      break;
    case "star":
      next = { ...next, wish: between(HAPPENING_SPARKS.star, random) };
      xp = 5;
      break;
    case "rain": {
      const popped = Math.max(0, Math.floor(result.popped ?? 0));
      const missed = Math.max(0, Math.floor(result.missed ?? 0));
      if (missed > popped) {
        // A little soggy: a small dip in joy, never in health.
        next = earn(
          { ...next, joy: clamp(next.joy - 8) },
          RAIN_SOGGY_SPARKS,
          "happening",
          events
        );
        xp = 3;
      } else {
        next = earn(
          { ...next, joy: clamp(next.joy + 15) },
          between(HAPPENING_SPARKS.rain, random),
          "happening",
          events
        );
      }
      break;
    }
    case "hatchday": {
      const yearly = h.variant === "yearly";
      next = earn(
        next,
        yearly ? HATCH_DAY_SPARKS.yearly : HATCH_DAY_SPARKS.monthly,
        "happening",
        events
      );
      const hat = unlockKey("hat", "party");
      if (!next.unlocked.includes(hat)) {
        next = { ...next, unlocked: [...next.unlocked, hat] };
        events.push({ type: "unlock", key: hat, via: "gift" });
      }
      next = { ...next, joy: clamp(next.joy + 20) };
      xp = 20;
      break;
    }
  }
  return { pet: grantXp(next, xp, events), events };
}

/** Collects the sparks a shooting-star wish held overnight. */
export function collectWish(pet: Pet, now: number): Outcome {
  if (pet.state !== "alive" || !isAwake(now) || pet.wish <= 0) {
    return { pet, events: [] };
  }
  const events: PetEvent[] = [];
  const next = earn({ ...pet, wish: 0 }, pet.wish, "happening", events);
  return { pet: next, events };
}

export type DressSlot = "hat" | "face" | "neck";

/** Wears (or, with null, removes) an item; a locked item is ignored. */
export function dress(pet: Pet, slot: DressSlot, id: string | null): Pet {
  if (id !== null && !pet.unlocked.includes(unlockKey(slot, id))) return pet;
  return { ...pet, worn: { ...pet.worn, [slot]: id } as Worn };
}

/**
 * Buys a shop item with the pet's sparks. A hat, face or neck item is put on
 * and decor is put out. Ignored when it is not for sale, already owned or too
 * dear (the screen shows how many sparks are missing).
 */
export function buy(pet: Pet, key: UnlockKey, now?: number): Outcome {
  const item = shopItem(key);
  if (!item || !isShopKey(key) || pet.unlocked.includes(key)) {
    return { pet, events: [] };
  }
  const price = priceOf(item, now);
  if (pet.sparks < price) return { pet, events: [] };
  const bought: Pet = {
    ...pet,
    sparks: pet.sparks - price,
    unlocked: [...pet.unlocked, key],
  };
  const placed =
    item.tab === "decor"
      ? { ...bought, decor: [...bought.decor, item.id as DecorId] }
      : dress(bought, item.tab, item.id);
  return {
    pet: placed,
    events: [{ type: "buy", key, price }],
  };
}

/** Puts a decor item out in the glade or packs it away. Must be owned. */
export function setDecor(pet: Pet, id: DecorId, on: boolean): Pet {
  if (!pet.unlocked.includes(unlockKey("decor", id))) return pet;
  const rest = pet.decor.filter((d) => d !== id);
  return { ...pet, decor: on ? [...rest, id] : rest };
}

export function restyle(pet: Pet, look: Partial<Look>): Pet {
  const next: Look = { ...pet.look };
  for (const kind of ["colour", "shape", "eyes"] as const) {
    const id = look[kind];
    if (id !== undefined && pet.unlocked.includes(unlockKey(kind, id))) {
      (next as unknown as Record<string, string>)[kind] = id;
    }
  }
  return { ...pet, look: next };
}

/** Everything the device has ever unlocked, across live and lost pets. */
export function collectionOf(save: SaveData): UnlockKey[] {
  const all = new Set<UnlockKey>(save.collection);
  for (const pet of save.pets) for (const key of pet.unlocked) all.add(key);
  return [...all].filter((key) => parseUnlockKey(key) !== null);
}

export function hatch(
  save: SaveData,
  params: { id: string; name: string; look: Look; now: number }
): SaveData {
  if (save.pets.length >= MAX_PETS) return save;
  const collection = collectionOf(save);
  const pet = createPet({ ...params, collection });
  return {
    ...save,
    pets: [...save.pets, pet],
    collection,
    updatedAt: params.now,
  };
}

/**
 * Brings every pet up to `now`: plays time forward, notes who just turned
 * into an ember, and moves pets that went out for good to the Memory Grove.
 */
export function settle(
  save: SaveData,
  now: number
): { save: SaveData; events: { petId: string; event: PetEvent }[] } {
  const events: { petId: string; event: PetEvent }[] = [];
  const pets: Pet[] = [];
  const memorial: Memorial[] = [...save.memorial];
  for (const pet of save.pets) {
    const was = pet.state;
    const next = ensureHappening(advance(pet, pet.tickedAt, now), now);
    if (was === "alive" && next.state === "ember") {
      events.push({ petId: pet.id, event: { type: "state", to: "ember" } });
    }
    if (isOut(next, now) && next.emberAt !== null) {
      const outAt = next.emberAt + 5 * DAY_MS;
      memorial.push({
        id: next.id,
        name: next.name,
        look: next.look,
        worn: next.worn,
        level: next.level,
        daysLived: Math.max(0, Math.floor((outAt - next.bornAt) / DAY_MS)),
        bornAt: next.bornAt,
        outAt,
      });
      events.push({ petId: pet.id, event: { type: "state", to: "out" } });
      continue;
    }
    pets.push(next);
  }
  const settled = { ...save, pets, memorial };
  return {
    save: { ...settled, collection: collectionOf(settled), updatedAt: now },
    events,
  };
}
