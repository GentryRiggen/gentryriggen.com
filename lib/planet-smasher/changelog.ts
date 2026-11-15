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
    version: "1.2.0",
    date: "2026-11-14",
    title: "Monsters and trophies!",
    highlights: [
      "Four new tools: Giant monster, Tsunami, Sun dive and Planet collision",
      "Two new endings: a planet can be vaporized by the Sun, or burst apart in a crash",
      "Endings now play in slow motion so you can watch every second",
      "Rocks are left orbiting the planet after a big smash",
      "A trophy shelf with 20 trophies to win, each worth bonus stars",
      "More stars to earn, with new unlocks all the way up to 20,000",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-11-14",
    title: "Alien invasion!",
    highlights: [
      "Six new tools: Twin nuke, Nuke rain, UFO swarm, Gravity beam, Nanobot swarm and the Mothership",
      "The new Consumed ending turns a planet into a metal ball",
      "Smash fast to get COMBO bonus stars",
      "More stars to earn, with new unlocks all the way up to 13,000",
    ],
  },
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
