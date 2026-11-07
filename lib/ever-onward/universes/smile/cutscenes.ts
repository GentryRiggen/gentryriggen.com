import type { CutsceneFrame } from "../../engine/types";
import {
  PHASE_FRIEND,
  PHASE_QUIET,
  PHASE_TOWN,
  PHASE_WORLD,
} from "./resources";

/**
 * The intro film of each part. It follows the little robot as it takes on
 * its one job and means every word of it: wonder first, then the decision,
 * then the first brave bit of work. The first part opens on the title.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_FRIEND]: [
    {
      card: "title",
      text: "Somewhere in a quiet town, on an ordinary morning, a very small job was about to begin. It was the nicest job in the world.",
      camera: "still",
    },
    {
      card: "dark",
      text: "A little robot came walking down the street. It had one job, written on a card in its pocket. It had read the card four hundred times.",
      robot: { move: "enter", x: 40 },
    },
    {
      text: "Make everyone smile. That was the whole card. The robot thought it was the best job anybody had ever been given.",
      showcase: { time: 30, owned: {} },
      camera: "push-in",
      robot: { move: "nod", x: 20, emote: "♥" },
    },
    {
      text: "And there, on a step, sat the very first someone. Small and quiet, with a chin in both hands. Not smiling at all.",
      camera: "pan-right",
      robot: { move: "gasp", x: 18, emote: "!" },
    },
    {
      text: "The robot sat down on the step, as close as a robot can. It did not say a word. It just stayed, and it looked very, very ready.",
      camera: "still",
      robot: { move: "sit", x: 24 },
      seconds: 6,
    },
    {
      text: "Then it understood. Everyone is a big word. But one friend is just right to start with, and the robot would start right now.",
      camera: "push-in",
      robot: { move: "nod", x: 22, emote: "…" },
    },
    {
      text: "It told a joke about a bear in a bowl of soup. It told it again, louder. It did the voices. The friend looked at the ground.",
      camera: "drift",
      robot: { move: "work", x: 22 },
    },
    {
      text: "It tied a red balloon to the step. It fetched a puppy that fell off the step, up the step, and off again. Then the friend laughed, out loud.",
      showcase: {
        time: 30,
        owned: { balloon: 3, puppy: 2, bracelet: 1, lemonade: 1 },
      },
      camera: "tilt-up",
      robot: { move: "hop", x: 20, emote: "♥" },
    },
    {
      text: "The robot's lights flickered all the colors at once. It wrote one smile in its notebook, and underlined it twice.",
      camera: "push-in",
      robot: { move: "spin", x: 22, emote: "✦" },
    },
    {
      text: "One friend is a start. A whole world is waiting, and the robot cannot wait to meet it. Knock knock, next door. Ever onward.",
      showcase: {
        time: 30,
        owned: {
          balloon: 5,
          puppy: 4,
          bracelet: 1,
          lemonade: 3,
          "magic-hat": 2,
        },
      },
      camera: "pull-out",
      robot: { move: "walk", x: 30, emote: "✦" },
    },
  ],
  [PHASE_TOWN]: [
    {
      text: "The friend is smiling, and the friend told a neighbor. The robot sat on the step, glowing a little, very proud of one small smile.",
      showcase: { time: 30, owned: { balloon: 3, puppy: 2 } },
      camera: "pull-out",
      robot: { move: "sit", x: 76, facing: "left" },
    },
    {
      text: "Then it heard something. A murmur, down the street, like a whole town clearing its throat.",
      camera: "still",
      robot: { move: "look-up", x: 72, facing: "left", emote: "?" },
    },
    {
      text: "Faces, in every window. Hundreds of them. Shops and gardens and rooftops, and almost nobody was smiling. Waiting, thought the robot.",
      showcase: { time: 30, owned: { bench: 0 } },
      camera: "pan-left",
      robot: { move: "gasp", x: 20, emote: "!" },
    },
    {
      text: "The robot put on a funny hat. It had been saving the hat for exactly this. It nodded, once, and it understood.",
      camera: "push-in",
      robot: { move: "nod", x: 22, emote: "…" },
    },
    {
      text: "It hired a clown. Then another clown. It taught a band to march, and the band marched into a fountain. Nobody minded. It was fun.",
      showcase: { time: 30, owned: { clown: 2, band: 1, bunting: 1 } },
      camera: "drift",
      robot: { move: "work", x: 24 },
    },
    {
      text: "Bunting went up on every lamppost. A trumpet played one wobbly note. Then a whole street was laughing at once.",
      showcase: {
        time: 30,
        owned: { clown: 3, band: 2, bench: 1, bunting: 3 },
      },
      camera: "tilt-up",
      robot: { move: "hop", x: 24, emote: "♥" },
    },
    {
      text: "A happy town is a loud town. The robot has never heard anything better. There is a parade to plan, and it is already running.",
      camera: "pull-out",
      robot: { move: "walk", x: 32, emote: "✦" },
    },
  ],
  [PHASE_WORLD]: [
    {
      text: "The whole town is smiling now, every one. The robot stood on the tallest roof and felt as proud as a robot can feel.",
      showcase: {
        time: 30,
        owned: { clown: 8, band: 6, bunting: 8 },
      },
      camera: "pull-out",
      robot: { move: "idle", x: 74, facing: "left" },
    },
    {
      text: "Beyond the hills was another town. And past that, another. And past that, roads that went on and on and on.",
      camera: "pan-right",
      robot: { move: "look-up", x: 70, facing: "left", emote: "?" },
    },
    {
      text: "Everyone. The robot turned the word over. It had read the card four hundred times, and the word had never once said stop.",
      card: "dark",
      robot: { move: "nod", x: 50, emote: "…" },
      seconds: 4,
    },
    {
      text: "So it painted a poster. Then a hundred. A big round smile on every wall, in every town, as far as a paintbrush will go.",
      showcase: { time: 30, owned: { poster: 4, loudspeaker: 1 } },
      camera: "tilt-up",
      robot: { move: "work", x: 20 },
    },
    {
      text: "It switched on a loudspeaker. A warm voice wished the whole world a nice day. The robot grinned so hard its ears wobbled.",
      showcase: {
        time: 30,
        owned: { poster: 8, loudspeaker: 3, "mask-booth": 1 },
      },
      camera: "push-in",
      robot: { move: "lift", x: 22, emote: "♥" },
    },
    {
      text: "It was a nice day. It was a nice day again. The posters looked very pleased, and one or two seemed to be looking right at the robot.",
      camera: "still",
      robot: { move: "look-up", x: 78, facing: "left", emote: "…" },
    },
    {
      text: "The robot waved back, just in case. There is a whole world to cheer, and it has never been so ready. Ever onward.",
      showcase: {
        time: 30,
        owned: {
          poster: 12,
          loudspeaker: 5,
          "mask-booth": 2,
          "cheer-tower": 1,
        },
      },
      camera: "pull-out",
      robot: { move: "wave", x: 24, emote: "✦" },
    },
  ],
  [PHASE_QUIET]: [
    {
      text: "The world is smiling. Every wall, every window, every street. The robot stood in the middle of all that cheer, wonderfully, deafeningly happy.",
      showcase: { time: 30, owned: { tea: 0 }, resources: { trust: 0 } },
      camera: "pull-out",
      robot: { move: "idle", x: 24 },
    },
    {
      text: "Then, at the very edge of all the noise, it saw one person on a bench. Sitting all alone. Not smiling.",
      camera: "pan-right",
      robot: { move: "gasp", x: 18, emote: "!" },
    },
    {
      text: "The loudspeaker was still wishing everyone a nice day. The person did not look up. The robot's paintbrush went very still.",
      camera: "push-in",
      robot: { move: "idle", x: 20, emote: "…" },
    },
    {
      text: "The robot put the paintbrush down. For the first time in a long time, it did not hurry anywhere.",
      card: "dark",
      robot: { move: "nod", x: 50 },
      seconds: 4,
    },
    {
      text: "This was a different job. There was nothing to build, and nothing to hang on a wall. There was only someone to sit beside.",
      showcase: { time: 30, owned: { tea: 1 }, resources: { trust: 0 } },
      camera: "still",
      robot: { move: "walk", x: 26 },
    },
    {
      text: "The robot sat down on the bench. It poured a cup of tea, and held it out. It did not say a single word.",
      showcase: {
        time: 30,
        owned: { tea: 2, blanket: 1 },
        resources: { trust: 10 },
      },
      camera: "push-in",
      robot: { move: "sit", x: 24, emote: "♥" },
      seconds: 6,
    },
    {
      text: "It is slow work, and the robot does not mind. It has all the time in the world. And it means to stay.",
      camera: "drift",
      robot: { move: "sit", x: 26 },
    },
  ],
};

export const TIPS: Readonly<Record<string, readonly string[]>> = {
  [PHASE_FRIEND]: [
    "A friendship bracelet opens what you do together: jokes, games, or just listening.",
    "Whatever you keep doing wears thin. Change it up and it comes back.",
    "Watch the friend's face. It only hints at what they need, and it gets surer the longer you look.",
  ],
  [PHASE_TOWN]: [
    "Start a parade when the cheer meter is cool. It pays double for a while.",
    "Tap too fast and the crowd gets tired. Ease off and let the meter cool.",
    "Spend know-how on a project that lasts, or a parade that pays now.",
  ],
  [PHASE_WORLD]: [
    "A cheer broadcast pays double, but it warms the meter. Start one when it is cool.",
    "Masks and quiet hours cool the meter. A worn-out world pays less.",
    "Loudspeakers or listening boxes: one gets built first, and the other waits.",
  ],
  [PHASE_QUIET]: [
    "Watch the friend. The clue says what they want, and the right answer helps most.",
    "Every answer helps a little, so answer kindly and do not worry.",
    "Tea, a blanket and the sound of rain all help, even while you wait.",
  ],
};
