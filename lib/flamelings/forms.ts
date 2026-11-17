import { seededRandom } from "./happenings";
import type { CareStats, FormId } from "./types";

/** The grown-up forms a pet picks at Blaze (level 10), from how it was cared for. */
export const FORMS: readonly FormId[] = ["cozy", "wild", "sparkly"];

export interface FormInfo {
  id: FormId;
  name: string;
  /** The icon on the name card and next to the level. */
  glyph: string;
  /** One short line for the name card. */
  blurb: string;
}

export const FORM_INFO: Record<FormId, FormInfo> = {
  cozy: {
    id: "cozy",
    name: "Cozy",
    glyph: "🧡",
    blurb: "Warm, soft and full of love",
  },
  wild: {
    id: "wild",
    name: "Wild",
    glyph: "⚡",
    blurb: "Bold, fast and crackling",
  },
  sparkly: {
    id: "sparkly",
    name: "Sparkly",
    glyph: "🌈",
    blurb: "Shimmery and full of stars",
  },
};

/** The level a pet grows up at (the start of the Blaze stage). */
export const FORM_LEVEL = 10;

export const NO_CARE: CareStats = {
  feeds: 0,
  cleans: 0,
  plays: 0,
  pets: 0,
  styles: 0,
};

/** Counters stay small whole numbers. */
export const MAX_CARE_COUNT = 9999;

export function bumpCare(care: CareStats, key: keyof CareStats): CareStats {
  return { ...care, [key]: Math.min(MAX_CARE_COUNT, care[key] + 1) };
}

/**
 * How strongly each form was earned. Feeding and cleaning are needed every
 * day whatever the child likes, so they count for half as much as the things
 * a child does by choice (playing; petting, emotes and dress-ups).
 */
export function formScores(care: CareStats): Record<FormId, number> {
  return {
    cozy: (care.feeds + care.cleans) / 2,
    wild: care.plays,
    sparkly: care.pets + care.styles,
  };
}

/**
 * Picks the form for a pet from what it did most. A tie (including every
 * count being zero) is settled by a seeded pick on the pet id, so the same
 * pet always gets the same answer.
 */
export function pickForm(care: CareStats, petId: string): FormId {
  const scores = formScores(care);
  const best = Math.max(scores.cozy, scores.wild, scores.sparkly);
  const tied = FORMS.filter((f) => scores[f] === best);
  if (tied.length === 1) return tied[0];
  return tied[Math.floor(seededRandom(`form|${petId}`)() * tied.length)];
}

export function isFormId(v: unknown): v is FormId {
  return typeof v === "string" && (FORMS as readonly string[]).includes(v);
}
