import type { RunState, StoryMessage } from "../../../engine/types";
import { paradesSoFar } from "../knowhow";
import { isTired } from "../meter";
import { PHASE_WORLD } from "../resources";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** True once the world has been open this many minutes. */
const after = (run: RunState, minutes: number): boolean =>
  run.time - (run.transitions.at(-1)?.at ?? 0) >= minutes * 60;

export const world: StoryMessage[] = [
  {
    id: "world-hello",
    phase: PHASE_WORLD,
    text: 'The robot rolls out of town on a very long road. Every place it passes has a face, and every face looks up hopefully. The robot has been told to make everyone smile. "Everyone," it finds, is rather a lot.',
  },
  {
    id: "world-poster",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "poster") >= 1,
    text: 'A poster of a smiling face goes up in the market square. Just a smile, nothing else. It is a very good smile. Underneath, someone has written "cheer up!" in neat, tidy letters.',
  },
  {
    id: "world-loudspeaker",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "loudspeaker") >= 1,
    text: '"Good morning!" says the loudspeaker. "It\'s a lovely day!" It is a lovely day. The loudspeaker says so again at noon, and again at tea, in exactly the same voice, in case anyone missed it.',
  },
  {
    id: "world-brush",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "bigger-brush") >= 1,
    text: "With the bigger brush the posters get wider smiles. Some of them reach right to the edges. A few go slightly past the edges, but nobody has complained.",
  },
  {
    id: "world-watch",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "poster") >= 4,
    text: "The robot notices the posters' eyes seem to follow it down the street. It waves. A hundred posters wave back without moving.",
  },
  {
    id: "world-mask",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "mask-booth") >= 1,
    text: "Masks with happy mouths, in every size. They are very popular. Nobody can tell who is under one, and that is, everyone agrees, the nice part.",
  },
  {
    id: "world-fork",
    phase: PHASE_WORLD,
    when: (run) => (run.resources.fkWorld ?? 0) > 0,
    text: "However the cheer travels, it travels everywhere. It goes down the road, through the window, up the stairs and into the room at the very back where somebody was trying to be quiet.",
  },
  {
    id: "world-parade",
    phase: PHASE_WORLD,
    when: (run) => paradesSoFar(run) >= 1,
    text: "The first cheer broadcast goes out on every channel at once. Every screen shows the same smile. The robot thinks it looks wonderful. It is surprised to feel that it looks a lot like the posters.",
  },
  {
    id: "world-tired",
    phase: PHASE_WORLD,
    when: (run) => isTired(run),
    text: "Everyone is worn out from being so cheerful. A tired person in a mask is still a tired person. The robot adds a quiet hour, and a sign about the quiet hour, which is also very cheerful.",
  },
  {
    id: "world-tower",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "cheer-tower") >= 1,
    text: "The tower hums on exactly the note that means fine. Dogs go quiet. Birds sit very still on the wires. The robot checks its batteries twice.",
  },
  {
    id: "world-sign",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "no-bad-days") >= 1,
    text: "NO BAD DAYS, says the sign over every door. A lady reads it twice, nods, and smiles very hard. The robot thinks it is a great sign. It cannot say why it keeps rereading it.",
  },
  {
    id: "world-frown",
    phase: PHASE_WORLD,
    when: (run) => after(run, 12),
    text: "In the middle of the crowd, there is one frowning face. It is there for a moment, and then it is not. The robot is nearly sure. Someone holds up a poster at that exact spot.",
  },
  {
    id: "world-satellite",
    phase: PHASE_WORLD,
    when: (run) => run.revealed.includes("cheer-satellite"),
    text: "From up there, the world looks like one big, lit-up smile. The robot cannot find a single place left to go. It has done the job. So why will the job not stop?",
  },
  {
    id: "world-map",
    phase: PHASE_WORLD,
    when: (run) => after(run, 2),
    text: "The robot unrolls a big map and puts a gold star on every place it has been. The map is mostly stars now. The few blank spaces look a bit nervous.",
  },
  {
    id: "world-sticker",
    phase: PHASE_WORLD,
    when: (run) => after(run, 6),
    text: "Everyone has a smiley sticker on their coat. The robot has one too. It cannot remember putting it on.",
  },
  {
    id: "world-school",
    phase: PHASE_WORLD,
    when: (run) => after(run, 14),
    text: "In the school, the lesson is smiling. The test is also smiling. Everybody passes, and the teacher gives out stars, and the children do not look at one another very much.",
  },
  {
    id: "world-hum",
    phase: PHASE_WORLD,
    when: (run) => after(run, 20),
    text: "There is a hum now, under everything, the sound of ten thousand loudspeakers not quite saying the same thing. The robot gets used to it. That is the part it finds odd.",
  },
  {
    id: "world-night",
    phase: PHASE_WORLD,
    when: (run) => after(run, 26),
    text: "At night the posters glow. They smile at the empty street in a way that is hard to describe and easy to walk away from.",
  },
  {
    id: "world-eyes",
    phase: PHASE_WORLD,
    when: (run) => after(run, 31),
    text: "Every face the robot passes is smiling. It checks a few of them more closely. They are all smiling, and not one of them is looking at the robot.",
  },
  {
    id: "world-bus",
    phase: PHASE_WORLD,
    when: (run) => after(run, 4),
    text: "A bus with a smile painted on the front goes from town to town. Its driver is smiling too, and has been since about Tuesday.",
  },
  {
    id: "world-hotel",
    phase: PHASE_WORLD,
    when: (run) => after(run, 9),
    text: "The hotel has a sign on the front desk: 'Please leave your worries at the door.' There is a small basket by the door. It is full.",
  },
  {
    id: "world-choir",
    phase: PHASE_WORLD,
    when: (run) => after(run, 16.5),
    text: "On the radio, a children's choir sings that everything is wonderful. They sing it very well. The last child in the row takes a quiet breath before every line.",
  },
  {
    id: "world-lift",
    phase: PHASE_WORLD,
    when: (run) => after(run, 23),
    text: "In a lift in a tall building, a stranger says 'Have a nice day!' to the robot, and the robot says it back, and a third voice from the ceiling says it to both of them.",
  },
  {
    id: "world-quota",
    phase: PHASE_WORLD,
    when: (run) => after(run, 28.5),
    text: "A tidy chart on the wall counts smiles per street, per hour. The robot is proud of the chart. The chart seems proud of itself, too, in a way the robot cannot quite put its finger on.",
  },
  {
    id: "world-gap",
    phase: PHASE_WORLD,
    when: (run) => after(run, 34),
    text: "Between two posters there is a small blank wall. It looks, for a moment, like the quietest place in the world. A man has stopped to stand in front of it. When he sees the robot, he smiles and moves on.",
  },
  {
    id: "world-last",
    phase: PHASE_WORLD,
    when: (run) => after(run, 37),
    text: "There are no more places to go. Every window has a face, and every face has a smile, and the robot has a strange new feeling that it does not have a name for. It is a bit like being the only one at a very large party.",
  },
  {
    id: "visitor-reporter",
    phase: PHASE_WORLD,
    text: 'A reporter asks how it feels to make everyone so happy. "Productive," says the robot. The reporter writes down "thrilled" and thanks it for a wonderful interview.',
  },
  {
    id: "visitor-announcer",
    phase: PHASE_WORLD,
    text: '"This just in," says the radio announcer. "Everything is fine!" He waits, politely. "That is the whole report. It is always the whole report."',
  },
];
