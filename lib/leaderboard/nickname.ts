/**
 * Kid-safe nicknames: "<Adjective> <Animal> <n>". The player can reroll but
 * never type one. firestore.rules inlines the same lists (a test keeps them
 * in sync), so only these words are ever accepted by the server.
 */
export const ADJECTIVES: readonly string[] = [
  "Happy",
  "Sunny",
  "Brave",
  "Clever",
  "Gentle",
  "Jolly",
  "Lucky",
  "Swift",
  "Bright",
  "Cheery",
  "Cosmic",
  "Fluffy",
  "Friendly",
  "Mighty",
  "Merry",
  "Nimble",
  "Plucky",
  "Quick",
  "Snappy",
  "Speedy",
  "Zippy",
  "Breezy",
  "Calm",
  "Cozy",
  "Daring",
  "Eager",
  "Fancy",
  "Glad",
  "Golden",
  "Grand",
  "Kind",
  "Lively",
  "Peppy",
  "Proud",
  "Silly",
  "Smiley",
  "Sparkly",
  "Steady",
  "Warm",
  "Witty",
];

export const ANIMALS: readonly string[] = [
  "Otter",
  "Panda",
  "Koala",
  "Puffin",
  "Fox",
  "Owl",
  "Bunny",
  "Duck",
  "Penguin",
  "Dolphin",
  "Turtle",
  "Falcon",
  "Eagle",
  "Robin",
  "Sparrow",
  "Hawk",
  "Seal",
  "Whale",
  "Llama",
  "Alpaca",
  "Badger",
  "Beaver",
  "Hedgehog",
  "Kitten",
  "Puppy",
  "Pony",
  "Lemur",
  "Gecko",
  "Parrot",
  "Toucan",
  "Walrus",
  "Wombat",
  "Squirrel",
  "Raccoon",
  "Giraffe",
  "Zebra",
  "Moose",
  "Bison",
  "Heron",
  "Swan",
];

/** A float in [0, 1) from the platform CSPRNG (Math.random as a fallback). */
export function cryptoRandom(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
}

export function randomNickname(rng: () => number = cryptoRandom): string {
  const pick = (items: readonly string[]): string =>
    items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  const n = 1 + Math.min(98, Math.floor(rng() * 99));
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${n}`;
}

export function isValidNickname(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const parts = s.split(" ");
  if (parts.length !== 3) return false;
  const [adjective, animal, number] = parts;
  return (
    ADJECTIVES.includes(adjective) &&
    ANIMALS.includes(animal) &&
    /^[1-9][0-9]?$/.test(number)
  );
}
