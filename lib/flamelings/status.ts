import {
  EMOTES,
  LABELS,
  levelFor,
  parseUnlockKey,
  unlockKey,
  type EmoteId,
  type UnlockKey,
} from "./catalog";
import { FORM_INFO } from "./forms";
import { hasGiftWaiting, stageFor } from "./progress";
import { isAwake } from "./sim";
import type { FormId, Pet } from "./types";

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

/**
 * How faded a pet looks, 0 (healthy) to 4 (nearly out): mostly its glow, but
 * low fuel or joy dim it a little too, so a hungry pet already looks off.
 */
export function fadeLevel(pet: Pet): number {
  if (pet.state === "ember") return 0;
  const byGlow =
    pet.glow >= 85
      ? 0
      : pet.glow >= 65
        ? 1
        : pet.glow >= 45
          ? 2
          : pet.glow >= 25
            ? 3
            : 4;
  const low = Math.min(pet.fuel, pet.joy);
  const byNeeds = low < 10 ? 2 : low < 25 ? 1 : 0;
  return Math.max(byGlow, byNeeds);
}

export type Bubble = "food" | "play";

/** Thought bubbles for a hungry or bored pet (icon-only), when it is up. */
export function bubblesFor(pet: Pet, nowMs: number): Bubble[] {
  if (pet.state !== "alive" || !isAwake(nowMs)) return [];
  const bubbles: Bubble[] = [];
  if (pet.fuel < 25) bubbles.push("food");
  if (pet.joy < 25) bubbles.push("play");
  return bubbles;
}

export const BUBBLE_GLYPH: Record<Bubble, string> = { food: "🍽", play: "😢" };

/** The stage with its form in front, e.g. "Cozy Blaze" (just "Blaze" before it grows up). */
export function stageTitle(level: number, form: FormId | null): string {
  const stage = stageFor(level).name;
  return form ? `${FORM_INFO[form].name} ${stage}` : stage;
}

/** What the level bar and shelf card say: "Lv 12 · Cozy Blaze". */
export function levelLabel(level: number, form: FormId | null): string {
  return `Lv ${level} · ${stageTitle(level, form)}`;
}
