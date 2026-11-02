import { visitorHereFlag } from "../../../engine/engine";
import type { RunState, StoryMessage } from "../../../engine/types";
import { descentShare } from "../descent";
import { forkSide } from "../forks";
import { owned } from "../lines";
import { PHASE_TOP, RETURN_VISITOR_ID } from "../resources";

const returned = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;

const down = (share: number) => (run: RunState) => descentShare(run) >= share;

export const top: StoryMessage[] = [
  {
    id: "top-hello",
    phase: PHASE_TOP,
    text: "The last block clicks into place. The robot stands on top of the tallest thing there has ever been, and looks around. The sky is wide, and nobody is here to see it.",
  },
  {
    id: "top-quiet",
    phase: PHASE_TOP,
    when: (run) => run.taps >= 3 || run.time >= 20,
    text: "The robot waits for someone to cheer. The wind goes by instead, very politely.",
  },
  {
    id: "top-lamp",
    phase: PHASE_TOP,
    when: (run) => owned(run, "stair-lamp") >= 1,
    text: "The robot lights a lamp on the top step. It is not for building. It is only for the dark.",
  },
  {
    id: "top-bird",
    phase: PHASE_TOP,
    when: (run) => owned(run, "songbird") >= 1,
    text: "A small bird lands on the rail and looks at the robot. It does not ask what the robot is building. The robot is very grateful.",
  },
  {
    id: "top-block",
    phase: PHASE_TOP,
    when: (run) => owned(run, "stair-lamp") >= 2,
    text: "There is one block left in the robot's hands: a plain wooden one, a bit chipped, with a faded letter B on the side. It came from the playroom. The robot has carried it the whole way.",
  },
  {
    id: "top-stairs",
    phase: PHASE_TOP,
    when: (run) => forkSide(run, "top") === 0,
    text: "The robot takes the stairs, one at a time. They go round and round, and every landing has a window.",
  },
  {
    id: "top-lift",
    phase: PHASE_TOP,
    when: (run) => forkSide(run, "top") === 1,
    text: "The old lift creaks into life. It smells of oil and dust and the inside of a very long afternoon.",
  },
  {
    id: "top-hum",
    phase: PHASE_TOP,
    when: (run) => owned(run, "hum") >= 1,
    text: "The robot hums something. It does not remember where it learned it. Someone sang it, a long time ago, on a rug.",
  },
  {
    id: "top-window",
    phase: PHASE_TOP,
    when: down(0.2),
    text: "Through a window, the robot sees the town. The streets are quiet and the lamps are on for no one. Everyone is up in the tower somewhere, behind a lit window. The robot keeps walking down.",
  },
  {
    id: "top-clouds",
    phase: PHASE_TOP,
    when: down(0.4),
    text: "Down through the clouds again. They feel like a cold wet sheet, the same as before, but now it feels like going home.",
  },
  {
    id: "top-lantern",
    phase: PHASE_TOP,
    when: (run) => owned(run, "block-lantern") >= 1,
    text: "The robot wraps the block in a cloth and puts a tiny candle beside it. Not because the block is cold, but because it seems like the right way to carry something.",
  },
  {
    id: "top-geese",
    phase: PHASE_TOP,
    when: down(0.6),
    text: "Some geese fly straight past the tower without going around. It is a little thing. The robot notices it anyway.",
  },
  {
    id: "top-grass",
    phase: PHASE_TOP,
    when: down(0.85),
    text: "Grass. The robot can smell it before it can see it. It is wet and green, and it goes on in every direction, and not one thing on it needs building.",
  },
  {
    id: RETURN_VISITOR_ID,
    phase: PHASE_TOP,
    when: returned,
    text: "On the grass sits a kid, cross-legged, with a few wooden blocks. Do you want to play? the kid says.",
  },
  {
    id: "top-child",
    phase: PHASE_TOP,
    when: returned,
    text: "The robot sits down. It puts its one block on the grass, and the kid puts another one on top. It is a very small tower. It is exactly the right height.",
  },
  {
    id: "top-end-1",
    phase: PHASE_TOP,
    when: returned,
    text: "Higher? asks the kid. The robot thinks about it for a long time. No, it says. Just like this.",
  },
  {
    id: "top-end-2",
    phase: PHASE_TOP,
    when: returned,
    text: "They stack until the sun goes down, and then they leave it standing for the morning. Far above them, the great tower keeps all its lights on, and nobody is looking.",
  },
];
