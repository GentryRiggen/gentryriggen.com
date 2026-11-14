import { visitorHereFlag } from "../../../engine/engine";
import type { RunState, StoryMessage } from "../../../engine/types";
import { loadsPlaced } from "../deliveries";
import { footingChanges } from "../footing";
import { forkSide } from "../forks";
import { owned } from "../lines";
import { PHASE_PLAYROOM } from "../resources";
import { swayOf } from "../sway";

/** A visitor's line fires the moment it arrives. */
const arrives = (id: string) => (run: RunState) =>
  run.flags[visitorHereFlag(id)] === true;

export const playroom: StoryMessage[] = [
  {
    id: "play-hello",
    phase: PHASE_PLAYROOM,
    text: "A rug, a box of wooden blocks and one small robot. A voice from somewhere says, build it higher. The robot has no better idea, so it stacks a block.",
  },
  {
    id: "play-bear",
    phase: PHASE_PLAYROOM,
    when: (run) => owned(run, "bear") >= 1,
    text: "A teddy bear sits up, picks a block in both paws and adds it to the tower. He has never stacked anything before, and he is very good at it.",
  },
  {
    id: "play-lean",
    phase: PHASE_PLAYROOM,
    when: (run) => swayOf(run) >= 0.45,
    text: "The tower leans a little to the left, the way tall things do. A gentle push and it stands straight again. The robot makes a note: tall things need looking after.",
  },
  {
    id: "play-corners",
    phase: PHASE_PLAYROOM,
    when: (run) => owned(run, "rug-corners") >= 1,
    text: "Tape on the rug corners. The rug stops sliding, and the tower stops doing its little dance.",
  },
  {
    id: "visitor-cat",
    phase: PHASE_PLAYROOM,
    when: arrives("visitor-cat"),
    text: "A cat comes to sit on the rug and watch. It has opinions about the tower, and none of them are bad.",
  },
  {
    id: "play-ramp",
    phase: PHASE_PLAYROOM,
    when: (run) => owned(run, "ramp") >= 1,
    text: "A cardboard ramp! Blocks roll up and sit down on the tower as if they had planned it all along.",
  },
  {
    id: "play-fork",
    phase: PHASE_PLAYROOM,
    when: (run) => forkSide(run, "play") !== null,
    text: "The tower has chosen its shape. The robot pats it gently, the way you would pat a very tall friend.",
  },
  {
    id: "play-footing",
    phase: PHASE_PLAYROOM,
    when: (run) => footingChanges(run) >= 1,
    text: "Under the tower, a few wide blocks hold everything up. Nobody sees them. Everybody leans on them.",
  },
  {
    id: "play-load",
    phase: PHASE_PLAYROOM,
    when: (run) => loadsPlaced(run) >= 1,
    text: "A box of something arrives, and the robot decides where it goes. Then another box, and another. It is a lot like a birthday.",
  },
  {
    id: "play-crane",
    phase: PHASE_PLAYROOM,
    when: (run) => owned(run, "toy-crane") >= 1,
    text: "The toy crane whirrs. It is plastic and yellow, and it lifts a block higher than the robot could ever reach.",
  },
  {
    id: "visitor-dad",
    phase: PHASE_PLAYROOM,
    when: arrives("visitor-dad"),
    text: "Dad kneels down with the camera. Higher, he says, and laughs. The robot nods. Higher it is.",
  },
  {
    id: "play-window",
    phase: PHASE_PLAYROOM,
    when: (run) => owned(run, "toy-crane") >= 3,
    text: "The tower is as tall as the bookcase. Then as tall as the window. The robot looks up and thinks: higher.",
  },
  {
    id: "play-fairy",
    phase: PHASE_PLAYROOM,
    when: (run) => owned(run, "fairy-lights") >= 1,
    text: "Fairy lights wind round the tower, and the whole playroom glows. The robot has never been so proud of anything.",
  },
  {
    id: "play-plan",
    phase: PHASE_PLAYROOM,
    when: (run) => owned(run, "fairy-lights") >= 1,
    text: "There is a plan now, and it is a good one: a treehouse. Planks, a rope ladder and a flag. Out of the window and into the garden.",
  },
];
