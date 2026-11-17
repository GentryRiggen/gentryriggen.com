import { COLOURS, EYES, FACES, HATS, NECKS, SHAPES } from "../catalog";
import { FORMS } from "../forms";
import { STAGES, stageFor } from "../progress";
import type { CardLook, Friend, Pet, PetCard } from "../types";
import { isNameId, onlineNameIdFor } from "./names";

/**
 * Friend codes: 6 characters from an alphabet with no 0 O 1 I L, so a code
 * read aloud or typed on a keypad cannot be mistaken. firestore.rules holds
 * the same alphabet in its code pattern (a test checks).
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function isCode(v: unknown): v is string {
  if (typeof v !== "string" || v.length !== CODE_LENGTH) return false;
  for (const ch of v) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** One uniformly random byte (never a modulo-biased pick). */
function randomByte(): number {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/** A fresh random code from the platform CSPRNG. */
export function generateCode(byte: () => number = randomByte): string {
  // 248 = 8 * 31: bytes above it would favour the first letters.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    const b = byte();
    if (b < limit) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return code;
}

/** What a pet shows its friends right now. */
export function cardOf(pet: Pet): PetCard {
  const nameId = isNameId(pet.online.nameId)
    ? pet.online.nameId
    : onlineNameIdFor(pet.name, pet.id);
  return {
    look: {
      ...pet.look,
      hat: pet.worn.hat ?? "none",
      face: pet.worn.face ?? "none",
      neck: pet.worn.neck ?? "none",
    },
    level: pet.level,
    stage: stageFor(pet.level).id,
    form: pet.form ?? "none",
    nameId,
  };
}

export function sameCard(a: PetCard, b: PetCard): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const oneOf = (list: readonly string[], v: unknown): v is string =>
  typeof v === "string" && list.includes(v);

/** A card read from anywhere, checked against the catalog; null if it is not one. */
export function parseCard(v: unknown): PetCard | null {
  if (typeof v !== "object" || v === null) return null;
  const c = v as Record<string, unknown>;
  const look = c.look as Record<string, unknown> | null;
  if (typeof look !== "object" || look === null) return null;
  const level = c.level;
  if (
    !oneOf(COLOURS, look.colour) ||
    !oneOf(SHAPES, look.shape) ||
    !oneOf(EYES, look.eyes) ||
    !(look.hat === "none" || oneOf(HATS, look.hat)) ||
    !(look.face === "none" || oneOf(FACES, look.face)) ||
    !(look.neck === "none" || oneOf(NECKS, look.neck)) ||
    typeof level !== "number" ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 99 ||
    !oneOf(
      STAGES.map((s) => s.id),
      c.stage
    ) ||
    !(c.form === "none" || oneOf(FORMS, c.form)) ||
    !isNameId(c.nameId)
  ) {
    return null;
  }
  return {
    look: {
      colour: look.colour as CardLook["colour"],
      shape: look.shape as CardLook["shape"],
      eyes: look.eyes as CardLook["eyes"],
      hat: look.hat as CardLook["hat"],
      face: look.face as CardLook["face"],
      neck: look.neck as CardLook["neck"],
    },
    level,
    stage: c.stage as PetCard["stage"],
    form: c.form as PetCard["form"],
    nameId: c.nameId,
  };
}

/** Parses a friend entry from a save: bad codes or cards drop the friend. */
export function parseFriend(v: unknown): Friend | null {
  if (typeof v !== "object" || v === null) return null;
  const f = v as Record<string, unknown>;
  if (!isCode(f.code)) return null;
  const card = parseCard(f.card);
  return card ? { code: f.code, card } : null;
}
