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
    version: "2.1.1",
    date: "2026-11-21",
    title: "The whole keyboard",
    highlights: [
      "The friend code keyboard has every letter and number again. Friend codes still never use O, I, L, 0 or 1 because they look too much alike, so those keys give a little wiggle and tell you to look again",
    ],
  },
  {
    version: "2.1.0",
    date: "2026-11-21",
    title: "What does this do?",
    highlights: [
      "Tap the food, fun or tidy circle at the top to see what it means and how to fill it up. Food and fun have a button that takes you straight to feeding or playing",
      "Tap your flameling's name and level to learn how it grows, and when it grows up into a Cozy, Wild or Sparkly flameling",
      "Tap your sparks to go straight to the Shop. In the Shop, tap your sparks again to see all the ways to get more",
      "Pick a game now says whether games still win sparks, or whether they are used up for now",
      "The friend code keyboard looks like a real keyboard now, with numbers on top and the letters where you expect them. O, I, L, 0 and 1 are left out on purpose, because they look too much alike, so friend codes never use them",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-11-21",
    title: "The storybook glow-up",
    highlights: [
      "Your flameling now lives in a real campfire! It sits in a ring of stones on crossed logs, with a warm glow on the grass, sparks floating up and a string of twinkly lanterns between the trees",
      "Flamelings look more alive: rosy cheeks, sparkly eyes, a little wiggle when they breathe and a squish when you tap them",
      "New buttons and need circles. Fuel, joy and tidy are round gauges at the top now, and a gauge wobbles with a red ! when it needs you. Your flameling also tells you what it wants in a speech bubble",
      "Your flamelings glow in jars on a wooden shelf when you open the game, and new eggs wait in a twig nest",
      "Hatching is more exciting: the egg wobbles harder and cracks a bit more with every tap, then bursts with light",
      "The Shop, Wardrobe, Friends and every card got a cozy new look, with bigger buttons that squish when you press them and panels that slide in",
      "Everything you had is still here: your flamelings, sparks, clothes, decor and friends",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-11-20",
    title: "Play anywhere, and share a picture",
    highlights: [
      "Flamelings now works with no internet! Open it once with the internet on, then it is saved on your device. Play on a car ride or a plane, even when the home-screen app has no signal. Feeding, playing and dressing up all work, and everything saves as usual",
      "Friends need the internet. Without it a little cloud with a line through it shows, and the rest of the game keeps going. When the internet comes back, tap the 🔄 button and your friends are there again",
      "New 📸 button in the Wardrobe! Tap it to take a picture of your flameling in its Ember Hollow frame, with its name, level, what it has grown into and how many days it has been alive",
      "Tap Share to send the picture to family. If your tablet cannot share, Save picture tries to keep it, and a 👆🖼️💾 hint shows: press and hold the picture to save it to your photos",
      "A small spark on the Friends screen was floating in a big empty box. Young flamelings now fill their space, so you can see your new friend properly",
      "For parents: the picture is made right on your device and goes nowhere on its own. It only leaves if you choose where to share it, and it never includes anything but what you see. The game only counts anonymously whether a picture was shared or saved, never the picture or the name",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-11-19",
    title: "Friends and playdates",
    highlights: [
      "Every flameling can have friends! Tap the 👫 button on a flameling's card or in its glade to open the Friends screen",
      "Each flameling gets its own friend code, six letters and numbers. Show your code to a friend, or read it out, and they type it on a big keypad to add you. You add each other by typing each other's code, so friends can sit side by side and do it together",
      "Before you add someone you see their flameling, so you know you have the right friend. Your friends' flamelings show how they look right now",
      "Tap the 🎈 playdate button and your friend's flameling walks into your glade. They dance, you tap both of them to high-five, and then you share a marshmallow. Your flameling gets happier and earns 10 sparks. You can have one playdate with each friend in each morning or evening",
      "Your friend gets a card the next time they open the game that says their friend visited, with 5 sparks and a happy boost",
      "Friends see a name from a list of friendly names, never what you typed. Tap the 🏷️ button to pick a different one. A flameling's real name stays on your device",
      "For parents: a flameling that uses Friends shares only these things online: its friend code, how it looks (colours, hat and so on), its level, stage and grown-up form, a name picked from our built-in list of friendly names, and an anonymous account id that is not linked to a name or an email. Nothing your child types is ever sent, including the flameling's real name. There is no chat, no search and no list of other players. Codes are random and hard to guess, but treat one like a phone number and share it only with people you want as friends. Remove a friend any time with the 🗑️ button. If the internet is away, a little cloud with a line through it shows and the rest of the game works as usual",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-11-18",
    title: "Grown-up forms and new games",
    highlights: [
      "When your flameling gets to level 10 it grows up into a new form, and the form depends on how you looked after it. Mostly feeding and cleaning makes a Cozy flameling, mostly playing makes a Wild one, and lots of petting, emotes and dress-ups makes a Sparkly one",
      "Cozy flamelings have a warm round glow, floating hearts and rosy cheeks. Wild ones have tall jagged flames, little crackles and bold eyebrows. Sparkly ones shimmer in rainbow colours with twinkling stars",
      "There is a big grown-up moment with a glow, a spin, a reveal and confetti, and a card that shows the new form's name. The form stays for good and gets even stronger when your flameling reaches Bonfire at level 15",
      "A flameling that was already level 10 or more gets its form the next time you open the game",
      "You can see the form next to the level (like Lv 12 · Cozy Blaze) and in the Memory Grove",
      "Tapping Play now shows three games with big pictures. New: Marshmallow Toast, where you hold to toast a marshmallow over the flame and let go when it is golden, and Log Stack, where you tap to drop logs and build a tall tower on the hearth",
      "All three games share the same sparkly rounds each morning and evening, and every game still cheers up your flameling and gives it XP",
    ],
  },
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
