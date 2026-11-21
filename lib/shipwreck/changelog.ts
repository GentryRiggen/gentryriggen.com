/**
 * What changed in each Shipwreck release, newest first. Shown on the Versions
 * page.
 *
 * Every bump of SHIPWRECK_VERSION needs a new entry at the top (a test
 * enforces it), in plain words a young player or their parent would follow.
 * 0.1.0 is a coming-soon page so the game can be pinned to a home screen;
 * 1.0.0 is the first playable release.
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
    version: "0.1.0",
    date: "2026-11-21",
    title: "Coming soon",
    highlights: [
      "Shipwreck has a home! Add it to your home screen now; the game itself is being built",
      "The first ship will be the Titanic, sinking the way a real ship sinks as the water comes in",
      "When the game is ready, a button will pop up here to load it",
    ],
  },
];
