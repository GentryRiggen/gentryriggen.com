/**
 * What changed in each Flamelings release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of FLAMELINGS_VERSION needs a new entry at the top (a test
 * enforces it), in plain words a young player or their parent would follow.
 */
export interface Release {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: readonly Release[] = [
  {
    version: "1.0.0",
    date: "2026-11-16",
    title: "Hello, little flame!",
    highlights: [
      "Hatch your own flameling: tap the egg, give it a name and pick how it looks",
      "Feed it twigs, pinecones, logs and marshmallows, and tap the ash piles to clean up",
      "Play Firefly Catch to cheer it up and earn XP",
      "Your flameling grows through levels, and every level unlocks something new: hats, glasses, colours, shapes, eyes, emotes and foods",
      "A present shows up each morning and evening with a surprise inside",
      "Dress it up and make it laugh, dance, spin and more",
      "It sleeps at night, so nothing gets hungry while you are in bed",
      "If you forget it for a few days it turns into a sleepy ember. Feed it three times to light it back up!",
      "Soft, cute sounds: chirps, chomps, sparkles and a little whoosh when an ember lights back up. Tap the speaker to turn them off",
      "If a new version is ready, a button pops up so you can update with one tap",
      "Keep up to 8 flamelings on your shelf. Everything you unlock is shared with new hatchlings",
    ],
  },
];
