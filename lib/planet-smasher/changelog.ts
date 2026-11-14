/**
 * What changed in each Planet Smasher release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of PLANET_SMASHER_VERSION needs a new entry at the top (a test
 * enforces it), in plain words a young smasher or their parent would follow.
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
    date: "2026-11-14",
    title: "Planet Smasher is here!",
    highlights: [
      "Pick a planet and smash it with 10 tools, from asteroids all the way to a black hole",
      "Every hit leaves its mark on the planet, and the number of people rolls down",
      "There are four different ways for a planet to end",
      "Earn stars to unlock new tools and new planets, like Mars and Frostia",
      "Works offline once you add it to your home screen",
    ],
  },
];
