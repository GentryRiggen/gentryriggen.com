/**
 * What changed in each Flamelings release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of FLAMELINGS_VERSION needs a new entry at the top (a test
 * enforces it), in plain words a young player or their parent would follow.
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
    date: "2026-11-17",
    title: "Happenings",
    highlights: [
      "Something new can happen every time you visit! When a red ! shows on your flameling's card, tap it to see what is going on",
      "A visitor can wander in: an owl, snail, frog, butterfly or hedgehog. Tap them and they leave you a present, then wave goodbye",
      "Rain showers roll in. Tap the raindrops to pop them before they get your flameling wet. Do not worry, a little soggy is only a little sad",
      "Spot the glowing X and tap it five times to dig up a treasure chest",
      "At night a shooting star floats by while your flameling sleeps. Tap it to make a wish, and the sparks are waiting in the morning",
      "Mushrooms pop up in a ring and light up one by one. Tap them in the same order to start a dance party",
      "Snow in winter, falling leaves and pumpkins in autumn, and flowers in spring all drift through the glade, and the snowman is on sale all winter",
      "Every 30 days, and on its birthday, your flameling has a Hatch Day with a cake: blow out the candles for confetti, sparks and a party hat",
      "Fixed the cape so it flows out behind your flameling instead of looking like a bib",
      "Moved the present so it no longer sits on top of the hanging lantern",
      "Firefly Catch pays sparks for your first 3 rounds each morning and evening. You can still play more rounds to cheer up your flameling",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-11-16",
    title: "Sparks and shop",
    highlights: [
      "Every flameling now earns sparks! Feed it when it is hungry, clean up the ash, catch fireflies, open your present, level up and light an ember back up",
      "Watch the sparks fly up to the counter at the top, with a little ding",
      "The new Shop button has 8 hats, 4 face things, 4 neck things and 11 glade decorations, like a pirate hat, bunny ears, a cape, a tent and a mushroom house",
      "Pick something you can pay for and it goes on your flameling or into its glade right away. If you do not have enough sparks yet, it shows how many more you need",
      "Put your decorations out or tuck them away again in the Shop's Glade tab",
      "Each flameling keeps its own sparks, and anything you buy is shared with new hatchlings",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-11-16",
    title: "Hello, little flame!",
    highlights: [
      "Hatch your own flameling: tap the egg, give it a name and pick how it looks",
      "Feed it twigs, pinecones, logs and marshmallows, and tap the ash piles to clean up",
      "Play Firefly Catch to cheer it up and earn XP",
      "Your flameling grows through levels, and every level unlocks something new: hats, glasses, colours, shapes, eyes, emotes and foods",
      "A present shows up each morning and evening with a surprise inside",
      "Dress it up and make it laugh, dance, spin and more",
      "It sleeps at night, so nothing gets hungry while you are in bed",
      "If you forget it for a few days it turns into a sleepy ember. Feed it three times to light it back up!",
      "Soft, cute sounds: chirps, chomps, sparkles and a little whoosh when an ember lights back up. Tap the speaker to turn them off",
      "If a new version is ready, a button pops up so you can update with one tap",
      "Keep up to 8 flamelings on your shelf. Everything you unlock is shared with new hatchlings",
    ],
  },
];
