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
    version: "1.12.2",
    date: "2026-11-01",
    title: "Embers you can find",
    highlights: [
      "An Embers button with a little flame now sits next to Menu once you can start a world over. It shows how many embers are waiting for you",
      "The first time, a friendly card explains embers: start over any time, keep your embers, and spend them on permanent upgrades so every run goes faster",
      "The hub shows the embers and best time for each world, and the ending tells you how many embers your run earned",
      "The little arrows next to upgrade names no longer look like a picture that did not load on iPhones",
    ],
  },
  {
    version: "1.12.1",
    date: "2026-11-01",
    title: "More room for upgrades",
    highlights: [
      "On phones the picture is smaller, so there is much more room to scroll through upgrades",
      "The coin bar sits a little lower, clear of the blur under the clock on iPhones",
      "The next-goal bar only shows once, in the coin bar, and the out-of-oil warning is a small chip beside your coins",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-11-01",
    title: "Story intros, and your coins always in sight",
    highlights: [
      "Every part now opens with an intro: where you are, what you are doing and why it matters, with your goal. Tap Listen to hear it read aloud",
      "The story moved out of the way. The newest line sits near the top, and the Story button opens the whole story, including every intro, any time",
      "Your coins, income and next goal now stay pinned at the top of the screen all the time, and they never move around",
    ],
  },
  {
    version: "1.11.1",
    date: "2026-11-01",
    title: "Clearer Someday cards, and an out-of-oil warning",
    highlights: [
      "When the lamp runs out of oil, a red warning shows at the top and on the page, and the lamp in the picture goes dim, so you know to buy oil",
      "When a Someday card's goal is already met, it now says it is ready and pops in when you buy one of the upgrades above, instead of showing a goal you already reached",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-11-01",
    title: "The Memory Garden",
    highlights: [
      "The Last Light has a Memory Garden. Every light you let go plants a seed named after it: Porch lights, Harbor lamps, Moon mirror and more",
      "The seeds sprout, bud and bloom on their own. Water the garden to help them grow faster",
      "Pick the blooms for a little warm light: resolve, and a lift for the lantern's flame. Flowers wait for you and never wilt",
      "A rain barrel waters the thirsty ones now and then, on top of your own watering",
      "The Logbook keeps a Keepsakes list of every memory flower you have picked",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-11-01",
    title: "Probe Races",
    highlights: [
      "The Sky has Probe Races once you buy Star charts. Pick a route on the star map, launch, and watch your probe fly it",
      "Short hop, long loop or comet chase. Every card shows its time and haul up front, and the comet chase pays more when the comet is close",
      "Your probe waits at the dock until you launch again, and ignoring it costs nothing",
      "Racing fins make every run faster, and Mission control sends a scout probe out on its own, on top of your own runs",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-11-01",
    title: "The Tide Clock",
    highlights: [
      "The Coast has a Tide Clock once you open the fish market. The sea rises and falls on its own, about every three minutes",
      "Set the nets before high tide, then haul in a catch of coins. Setting them early catches more. Full nets wait for you forever, and ignoring the tide costs nothing",
      "Bigger nets catch more, and a tide mill brings in a little extra every high tide on top of your own catch",
      "Watch the tide pole and buoys in the picture rise and fall, with a splash when you haul in",
      "Coast upgrades cost a little more now, to make room for the tide's extra coins",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-11-01",
    title: "The Weather Desk",
    highlights: [
      "No More Night has a Weather Desk. Every few minutes a storm forms on its own, and the forecast shows the chance it hits Rivertown, Hilltop or Harbor",
      "Shield a town with sandbags. If the storm lands there, you get a burst of bonus power. If it misses, the lights just flicker. You never lose anything, and you can ignore it",
      "Storm crews let you shield two towns, and sandbags appear along the coast",
      "A weather vane can watch the sky for you later on",
      "Thunder rumbles at landfall, and the Logbook keeps a storm tally",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-11-01",
    title: "See every upgrade land",
    highlights: [
      "Every upgrade now shows up in the picture, and a little label pops up right where it landed",
      "A caption in the corner tells you what you are looking at: ships guided, cities lit, collectors, lights still burning",
      "No More Night: real power plants, a puffing steam plant, a dam, and power racing along the wires to glowing cities. When the grid runs short, the far cities flicker",
      "The Coast gets far lighthouses, docks, an oil depot that fills up, rescue boats and coins on every ship",
      "The Sky gets bigger mirrors, relay rings, star charts, probe copies and a light sail",
      "The Last Light shows each light going dark as you let it go",
      "The game now notices updates while it stays open, so the Update ready button appears on its own",
    ],
  },
  {
    version: "1.6.1",
    date: "2026-11-01",
    title: "Play along with your podcast",
    highlights: [
      "The game's music and sounds now play alongside your podcast or music instead of stopping it. Like most games, they follow the silent switch",
      "With music and sound both off, the game never touches your audio at all",
      "When the power bar slides down from the top, the picture shrinks to fit underneath it, so nothing is hidden",
      "On iPad the power bar no longer covers the top of the page; it only slides in once the coins scroll away",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-11-01",
    title: "Visitors, a steady glow, and your own lantern",
    highlights: [
      "Visitors stop by now: a mail boat, whale-watchers, the town fair, a comet and a strange signal. They wait for you, bring a small gift, and go in the Logbook in the Menu. Nothing can be missed",
      "Greyed Someday cards show what is coming and what unlocks it",
      "The Sky has a star countdown bar, with ticks where more relays wake up",
      "Steady glow: keep the grid or the fleet steady and the cities sparkle and the probes fly in formation, paying 15% more. Letting them wobble just loses the bonus",
      "Sun collectors now come in six bigger steps, and a mirror field grows on the ground at three and six",
      "More little stories along the way, so there is always something new to read",
      "The Last Light: steering the boat true makes letting go go faster, and a low flame dims the night",
      "At the start of a game you pick a lantern colour. The very last little boat carries it home. It stays on your device",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-11-01",
    title: "More to juggle, and a new ending",
    highlights: [
      "No More Night: as cities light up, the grid gets wobbly. Tap Balance the grid to keep the lights steady",
      "The Sky: your probes drift off course. Send a course correction to keep them on track",
      "The evening rush and solar flares now wait for you. They stay until you take them, and nothing is lost if you wait",
      "One tap on Buy oil now fills your whole lamp-oil tank, or as much as your coins can buy",
      "Oil prices swing more, so buying low really pays off",
      "New upgrades fill the quiet stretches, and taking a star now pays energy right away",
      "The Last Light is new: the first ship that ever sailed past comes home. Let the lights go in any order, and each one leaves a gift",
      "When three lights are left, a small boat with one lantern appears on the dark sea. Tap the old beam to steer it, then flash the lamp once to bring it home",
    ],
  },
  {
    version: "1.4.1",
    date: "2026-11-01",
    title: "Sharper numbers",
    highlights: [
      "The coin counter at the top stays crisp while it climbs instead of looking fuzzy",
      "On the home screen, the game no longer slides under the clock and battery, so the top of the screen is never blurred",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-11-01",
    title: "Arcade mode",
    highlights: [
      "The whole game now has the glowing retro arcade look of the start screen",
      "The tap button sits in the middle at the bottom, right where your thumb is",
      "New parts of the story type themselves out like an old computer",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-11-01",
    title: "Retro all the way",
    highlights: [
      "The universe picker now looks like the start screen, with glowing pixel letters and game cartridges for each universe",
      "Music plays on the start screen. Tap anywhere to start it, and use the speaker button to turn it off",
      "The start screen sky follows the real time of day: sunrise, daytime, sunset and starry nights",
      "Turn on Match my weather to see rain, snow or sunshine like outside your window. If the weather cannot be found, you get clear skies",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-11-01",
    title: "The story, read aloud",
    highlights: [
      "Every story message can now be read aloud. When a new one arrives, tap Play to hear it",
      "Tap the play button next to any message to hear it again, and Listen at the start of each part",
      "Turn the voice on or off in the Menu, and choose whether new messages play by themselves",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-11-01",
    title: "Every upgrade counts",
    highlights: [
      "Fewer upgrades, and each one matters. New ones appear as your lighthouse grows, a few at a time",
      "Every upgrade tells you what it will do before you buy it, like Coins per second 25 to 30",
      "You buy the lamp oil yourself now. The price goes up and down, so buy when it is cheap! Later you can hire an oil merchant to do it for you",
      "Coins per second now shows what you really earn after paying for oil, and it glows green when it is climbing",
    ],
  },
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
