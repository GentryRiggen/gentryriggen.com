import { useFlamelings } from "../store";
import type { Friend, Pet } from "../types";
import { MAX_FRIENDS } from "../types";
import { cardOf, generateCode, isCode } from "./card";
import {
  createVisit,
  deleteVisit,
  getCard,
  listVisits,
  registerCard,
  type CardLookup,
  type OnlineDeps,
} from "./client";
import { CardSync } from "./sync";

/**
 * The glue between the game's store and the network: claiming a code,
 * looking up a friend, leaving and collecting visits, keeping the card
 * current. Everything resolves (never throws) so the screens never break
 * when the network does.
 */

let deps: OnlineDeps = {};
let lastCollect = 0;

/** Test hook: the fetch, session and URL the calls use. */
export function setOnlineDeps(next: OnlineDeps): void {
  deps = next;
  lastCollect = 0;
}

const sync = new CardSync(() => deps);
const pending = new Map<string, Promise<boolean>>();

const petOf = (petId: string): Pet | undefined =>
  useFlamelings.getState().save.pets.find((p) => p.id === petId);

/**
 * Makes sure the pet's card exists online under a code of its own. True when
 * it does (now or already), false when offline or signed out.
 */
export function ensureCode(petId: string): Promise<boolean> {
  const pet = petOf(petId);
  if (!pet) return Promise.resolve(false);
  if (pet.online.code) return Promise.resolve(true);
  const running = pending.get(petId);
  if (running) return running;
  const attempt = (async () => {
    const card = cardOf(pet);
    const code = await registerCard(card, generateCode, deps);
    if (!code) return false;
    // The pet may have been given a code or removed while we waited.
    if (!petOf(petId) || petOf(petId)?.online.code) return false;
    sync.created(code, card);
    useFlamelings.getState().registerCode(petId, code);
    return true;
  })().finally(() => pending.delete(petId));
  pending.set(petId, attempt);
  return attempt;
}

/** The pet a friend code belongs to, for the preview before adding. */
export function lookupFriend(code: string): Promise<CardLookup> {
  return getCard(code, deps);
}

/** Adds a looked-up friend to a pet's list. False when the list refused it. */
export function addFriend(petId: string, friend: Friend): boolean {
  const pet = petOf(petId);
  if (!pet || pet.online.friends.length >= MAX_FRIENDS) return false;
  const events = useFlamelings.getState().addFriend(petId, friend);
  return events.length > 0;
}

/** Brings every friend's cached look up to date (quietly, best effort). */
export async function refreshFriends(petId: string): Promise<void> {
  const friends = petOf(petId)?.online.friends ?? [];
  await Promise.all(
    friends.map(async (friend) => {
      const found = await getCard(friend.code, deps);
      if (found.kind === "found") {
        useFlamelings
          .getState()
          .refreshFriend(petId, { code: friend.code, card: found.card });
      }
    })
  );
}

/**
 * Finishes a playdate at the pet's glade: pays once per friend per window
 * and leaves the friend a visit. Returns whether it paid.
 */
export async function finishPlaydate(
  petId: string,
  friendCode: string
): Promise<boolean> {
  const events = useFlamelings.getState().playdate(petId, friendCode);
  if (events.length === 0) return false;
  const code = petOf(petId)?.online.code;
  if (code) await createVisit(code, friendCode, deps);
  return true;
}

let collecting = false;
/** Opening the game or coming back checks the inbox at most this often. */
export const COLLECT_EVERY_MS = 60_000;

/**
 * Reads each coded pet's inbox. A visit from a friend pays and shows a card;
 * a visit from anyone else is deleted without a word. A visit pays only after
 * it was deleted, so it cannot pay twice.
 */
export async function collectVisits(force = false): Promise<void> {
  const at = Date.now();
  if (collecting || (!force && at - lastCollect < COLLECT_EVERY_MS)) return;
  collecting = true;
  lastCollect = at;
  try {
    const coded = useFlamelings
      .getState()
      .save.pets.flatMap((p) =>
        p.online.code ? [{ id: p.id, code: p.online.code }] : []
      );
    for (const { id, code } of coded) {
      if (!isCode(code)) continue;
      const visits = await listVisits(code, deps);
      for (const visit of (visits ?? []).slice(0, 25)) {
        const gone = await deleteVisit(code, visit.id, deps);
        if (gone) useFlamelings.getState().receiveVisit(id, visit.from);
      }
    }
  } finally {
    collecting = false;
  }
}

/** Starts keeping cards current; returns a stop function. */
export function startOnlineSync(): () => void {
  sync.observe(useFlamelings.getState().save.pets);
  const unsubscribe = useFlamelings.subscribe((state, previous) => {
    if (state.save.pets !== previous.save.pets) sync.observe(state.save.pets);
  });
  return () => {
    unsubscribe();
    sync.dispose();
  };
}
