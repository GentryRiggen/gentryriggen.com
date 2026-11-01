/**
 * What changed in each Little Machines release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of LITTLE_MACHINES_VERSION needs a new entry at the top (a test
 * enforces it). Write the notes from the release's commits
 * (`git log <previous release>..HEAD -- lib/little-machines components/little-machines app/little-machines`),
 * in plain words a young player or their parent would follow.
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
    date: "2026-10-31",
    title: "Keep the Light On",
    highlights: [
      "Little Machines is here! Play a little machine with one simple job and watch how far it goes",
      "Your first universe is Keep the Light On: you run an old lighthouse. Tap the light, guide ships, earn coins and buy upgrades",
      "The game changes as you grow, and each new part plays differently from the last",
      "Your game saves on this device, and it pauses while the page is hidden",
      "Finish a universe to earn embers, then spend them on permanent upgrades for your next try",
    ],
  },
];
