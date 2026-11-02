import type { RunState, StoryMessage } from "../../../engine/types";
import { bondChanges } from "../bond";
import { PHASE_FRIEND } from "../resources";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** True once this part has been open this many minutes. */
const after = (run: RunState, minutes: number): boolean =>
  run.time >= minutes * 60;

export const friend: StoryMessage[] = [
  {
    id: "friend-hello",
    phase: PHASE_FRIEND,
    text: 'A robot sits down on a step beside someone small and sad. "Hello," says the robot. "I have one job, and it is you." The friend does not look up. The robot does not mind. It has all day. It has, in fact, for ever.',
  },
  {
    id: "friend-joke",
    phase: PHASE_FRIEND,
    when: (run) => run.taps >= 1,
    text: "Knock knock. Who's there? Boo. Boo who? Don't cry, it's only a joke. The friend's shoulders move, once. That might have been a sniffle. The robot decides it was a laugh and writes it in its notebook.",
  },
  {
    id: "friend-balloon",
    phase: PHASE_FRIEND,
    when: (run) => owned(run, "balloon") >= 1,
    text: "A red balloon on a string, tied to the step. It bobs over the friend's head like a very small, very bright idea.",
  },
  {
    id: "friend-book",
    phase: PHASE_FRIEND,
    when: (run) => owned(run, "joke-book") >= 1,
    text: 'The joke book has a chapter on bears, a chapter on soup, and a chapter that is only the word "honk". It is the best chapter.',
  },
  {
    id: "friend-puppy",
    phase: PHASE_FRIEND,
    when: (run) => owned(run, "puppy") >= 1,
    text: "A puppy falls off the step, falls up the step and falls off it again. The friend laughs out loud, a real one, and then looks surprised at themselves.",
  },
  {
    id: "friend-bracelet",
    phase: PHASE_FRIEND,
    when: (run) => owned(run, "bracelet") >= 1,
    text: "Three colors of string, tied in a knot. The friend looks at it for a long time, and then ties one on the robot's wrist. The robot's lights flicker. It was not expecting that.",
  },
  {
    id: "friend-bond",
    phase: PHASE_FRIEND,
    when: (run) => bondChanges(run) >= 1,
    text: "Some smiles are for laughing at, and some are for keeping. The robot puts a few in a jar to grow, the way you plant a bean.",
  },
  {
    id: "friend-fork",
    phase: PHASE_FRIEND,
    when: (run) => (run.resources.fkFriend ?? 0) > 0,
    text: "The friend has decided what kind of cheering they like best, and the robot writes it down carefully. Everybody likes something different. That is what makes it hard, and what makes it fun.",
  },
  {
    id: "friend-lemonade",
    phase: PHASE_FRIEND,
    when: (run) => owned(run, "lemonade") >= 1,
    text: "Squeeze, stir, pour. The sign says FREE SMILES WITH EVERY SIP. The sign is not lying. A smile is a very cheap thing to give away, and a very good thing to get.",
  },
  {
    id: "friend-sun",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 6),
    text: 'The sun comes out on the step. Somewhere nearby a kid says, "Look, they are laughing," and a few more heads turn around to see.',
  },
  {
    id: "friend-door",
    phase: PHASE_FRIEND,
    when: (run) => run.revealed.includes("next-door"),
    text: "There is a door next door. From behind it, it sounds like somebody is having a sort of a day. The robot stands up and brushes off its knees.",
  },
  {
    id: "friend-inch",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 1.5),
    text: "The step is warm where the robot sits. The friend scoots over, just an inch, to make room. An inch is plenty.",
  },
  {
    id: "friend-cloud",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 4),
    text: "A cloud goes by in the shape of a rabbit. The friend points at it. The robot pretends it had not noticed, so the friend can be the first to spot it.",
  },
  {
    id: "friend-mud",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 9),
    text: "The ball rolls into a puddle. Then the puppy follows it, then the robot, and then, to everyone's surprise, the friend. Nobody is cross about the mud.",
  },
  {
    id: "friend-song",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 13),
    text: "The friend hums, very softly, the four notes the bird started. The robot pretends to look at a cloud, so as not to interrupt.",
  },
  {
    id: "friend-name",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 17),
    text: "The friend tells the robot their name. It is a good one. The robot says it three times to be sure it has it, and once more because it likes it.",
  },
  {
    id: "friend-dusk",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 22),
    text: "The streetlights come on. There is a golden sort of hour in which everything, even the bin, looks quite pleased about it.",
  },
  {
    id: "friend-promise",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 26),
    text: '"Will you be here tomorrow?" says the friend. "I will be here," says the robot. It is the easiest promise it has ever made. It has no idea how many more are coming.',
  },
  {
    id: "friend-shoe",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 7.5),
    text: "The puppy has found a shoe. It is not the friend's shoe, or the robot's, or anyone's shoe at all. It is the best shoe in the world, and it must be brought to everybody.",
  },
  {
    id: "friend-chalk",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 11),
    text: "The friend draws a smile on the pavement in chalk, then gives it a hat, then a dog, then a small house to live in. The robot looks at the drawing for a long time and says nothing, which is the best review.",
  },
  {
    id: "friend-kite",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 15),
    text: "A kite goes up from the end of the street. The friend watches it all the way to the top of the string, and then a little further, where the string ends but the looking doesn't.",
  },
  {
    id: "friend-secret",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 19.5),
    text: 'The friend whispers a secret, and the robot nods very seriously. "Nobody will hear it from me," it says. This is true. The robot has nobody to tell.',
  },
  {
    id: "friend-rain",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 24),
    text: "A short rain falls, and everyone laughs and runs for the lemonade stand's awning. The friend gets wet on purpose. The robot has never been so pleased about a drip.",
  },
  {
    id: "friend-wave",
    phase: PHASE_FRIEND,
    when: (run) => after(run, 28.5),
    text: "Two doors down, a curtain moves. A face looks out, and then another. The robot waves, and a hand waves back, a little unsure. It is a start.",
  },
  {
    id: "visitor-bird",
    phase: PHASE_FRIEND,
    text: "A little bird lands on the balloon string and sings the first four notes of a tune, then stops, embarrassed. The friend sings the next four. The bird looks very pleased with itself.",
  },
  {
    id: "visitor-grandma",
    phase: PHASE_FRIEND,
    text: '"I heard there was a lemonade stand," says a grandma, setting down a tin of cookies. "I do not like lemonade. But I do like it when people are cheerful." She stays for three cookies and a long chat about bears.',
  },
];
