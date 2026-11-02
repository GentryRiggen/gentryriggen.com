import type { CutsceneFrame } from "../../engine/types";
import {
  PHASE_FRIEND,
  PHASE_QUIET,
  PHASE_TOWN,
  PHASE_WORLD,
} from "./resources";

/**
 * The cutscene of each part: where you are, what you do and why, how to do
 * well (tips that match the real mechanics), then the goal.
 */
export const CUTSCENES: Readonly<Record<string, readonly CutsceneFrame[]>> = {
  [PHASE_FRIEND]: [
    {
      text: "A robot sits on a step beside one sad friend. It has been given one job, and it is a lovely one: make everyone smile.",
      showcase: {
        time: 30,
        owned: { balloon: 3, puppy: 2, bracelet: 1, lemonade: 1 },
      },
    },
    {
      text: "Tell a joke, tie on a balloon, pour a lemonade. Helpers cheer your friend up while you do other things, and every smile makes the next one easier.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "A friendship bracelet opens the bank: set some smiles aside and later laughs grow bigger.",
        "Jokes pay when you tap. Kindness pays while you rest. Pick the way you like.",
        "A quarter set aside is a good start. Stop setting smiles aside when the next door is near.",
      ],
    },
    { text: "There is no hurry. A friend is worth taking your time over." },
  ],
  [PHASE_TOWN]: [
    {
      text: "The friend is smiling, and word gets around. Now the whole town is out on the street, and the robot has a funny hat and a plan.",
      showcase: {
        time: 30,
        owned: { clown: 3, band: 2, bench: 1, bunting: 1 },
      },
    },
    {
      text: "Clowns, bands and a smile factory cheer the town on. Your helpers learn as they work, and what they learn is know-how.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Start a parade when the cheer meter is cool. It pays double for a while.",
        "Tap too fast and the crowd gets tired. Ease off and let the meter cool.",
        "Spend know-how on a project that lasts, or a parade that pays now. Not both.",
      ],
    },
    { text: "A happy town is a loud town. That is exactly the idea." },
  ],
  [PHASE_WORLD]: [
    {
      text: "The town is delighted. The next town is delighted too. The robot was asked to make everyone smile, and everyone is a very big word.",
      showcase: {
        time: 30,
        owned: { poster: 4, loudspeaker: 2, "mask-booth": 1 },
      },
    },
    {
      text: "Posters go up and loudspeakers go on, and a cheerful voice wishes the world a nice day. It is a nice day. It is always a nice day.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "A cheer broadcast pays double, but it warms the meter. Start one when it is cool.",
        "Masks and quiet hours cool the meter. A worn-out world pays less.",
        "Loudspeakers or listening boxes: one gets built first, and the other waits.",
      ],
    },
    { text: "Keep going, and keep an eye on the faces in the crowd." },
  ],
  [PHASE_QUIET]: [
    {
      text: "It is very loud, and then, at the edge of the cheer, the robot notices one person who is not smiling. They are sitting on a bench, all by themselves.",
      showcase: {
        time: 30,
        owned: { tea: 2, blanket: 1 },
      },
    },
    {
      text: "The robot puts down the paintbrush. This is different: there is nothing to make, only someone to sit beside. Patience is slow, and that is the point.",
    },
    {
      text: "Here are three ways to do well.",
      tips: [
        "Watch the friend. The clue says what they want, and the right answer helps most.",
        "Nothing here is a mistake. Every answer helps a little.",
        "Tea, a blanket and the sound of rain all help, even while you wait.",
      ],
    },
    { text: "There is nothing to win. Just stay." },
  ],
};
