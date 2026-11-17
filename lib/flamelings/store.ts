import { create } from "zustand";
import {
  buy as buyAction,
  collectWish as collectWishAction,
  completeHappening as completeHappeningAction,
  markHappeningSeen as markSeenAction,
  type HappeningResult,
  clean as cleanAction,
  dress as dressAction,
  emote as emoteAction,
  feed as feedAction,
  finishPlay,
  hatch as hatchAction,
  MAX_PETS,
  openGift as openGiftAction,
  restyle as restyleAction,
  setDecor as setDecorAction,
  settle,
  tapPet as tapAction,
  type DressSlot,
} from "./actions";
import {
  cleanName,
  type DecorId,
  type FoodId,
  type UnlockKey,
} from "./catalog";
import { now } from "./clock";
import type { HappeningKind } from "./happenings";
import { playEventSounds } from "./sound";
import { trackEvents, trackHatch, trackPlayEnd, trackVisit } from "./analytics";
import { emptySave } from "./actions";
import { loadSaveResult, readRaw, writeSave } from "./save";
import { acquire, heldByOther, readLock, release, LOCK_KEY } from "./tabLock";
import { SAVE_KEY } from "./save";
import type {
  FormId,
  Look,
  Outcome,
  Pet,
  PetEvent,
  PlayGame,
  SaveData,
} from "./types";

/** A card to show the player: a level-up, a new item or a relight. */
export type Celebration =
  | {
      kind: "levelUp";
      petId: string;
      level: number;
      stage: string;
      unlocked: UnlockKey | null;
    }
  | { kind: "gift"; petId: string; key: UnlockKey | null }
  | { kind: "bought"; petId: string; key: UnlockKey }
  | { kind: "relit"; petId: string }
  | { kind: "evolve"; petId: string; form: FormId };

export type View =
  | { screen: "shelf" }
  | { screen: "hatch" }
  | { screen: "grove" }
  | { screen: "pet"; petId: string };

