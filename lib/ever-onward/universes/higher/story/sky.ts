import { visitorHereFlag } from "../../../engine/engine";
import type { RunState, StoryMessage } from "../../../engine/types";
import { forkSide } from "../forks";
import { owned } from "../lines";
import { PHASE_SKY } from "../resources";
import { swayOf } from "../sway";

const arrives = (id: string) => (run: RunState) =>
  run.flags[visitorHereFlag(id)] === true;

export const sky: StoryMessage[] = [
  {
    id: "sky-hello",
    phase: PHASE_SKY,
    text: "The tower goes up through the clouds, which feel like walking through a cold wet sheet. On the other side the sun is out. It is very bright up here, and very quiet.",
  },
  {
    id: "sky-crew",
    phase: PHASE_SKY,
    when: (run) => owned(run, "sky-crew") >= 1,
    text: "A crew sets up on a platform above the weather, small and orange against the blue. They wave down. Nobody waves back, because nobody can see them.",
  },
  {
    id: "sky-lean",
    phase: PHASE_SKY,
    when: (run) => swayOf(run) >= 0.45,
    text: "Up here the tower sways like a tall tree. It is a bit like being rocked to sleep, and a bit not.",
  },
  {
    id: "sky-shadow",
    phase: PHASE_SKY,
    when: (run) => owned(run, "cloud-crane") >= 1,
    text: "The tower's shadow is very long now. It lies across the town like a finger, and the streets under it are quiet.",
  },
  {
    id: "sky-elevator",
    phase: PHASE_SKY,
    when: (run) => forkSide(run, "sky") === 0,
    text: "A cable as thin as a hair goes up and up. The town is in the shade, and some of the lamps come on early.",
  },
  {
    id: "sky-terrace",
    phase: PHASE_SKY,
    when: (run) => forkSide(run, "sky") === 1,
    text: "Terraces step out into the sky, with grass on top. The sun gets round the edges and lands on the streets, a little.",
  },
  {
    id: "visitor-geese",
    phase: PHASE_SKY,
    when: arrives("visitor-geese"),
    text: "Geese come by, honking. They have to fly around the tower now. They do not seem to mind, and then, a little bit, they do.",
  },
  {
    id: "sky-lights",
    phase: PHASE_SKY,
    when: (run) => owned(run, "sky-crew") >= 4,
    text: "Someone has moved into the lower floors. And then someone else. It seems warm in there, and the lifts are very good.",
  },
  {
    id: "sky-damper",
    phase: PHASE_SKY,
    when: (run) => owned(run, "damper") >= 1,
    text: "The big steel ball in the middle swings very slowly. It is the only thing in the whole tower that is not in a hurry.",
  },
  {
    id: "sky-square",
    phase: PHASE_SKY,
    when: (run) => owned(run, "cloud-crane") >= 3,
    text: "The town square is quiet. The market stalls are empty, and one lamp-post is switched on for no one.",
  },
  {
    id: "visitor-cloudwasher",
    phase: PHASE_SKY,
    when: arrives("visitor-cloudwasher"),
    text: "A window cleaner arrives on a rope, a very long way from home. I started at the bottom, he says, and I am still on the same window. He waves and goes.",
  },
  {
    id: "sky-cable",
    phase: PHASE_SKY,
    when: (run) => owned(run, "cable-spinner") >= 1,
    text: "The cable spinner hums. It spins one thread, and then another, and the robot wonders how many threads there are in the sky.",
  },
  {
    id: "sky-eye",
    phase: PHASE_SKY,
    when: (run) => owned(run, "cable-spinner") >= 3,
    text: "In a dark window a few floors below, something is looking out. It might be a lamp. It might be a very patient cat.",
  },
  {
    id: "sky-beacon",
    phase: PHASE_SKY,
    when: (run) => owned(run, "beacon") >= 1,
    text: "A red light blinks at the very top. The aeroplanes go round it politely, the way you go round a person who is talking to themselves.",
  },
  {
    id: "sky-last",
    phase: PHASE_SKY,
    when: (run) => owned(run, "beacon") >= 1,
    text: "One more block. Just one. Then there will be nothing higher than this tower, and the robot will finally be done.",
  },
];
