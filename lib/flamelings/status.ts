import {
  EMOTES,
  LABELS,
  levelFor,
  parseUnlockKey,
  unlockKey,
  type EmoteId,
  type UnlockKey,
} from "./catalog";
import { hasGiftWaiting } from "./progress";
import { isAwake } from "./sim";
import type { Pet } from "./types";

export interface StateGlyph {
  glyph: string;
  label: string;
}

/** The little icon on a shelf card, in order: ember, gift, asleep, hungry. */
export function stateGlyph(pet: Pet, nowMs: number): StateGlyph | null {
  if (pet.state === "ember") return { glyph: "🔸", label: "Ember" };
  if (hasGiftWaiting(pet, nowMs)) return { glyph: "🎁", label: "Gift waiting" };
  if (!isAwake(nowMs)) return { glyph: "💤", label: "Asleep" };
  if (pet.fuel < 30) return { glyph: "🍽", label: "Hungry" };
  return null;
}

/** The emotes this pet can do. */
export function emotesOf(pet: Pet): EmoteId[] {
  return EMOTES.filter((id) => pet.unlocked.includes(unlockKey("emote", id)));
}

export function labelOf(key: UnlockKey): string {
  const parsed = parseUnlockKey(key);
  if (!parsed) return "";
  return LABELS[parsed.id] ?? parsed.id[0].toUpperCase() + parsed.id.slice(1);
}

/** Items this far off are shown as a present to hope for, not a level. */
export const FAR_LEVEL = 24;

/** What a locked item says: its level, or "Gift" when it is a long way off. */
export function lockText(key: UnlockKey): string {
  const level = levelFor(key);
  return level === null || level > FAR_LEVEL ? "Gift" : `Level ${level}`;
}

/** Fraction of care a pet needs: ash piles make the glade less tidy. */
export function tidiness(pet: Pet): number {
  return Math.max(0, 100 - pet.ash * 25);
}
