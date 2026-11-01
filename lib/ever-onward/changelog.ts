/**
 * What changed in each Ever Onward release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of EVER_ONWARD_VERSION needs a new entry at the top (a test
 * enforces it). Write the notes from the release's commits
 * (`git log <previous release>..HEAD -- lib/ever-onward components/ever-onward app/ever-onward`),
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
    version: "1.0.1",
    date: "2026-10-31",
    title: "Ever Onward",
    highlights: [
      "The game is now called Ever Onward. Your saved game came along, so you keep your progress",
      "The old /little-machines link takes you to the new page",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-31",
    title: "Keep the Light On",
    highlights: [
      "Ever Onward is here! Each universe gives a little machine one simple job, and you see how far it goes",
      "The first universe is Keep the Light On: you run an old lighthouse. Tap to flash the light, guide ships, earn coins and buy upgrades",
      "There are four parts, and each one plays differently from the last. The game changes as your machine grows, so keep going to see what happens",
      "Finish a universe to earn embers, then spend them on permanent upgrades that make your next try faster",
      "Your game saves on this device. It pauses when you leave the page, so nothing is lost while you are away",
    ],
  },
];
