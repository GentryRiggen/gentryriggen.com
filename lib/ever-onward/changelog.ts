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
    version: "1.1.1",
    date: "2026-11-01",
    title: "Thumb button",
    highlights: [
      "The tap button now floats in the bottom corner, right under your thumb, wherever you scroll",
      "Fast tapping no longer zooms the page in by accident",
      "Music and sounds come back when you return to the game after switching apps",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-11-01",
    title: "A brand-new start screen",
    highlights: [
      "A brand-new start screen: a retro glowing title, a little robot with a lantern, and a big blinking START (or CONTINUE if you have played before)",
      "The look changes with the seasons. Right now the robot wears a tiny pumpkin hat. Come back in winter, spring and summer to see what it wears next",
      "Add Ever Onward to your home screen and it gets its own robot icon, and opens like a real app",
      "When a new version is ready, a button pops up so you can update. It never interrupts you while you play, and your game is saved first",
    ],
  },
  {
    version: "1.0.4",
    date: "2026-11-01",
    title: "Watch it grow",
    highlights: [
      "Your coins now stay at the top of the screen even when you scroll down to the upgrades, with a little button so you can keep tapping",
      "Numbers roll up smoothly and flash green when they jump",
      "See how much you earn every second",
      "A bar fills up toward your next upgrade and glows when you can buy it. Tap it to jump straight there",
    ],
  },
  {
    version: "1.0.3",
    date: "2026-11-01",
    title: "Sound and music",
    highlights: [
      "Ever Onward has sound! Every tap goes ting, and tapping fast makes the notes climb higher and higher",
      "Buying an upgrade, finding a new one and starting a new part all have their own sounds",
      "Calm music plays while you build, and it changes in each part of the story",
      "Music and sound effects each have their own switch next to the Menu button",
    ],
  },
  {
    version: "1.0.2",
    date: "2026-11-01",
    title: "Backup codes",
    highlights: [
      "New in the Menu: Backup code. Copy your code to keep your game safe, or paste it on another device to carry your progress over",
    ],
  },
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
