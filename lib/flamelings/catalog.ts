/**
 * Everything a flameling can look like, wear, say or eat, plus the fixed
 * order in which level-ups hand items out.
 */

export const COLOURS = [
  "ember",
  "sky",
  "lime",
  "rose",
  "gold",
  "aqua",
  "violet",
  "ash",
] as const;
export const SHAPES = ["flame", "drop", "puff", "spark"] as const;
export const EYES = ["round", "wide", "sharp", "sleepy", "dots"] as const;
export const HATS = [
  "party",
  "crown",
  "wizard",
  "tophat",
  "beanie",
  "cowboy",
  "propeller",
  "viking",
  "flower",
] as const;
export const FACES = [
  "sunglasses",
  "glasses",
  "monocle",
  "mustache",
  "starCheeks",
] as const;
export const NECKS = ["bowtie", "scarf", "medal"] as const;
export const EMOTES = [
  "love",
  "laugh",
  "dance",
  "spin",
  "wow",
  "sleepy",
  "grumpy",
  "sparkle",
] as const;
export const FOODS = [
  "twig",
  "pinecone",
  "log",
  "marshmallow",
  "coal",
] as const;

export type ColourId = (typeof COLOURS)[number];
export type ShapeId = (typeof SHAPES)[number];
export type EyesId = (typeof EYES)[number];
export type HatId = (typeof HATS)[number];
export type FaceId = (typeof FACES)[number];
export type NeckId = (typeof NECKS)[number];
export type EmoteId = (typeof EMOTES)[number];
export type FoodId = (typeof FOODS)[number];

export type UnlockKind =
  "colour" | "shape" | "eyes" | "hat" | "face" | "neck" | "emote" | "food";

export const UNLOCK_KINDS: readonly UnlockKind[] = [
  "colour",
  "shape",
  "eyes",
  "hat",
  "face",
  "neck",
  "emote",
  "food",
];

const IDS: Record<UnlockKind, readonly string[]> = {
  colour: COLOURS,
  shape: SHAPES,
  eyes: EYES,
  hat: HATS,
  face: FACES,
  neck: NECKS,
  emote: EMOTES,
  food: FOODS,
};

/** An item as one string, e.g. `hat:crown`. Saved as-is. */
export type UnlockKey = `${UnlockKind}:${string}`;

export function unlockKey(kind: UnlockKind, id: string): UnlockKey {
  return `${kind}:${id}`;
}

export function parseUnlockKey(
  key: unknown
): { kind: UnlockKind; id: string } | null {
  if (typeof key !== "string") return null;
  const at = key.indexOf(":");
  if (at < 0) return null;
  const kind = key.slice(0, at) as UnlockKind;
  const id = key.slice(at + 1);
  return IDS[kind]?.includes(id) ? { kind, id } : null;
}

export function isUnlockKey(key: unknown): key is UnlockKey {
  return parseUnlockKey(key) !== null;
}

export const STARTING_UNLOCKS: readonly UnlockKey[] = [
  "colour:ember",
  "colour:sky",
  "colour:lime",
  "shape:flame",
  "eyes:round",
  "eyes:wide",
  "emote:love",
  "emote:dance",
  "food:twig",
  "food:pinecone",
  "food:log",
  "food:marshmallow",
];

/**
 * What each level-up hands out, in order: level 2 gets the first item still
 * locked, level 3 the next, and so on. Coal lands on level 4, as promised.
 */
export const UNLOCK_ORDER: readonly UnlockKey[] = [
  "hat:party",
  "colour:rose",
  "food:coal",
  "emote:laugh",
  "hat:beanie",
  "face:sunglasses",
  "shape:drop",
  "colour:gold",
  "emote:wow",
  "neck:bowtie",
  "hat:crown",
  "eyes:sharp",
  "emote:spin",
  "face:starCheeks",
  "colour:aqua",
  "hat:propeller",
  "neck:scarf",
  "shape:puff",
  "emote:sparkle",
  "face:glasses",
  "hat:wizard",
  "eyes:dots",
  "emote:sleepy",
  "colour:violet",
  "hat:flower",
  "face:mustache",
  "shape:spark",
  "hat:cowboy",
  "emote:grumpy",
  "neck:medal",
  "hat:tophat",
  "eyes:sleepy",
  "face:monocle",
  "hat:viking",
  "colour:ash",
];

/** The level that hands out an item, or null if only gifts give it. */
export function levelFor(key: UnlockKey): number | null {
  const at = UNLOCK_ORDER.indexOf(key);
  return at < 0 ? null : at + 2;
}

export const ALL_UNLOCKS: readonly UnlockKey[] = UNLOCK_KINDS.flatMap((kind) =>
  IDS[kind].map((id) => unlockKey(kind, id))
);

export const FOOD_INFO: Record<
  FoodId,
  { fuel: number; joy: number; label: string }
> = {
  twig: { fuel: 15, joy: 0, label: "Twig" },
  pinecone: { fuel: 25, joy: 5, label: "Pinecone" },
  log: { fuel: 40, joy: 0, label: "Log" },
  marshmallow: { fuel: 5, joy: 15, label: "Marshmallow" },
  coal: { fuel: 60, joy: 0, label: "Coal" },
};

export const LABELS: Record<string, string> = {
  party: "Party hat",
  crown: "Crown",
  wizard: "Wizard hat",
  tophat: "Top hat",
  beanie: "Beanie",
  cowboy: "Cowboy hat",
  propeller: "Propeller cap",
  viking: "Viking helmet",
  flower: "Flower",
  sunglasses: "Sunglasses",
  glasses: "Round glasses",
  monocle: "Monocle",
  mustache: "Mustache",
  starCheeks: "Star cheeks",
  bowtie: "Bow tie",
  scarf: "Scarf",
  medal: "Medal",
  love: "Love",
  laugh: "Laugh",
  dance: "Dance",
  spin: "Spin",
  wow: "Wow",
  sleepy: "Sleepy",
  grumpy: "Grumpy",
  sparkle: "Sparkle",
};

export const EMOTE_GLYPH: Record<EmoteId, string> = {
  love: "💖",
  laugh: "😆",
  dance: "💃",
  spin: "🌀",
  wow: "😮",
  sleepy: "😴",
  grumpy: "😠",
  sparkle: "✨",
};

export const FOOD_GLYPH: Record<FoodId, string> = {
  twig: "🌿",
  pinecone: "🌰",
  log: "🪵",
  marshmallow: "🍡",
  coal: "⚫",
};

export const MAX_NAME_LENGTH = 12;

/** Friendly names for the dice button; every one fits in 12 characters. */
export const RANDOM_NAMES: readonly string[] = [
  "Ember",
  "Sparky",
  "Toasty",
  "Blaze",
  "Cinder",
  "Flicker",
  "Pip",
  "Waffles",
  "Biscuit",
  "Marshmallow",
  "Sunny",
  "Poppy",
  "Nugget",
  "Zippy",
  "Cocoa",
  "Pebble",
  "Mochi",
  "Glimmer",
  "Bumble",
  "Tinker",
  "Ziggy",
  "Noodle",
  "Sprout",
  "Twinkle",
  "Jelly",
  "Pickle",
  "Muffin",
  "Fizz",
  "Wiggles",
  "Sizzle",
];

export function randomName(random: () => number = Math.random): string {
  return RANDOM_NAMES[Math.floor(random() * RANDOM_NAMES.length)];
}

/** Trims and shortens whatever a child typed into a legal name. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}
