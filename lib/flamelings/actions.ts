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
import { shopItem } from "./shop";
import { RELIGHT_FEEDS, advance, isAwake, isOut } from "./sim";
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
  return { v: 1, pets: [], memorial: [], collection: [], updatedAt: now };
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
  const next = earn(
    cheered,
    Math.min(SPARKS.playCap, caught * SPARKS.perFirefly),
    "play",
    events
  );
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
export function buy(pet: Pet, key: UnlockKey): Outcome {
  const item = shopItem(key);
  if (!item || !isShopKey(key) || pet.unlocked.includes(key)) {
    return { pet, events: [] };
  }
  if (pet.sparks < item.price) return { pet, events: [] };
  const bought: Pet = {
    ...pet,
    sparks: pet.sparks - item.price,
    unlocked: [...pet.unlocked, key],
  };
  const placed =
    item.tab === "decor"
      ? { ...bought, decor: [...bought.decor, item.id as DecorId] }
      : dress(bought, item.tab, item.id);
  return {
    pet: placed,
    events: [{ type: "buy", key, price: item.price }],
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
    const next = advance(pet, pet.tickedAt, now);
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
