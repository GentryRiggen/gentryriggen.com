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
      "Smash a whole planet with asteroids, bombs, volcanoes and more",
      "Earn points for every hit and unlock bigger and better ways to wreck things",
      "Find all the different endings, from shattered to frozen to swallowed by a black hole",
    ],
  },
];