export function celebrationsFrom(
  petId: string,
  events: readonly PetEvent[]
): Celebration[] {
  const cards: Celebration[] = [];
  for (const event of events) {
    if (event.type === "levelUp") {
      cards.push({
        kind: "levelUp",
        petId,
        level: event.level,
        stage: event.stage,
        unlocked: event.unlocked,
      });
    } else if (event.type === "unlock" && event.via === "gift") {
      cards.push({ kind: "gift", petId, key: event.key });
    } else if (event.type === "buy") {
      cards.push({ kind: "bought", petId, key: event.key });
    } else if (event.type === "state" && event.to === "relit") {
      cards.push({ kind: "relit", petId });
    } else if (event.type === "evolve") {
      cards.push({ kind: "evolve", petId, form: event.form });
    }
  }
  return cards;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** This tab's id for the single-writer lock. */
const TAB_ID = newId();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export interface FlamelingsStore {
  ready: boolean;
  /** Another tab is playing: this one shows a screen and never saves. */
  locked: boolean;
  /** The stored save is from a newer build: play in memory, offer the update. */
  outdated: boolean;
  save: SaveData;
  /** The game clock as of the last tick or action. */
  clock: number;
  view: View;
  celebrations: Celebration[];
  holding: { petId: string; window: string } | null;
  /** Events of the last action, for the screen to react to (id bumps each). */
  lastEvents: { id: number; petId: string; events: PetEvent[] } | null;

  init(): void;
  tick(): void;
  /** Renews the lock; becomes locked if another tab has taken over. */
  heartbeat(): void;
  /** The "Play here" button: takes the lock and loads the latest save. */
  takeOver(): void;
  /** A `storage` event from another tab. */
  onStorage(key: string | null): void;
  go(view: View): void;
  hatch(name: string, look: Look): string | null;
  feed(petId: string, food: FoodId): PetEvent[];
  clean(petId: string): PetEvent[];
  finishPlay(petId: string, game: PlayGame, score: number): PetEvent[];
  /** An emote picked from the panel (counts towards a Sparkly form). */
  emote(petId: string): void;
  tapPet(petId: string): PetEvent[];
  openGift(petId: string): PetEvent[];
  dress(petId: string, slot: DressSlot, id: string | null): void;
  restyle(petId: string, look: Partial<Look>): void;
  /** Spends the pet's sparks on a shop item (events say if it worked). */
  buy(petId: string, key: UnlockKey): PetEvent[];
  /** The icon intro of this pet's happening was shown. */
  markHappeningSeen(petId: string): PetEvent[];
  /** Finishes this pet's happening and pays it. */
  completeHappening(
    petId: string,
    happening: { window: string; kind: HappeningKind },
    result?: HappeningResult
  ): PetEvent[];
  /** The happening on screen (never swapped for the next window's), or null. */
  hold(holding: { petId: string; window: string } | null): void;
  /** Collects the sparks a shooting-star wish held overnight. */
  collectWish(petId: string): PetEvent[];
  /** Puts an owned decor item out in the glade, or away. */
  setDecor(petId: string, id: DecorId, on: boolean): void;
  dismissCelebration(): void;
}

let eventId = 0;
let visited = false;
/** What storage held when this tab last read or wrote it. */
let lastRaw: string | null = null;
/** False after a failed read or backup: never overwrite what we could not read. */
let canWrite = true;

/** Gives the lock back (page hiding) so the next page load can take it. */
export function releaseLock(): void {
  const store = storage();
  if (store) release(store, TAB_ID);
}

export const useFlamelings = create<FlamelingsStore>((set, get) => {
  /** Loads the latest stored save (another tab may have changed it). */
  function adoptStored(): void {
    const t = now();
    const loaded = loadSaveResult(t);
    canWrite = loaded.writable;
    lastRaw = readRaw();
    const { save } = settle(loaded.save, t, get().holding);
    set({ save, clock: t, outdated: loaded.newer });
  }

  /**
   * Saves, unless another tab wrote since we last looked (then its copy wins,
   * is adopted and false is returned). A tab that could not read the save
   * plays on in memory without writing.
   */
  function persist(save: SaveData): boolean {
    if (!canWrite || get().locked) return true;
    if (readRaw() !== lastRaw) {
      adoptStored();
      return false;
    }
    if (writeSave(save)) lastRaw = readRaw();
    return true;
  }

  /** Applies a pet change, saves, queues cards and reports analytics. */
  function commit(petId: string, outcome: Outcome): PetEvent[] {
    const t = now();
    const { save } = get();
    const pets = save.pets.map((p) => (p.id === petId ? outcome.pet : p));
    const next: SaveData = { ...save, pets, updatedAt: t };
    const cards = celebrationsFrom(petId, outcome.events);
    if (!persist(next)) return [];
    trackEvents(outcome.events);
    playEventSounds(outcome.events);
    set((s) => ({
      save: next,
      clock: t,
      celebrations: [...s.celebrations, ...cards],
      lastEvents: { id: ++eventId, petId, events: outcome.events },
    }));
    return outcome.events;
  }

  function petOf(petId: string): Pet | undefined {
    return get().save.pets.find((p) => p.id === petId);
  }

  /** Runs an action after bringing time up to date. */
  function act(
    petId: string,
    run: (pet: Pet, t: number) => Outcome
  ): PetEvent[] {
    get().tick();
    const pet = petOf(petId);
    if (!pet) return [];
    return commit(petId, run(pet, now()));
  }

  return {
    ready: false,
    locked: false,
    outdated: false,
    save: emptySave(0),
    clock: 0,
    view: { screen: "shelf" },
    celebrations: [],
    holding: null,
    lastEvents: null,

    init() {
      const t = now();
      const store = storage();
      if (store && heldByOther(store, TAB_ID, Date.now())) {
        set({ ready: true, locked: true });
        return;
      }
      if (store) acquire(store, TAB_ID, Date.now());
      const loaded = loadSaveResult(t);
      canWrite = loaded.writable;
      lastRaw = readRaw();
      const { save, events } = settle(loaded.save, t, get().holding);
      if (canWrite && writeSave(save)) lastRaw = readRaw();
      // A pet from an older save that is already a Blaze grows up on load.
      const cards = events.flatMap((e) =>
        e.event.type === "evolve" ? celebrationsFrom(e.petId, [e.event]) : []
      );
      trackEvents(
        events.map((e) => e.event).filter((e) => e.type === "evolve")
      );
      set({
        celebrations: cards,
        ready: true,
        locked: false,
        outdated: loaded.newer,
        save,
        clock: t,
      });
      if (!visited) {
        visited = true;
        trackVisit(save.pets.length, t);
      }
    },

    heartbeat() {
      const store = storage();
      if (!store || get().locked) return;
      if (!acquire(store, TAB_ID, Date.now())) set({ locked: true });
    },

    takeOver() {
      const store = storage();
      if (store) acquire(store, TAB_ID, Date.now(), true);
      set({ locked: false });
      adoptStored();
    },

    onStorage(key) {
      const store = storage();
      if (!store || !get().ready) return;
      if (key === LOCK_KEY) {
        const lock = readLock(store);
        if (!get().locked && lock && lock.id !== TAB_ID) set({ locked: true });
      } else if (key === SAVE_KEY && !get().locked) {
        adoptStored();
      }
    },

    tick() {
      if (get().locked) return;
      const t = now();
      const { save, events } = settle(get().save, t, get().holding);
      if (!persist(save)) return;
      trackEvents(events.map((e) => e.event));
      playEventSounds(events.map((e) => e.event));
      // A pet from an older save that is already a Blaze grows up on load.
      const cards = events.flatMap((e) =>
        e.event.type === "evolve" ? celebrationsFrom(e.petId, [e.event]) : []
      );
      set((s) => ({
        save,
        clock: t,
        celebrations: [...s.celebrations, ...cards],
      }));
      const { view } = get();
      if (
        view.screen === "pet" &&
        !save.pets.some((p) => p.id === view.petId)
      ) {
        set({ view: { screen: "shelf" } });
      }
    },

    go(view) {
      set({ view });
    },

    hatch(name, look) {
      get().tick();
      const { save } = get();
      if (get().locked || save.pets.length >= MAX_PETS) return null;
      const id = newId();
      const t = now();
      const next = hatchAction(save, {
        id,
        name: cleanName(name) || "Flameling",
        look,
        now: t,
      });
      if (!persist(next)) return null;
      trackHatch();
      set({ save: next, clock: t });
      return id;
    },

    feed: (petId, food) => act(petId, (pet, t) => feedAction(pet, food, t)),
    clean: (petId) => act(petId, (pet, t) => cleanAction(pet, t)),
    finishPlay(petId, game, score) {
      trackPlayEnd(game, score);
      return act(petId, (pet, t) => finishPlay(pet, score, t));
    },
    emote(petId) {
      const pet = petOf(petId);
      if (pet) commit(petId, emoteAction(pet));
    },
    tapPet: (petId) => act(petId, (pet, t) => tapAction(pet, t)),
    openGift: (petId) => act(petId, (pet, t) => openGiftAction(pet, t)),

    dress(petId, slot, id) {
      const pet = petOf(petId);
      if (pet) commit(petId, { pet: dressAction(pet, slot, id), events: [] });
    },
    buy: (petId, key) => act(petId, (pet, t) => buyAction(pet, key, t)),
    markHappeningSeen: (petId) =>
      act(petId, (pet, t) => markSeenAction(pet, t)),
    completeHappening: (petId, happening, result) =>
      act(petId, (pet, t) =>
        completeHappeningAction(pet, t, Math.random, result, happening)
      ),
    hold: (holding) => set({ holding }),
    collectWish: (petId) => act(petId, (pet, t) => collectWishAction(pet, t)),
    setDecor(petId, id, on) {
      const pet = petOf(petId);
      if (pet) commit(petId, { pet: setDecorAction(pet, id, on), events: [] });
    },
    restyle(petId, look) {
      const pet = petOf(petId);
      if (pet) commit(petId, { pet: restyleAction(pet, look), events: [] });
    },

    dismissCelebration() {
      set((s) => ({ celebrations: s.celebrations.slice(1) }));
    },
  };
});
