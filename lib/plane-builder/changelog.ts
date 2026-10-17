/**
 * What changed in each Plane Builder release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of PLANE_BUILDER_VERSION needs a new entry at the top (a test
 * enforces it). Write the notes from the release's commits
 * (`git log <previous release>..HEAD -- lib/plane-builder components/plane-builder app/plane-builder`),
 * in plain words a young pilot or their parent would follow.
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
    version: "1.3.0",
    date: "2026-10-17",
    title: "Timing games",
    highlights: [
      "From the Garden spring level, the slingshot has a timing bar that slides back and forth: let go in the green for a big boost, yellow is a normal launch, and red is a weaker one",
      "After every flight, stop the coin bar to win up to double coins (green is double, yellow is one and a half, red is the usual amount, so you never get fewer coins)",
      "Prices went up a bit to match the extra coins",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-17",
    title: "More to do in every flight",
    highlights: [
      "Everyone starts fresh in 1.2, so the new prices and prizes are fair for all (your old save is kept as a copy)",
      "Boost rings give your plane a burst of speed, and some come in chains you can fly straight through",
      "Fuel cans float in the sky: fly through one with an engine plane to top up your tank",
      "You can see the updrafts now, so you know where the air will lift you",
      "Flags at the quarter, halfway and three-quarter marks pay a bonus the first time you reach them, and distance signs show how far you've gone",
      "Land your plane safely for a landing bonus",
      "New obstacle courses to fly through: the Barn gate and Balloon arch in the Meadow, the Arch gauntlet and Updraft climb in the Canyon, and Twin peaks and Before the pass in the Mountains",
      "Gentler starts: some obstacles now have ramps you can glide over",
      "Planes without fuel come down sooner, and landings are easier, so you spend less time gliding and more time flying",
      "Upgrade prices were rebalanced in the Canyon and the Mountains, and the Meadow engine goes a bit faster",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-17",
    title: "Faster flights",
    highlights: [
      "Flights play faster, so each try takes less time",
      "The air gets thin up high: planes can't climb much above the treetops any more, so flying really high and gliding forever no longer works",
      "A speedometer shows how fast you're going, and turns red when you're about to run out of speed",
      "The coin counter in the air now shows all your coins, plus the ones you grab on this flight",
      "After every flight you land back in the hangar, with how you did at the top, ready to upgrade",
      "Your plane now leans the way it's turning, like a real plane",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-11",
    title: "Plane Builder takes off",
    highlights: [
      "Pull back the slingshot, aim, and let go to launch your plane",
      "Steer in the air with your finger, mouse or keyboard to dodge trees and barns",
      "Grab coins and fly through rings to earn more each flight",
      "Spend your coins on upgrades: a stronger slingshot, wings, an engine, fuel, a tougher body and a coin boost",
      "Every upgrade gives your plane a new part you can see in the hangar",
      "Three worlds to beat: the Backyard Meadow, the Desert Canyon and the Snowy Mountains, each with its own planes",
      "Reach the finish line to unlock the next world",
      "Replay a world you finished, or Restart it to try again from scratch (it always asks first)",
      "Sound effects and an engine hum, with a button to turn the sound off",
      "Your game saves on its own, so you can come back and keep flying",
    ],
  },
];
