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
    version: "1.14.1",
    date: "2026-10-30",
    title: "Fairer leaderboards",
    highlights: [
      "The leaderboards now check that scores come from the real game, which helps keep cheaters off the top spots",
    ],
  },
  {
    version: "1.14.0",
    date: "2026-10-30",
    title: "Share your best times",
    highlights: [
      "After a flight or a Daily challenge, tap Share my time to send a picture card of your time, your world and your plane",
    ],
  },
  {
    version: "1.13.0",
    date: "2026-10-30",
    title: "Sounds, close calls, offline flying and puffier clouds",
    highlights: [
      "New sounds and music: the engine and wind change with your speed, there is a boost whoosh, a warning beep before a stall, a whoosh when your ghost passes, and a different tune for every world. Music and sound effects each have their own switch",
      "Close calls! Skim past a tree, tower or rock without touching it, and string close calls together for a combo that pays bonus coins",
      "Plane Builder now works without internet: visit once and you can keep flying offline, and the leaderboards tell you politely when you're offline",
      "Clouds are soft and puffy, and the canyon walls and arches look like real weathered red rock",
    ],
  },
  {
    version: "1.12.1",
    date: "2026-10-30",
    title: "Helping us make the game better",
    highlights: [
      "The game now counts a few things anonymously, like where planes crash and which worlds are hardest, so we can tune Plane Builder to be more fun. It never records names or anything about you",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-10-30",
    title: "Ghost planes and the daily challenge",
    highlights: [
      "Race your best! A glowing blue ghost of your fastest flight in each world flies along beside you, and a little readout tells you how far ahead or behind it you are",
      "There is a new Daily challenge every day: everyone gets the same world and the same twist (a tailwind, a headwind, double coins or no boost), and a countdown shows when the next one starts",
      "See your best time today, and check the Daily board to find your place among the top 20 pilots",
      "The first time you reach the finish each day pays coins; after that you can keep flying to chase a faster time",
      "A ghost button next to the sound button turns the ghost off if you would rather fly alone",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-10-30",
    title: "Smoother flights on phones and tablets",
    highlights: [
      "Planes now fly smoother on phones and older tablets: the game only draws what you can see",
      "If a flight starts to stutter, the game quietly lowers its detail a little, and only loads the pictures for the world you are in",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-10-29",
    title: "A world worth flying through",
    highlights: [
      "Trees, barns, balloons, skyscrapers and the rest of the world are new: pine and leafy trees, a red barn with white doors, striped hot-air balloons with baskets, Art Deco and glass towers, and coconut palms",
      "Canyon walls and rock arches are built from uneven layers of rock with cracks and a rubble slope at the foot, icebergs are chunky blocks of ice, and peaks wear big bright snowy caps",
      "Clouds are soft white puffs on the Islands and tall grey thunderclouds in the Storm, and they no longer cast a black shadow",
      "Towers have light blue glass bands, and trees and towers are lighter, so nothing looks black from behind your plane",
      "Coins are gold with a star and a raised rim, rings are striped hoops, and fuel cans are red jerry cans with a spout and a cross",
      "The finish gate has chequered posts and a framed banner, the slingshot is a forked wooden (or metal) frame, and flags, signs, corridor poles and the best-distance wall have new posts",
      "The hangar floor is a marked airfield apron with a yellow cross and edge lights",
      "Seagulls now have white bodies, dark wings and yellow beaks",
      "Every one still fits the same invisible box as before, so nothing is harder or easier to hit",
      "Each world keeps its own colours",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-10-29",
    title: "Planes that look like real planes",
    highlights: [
      "Your plane's body, wings and tail are remade to look like little Piper Cubs, Cessnas and jets, with proper windows and a rounded nose",
      "The propeller now has two curved blades with painted tips and a shiny nose spinner",
      "Seaplane floats, big bush tyres and snow skis have more shape: floats have hatches, tyres have tread, skis curl up at the front",
      "The snow plane's cabin has a sloping windscreen and side windows",
      "Everything keeps your world's colours, and gold and glowing planes still shine",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-10-18",
    title: "Mystery squares and fair fuel cans",
    highlights: [
      "Open the Sky Map any time from the worlds screen, even before your first Prestige",
      "Bonus squares are now glowing mystery gifts: you know something is there, but not what, until you land on it",
      "Squares you've visited turn green and show the bonus you found",
      'A "How the Sky Map works" guide explains the map and lists every bonus you can win',
      "Fuel cans now give 1 second of fuel instead of 3, so grabbing them helps without letting you skip the hard part",
      "Engines and fuel tanks cost more, so building a good plane all round matters again",
      "When you reach a new world, its first Coin Boost and Body upgrades are cheap, so you get to upgrade right away",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-10-18",
    title: "Climb the leaderboards",
    highlights: [
      "A golden card at the top of the worlds list shows your spot in the world and who to beat next",
      "See how far you are from the pilot ahead of you, or how much more to fly to reach the top 50",
      "A little arrow pops up when you move up the leaderboard",
      "When you finish a world, you see your place on that world's board and who you passed",
      "The top three pilots get gold, silver and bronze medals",
      "Opening the leaderboards jumps straight to your own name",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-10-17",
    title: "Prestige and the Sky Map",
    highlights: [
      "Beat all 10 worlds to Prestige: start every world again and move one square on the Sky Map",
      "Squares on the Sky Map hold bonuses like Golden Wind, Rocket Fuel, Lucky Clover and rare Stars. They stack forever, so every run gets faster",
      "The Sky Map goes on forever, and the best bonuses are far from the start",
      "Worldwide leaderboards: highest prestige, fastest full run, and fastest finish in each world",
      "Everyone on the leaderboards gets a fun made-up name like Speedy Falcon 42 (roll a new one any time). No real names",
    ],
  },
  {
    version: "1.5.1",
    date: "2026-10-17",
    title: "Feel the boost",
    highlights: [
      "Boosting now shows speed lines and a warm glow, and the Boost button lights up when you hold Shift or Space",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-10-17",
    title: "Seven new worlds",
    highlights: [
      "Seven new worlds after the Snowy Mountains: Sunny Beach, Jungle, Big City, Frozen Glacier, Volcano, Thunderstorm and Sky Islands",
      "Each world is a bit harder than the one before, with tougher things to dodge, stronger winds and longer trips to the finish",
      "Beat a world to open the next one. Your old saves keep all their progress",
      "Every new world has its own plane: a seaplane, a bush plane, a little jet, a ski plane, a twin-engine, a twin-boom storm chaser and a sky glider",
    ],
  },
  {
    version: "1.4.1",
    date: "2026-10-17",
    title: "Fair fuel",
    highlights: [
      "Fuel cans now give the same small top-up to every plane, so a big tank can't keep itself full forever",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-17",
    title: "Swoop!",
    highlights: [
      "Out of fuel? Dive down hard, then pull up to swoop a little further before you land",
      "The upgrade page is much bigger on phones, with your plane turning at the top so you still see new parts appear",
      "When you beat a world, you go to the worlds list. The world you won shines green and the next one glows gold so you know where to go",
    ],
  },
  {
    version: "1.3.1",
    date: "2026-10-17",
    title: "Room for the notch, trickier timing",
    highlights: [
      "The slingshot now tells you how your launch went: Perfect, Good or Oops",
      'A see-through blue wall shows your best distance. Fly through it to see "New best!"',
      "When you add Plane Builder to an iPhone home screen, the buttons, speedometer and level list no longer hide behind the notch or the clock",
      "The timing bars slide faster and the green zone is smaller, so a perfect launch or a coin jackpot takes real skill",
      "After each flight a coin card pops up in the middle of the screen: stop the bar, watch your coins add up, then head to the hangar",
    ],
  },
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
