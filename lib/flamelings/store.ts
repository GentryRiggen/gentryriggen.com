import { create } from "zustand";
import {
  clean as cleanAction,
  dress as dressAction,
  feed as feedAction,
  finishPlay,
  hatch as hatchAction,
  MAX_PETS,
  openGift as openGiftAction,
  restyle as restyleAction,
  settle,
  tapPet as tapAction,
  type DressSlot,
} from "./actions";
import { cleanName, type FoodId, type UnlockKey } from "./catalog";
import { now } from "./clock";
import { trackEvents, trackHatch, trackPlayEnd, trackVisit } from "./analytics";
import { emptySave } from "./actions";
import { loadSave, writeSave } from "./save";
import type { Look, Outcome, Pet, PetEvent, SaveData } from "./types";

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
  | { kind: "relit"; petId: string };

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
    } else if (event.type === "state" && event.to === "relit") {
      cards.push({ kind: "relit", petId });
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

export interface FlamelingsStore {
  ready: boolean;
  save: SaveData;
  /** The game clock as of the last tick or action. */
  clock: number;
  view: View;
  celebrations: Celebration[];
  /** Events of the last action, for the screen to react to (id bumps each). */
  lastEvents: { id: number; petId: string; events: PetEvent[] } | null;

  init(): void;
  tick(): void;
  go(view: View): void;
  hatch(name: string, look: Look): string | null;
  feed(petId: string, food: FoodId): PetEvent[];
  clean(petId: string): PetEvent[];
  finishPlay(petId: string, score: number): PetEvent[];
  tapPet(petId: string): PetEvent[];
  openGift(petId: string): PetEvent[];
  dress(petId: string, slot: DressSlot, id: string | null): void;
  restyle(petId: string, look: Partial<Look>): void;
  dismissCelebration(): void;
}

let eventId = 0;
let visited = false;

export const useFlamelings = create<FlamelingsStore>((set, get) => {
  /** Applies a pet change, saves, queues cards and reports analytics. */
  function commit(petId: string, outcome: Outcome): PetEvent[] {
    const t = now();
    const { save } = get();
    const pets = save.pets.map((p) => (p.id === petId ? outcome.pet : p));
    const next: SaveData = { ...save, pets, updatedAt: t };
    const cards = celebrationsFrom(petId, outcome.events);
    writeSave(next);
    trackEvents(outcome.events);
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
    save: emptySave(0),
    clock: 0,
    view: { screen: "shelf" },
    celebrations: [],
    lastEvents: null,

    init() {
      const t = now();
      const loaded = loadSave(t);
      const { save } = settle(loaded, t);
      writeSave(save);
      set({ ready: true, save, clock: t });
      if (!visited) {
        visited = true;
        trackVisit(save.pets.length, t);
      }
    },

    tick() {
      const t = now();
      const { save, events } = settle(get().save, t);
      writeSave(save);
      trackEvents(events.map((e) => e.event));
      set({ save, clock: t });
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
      if (save.pets.length >= MAX_PETS) return null;
      const id = newId();
      const t = now();
      const next = hatchAction(save, {
        id,
        name: cleanName(name) || "Flameling",
        look,
        now: t,
      });
      writeSave(next);
      trackHatch();
      set({ save: next, clock: t });
      return id;
    },

    feed: (petId, food) => act(petId, (pet, t) => feedAction(pet, food, t)),
    clean: (petId) => act(petId, (pet, t) => cleanAction(pet, t)),
    finishPlay(petId, score) {
      trackPlayEnd(score);
      return act(petId, (pet, t) => finishPlay(pet, score, t));
    },
    tapPet: (petId) => act(petId, (pet, t) => tapAction(pet, t)),
    openGift: (petId) => act(petId, (pet, t) => openGiftAction(pet, t)),

    dress(petId, slot, id) {
      const pet = petOf(petId);
      if (pet) commit(petId, { pet: dressAction(pet, slot, id), events: [] });
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
