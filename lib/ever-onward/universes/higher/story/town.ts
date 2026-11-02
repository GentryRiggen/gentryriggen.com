import { visitorHereFlag } from "../../../engine/engine";
import type { RunState, StoryMessage } from "../../../engine/types";
import { forkSide } from "../forks";
import { knowhowOf, overtimeSoFar } from "../knowhow";
import { owned } from "../lines";
import { PHASE_TOWN } from "../resources";
import { swayOf } from "../sway";

const arrives = (id: string) => (run: RunState) =>
  run.flags[visitorHereFlag(id)] === true;

export const town: StoryMessage[] = [
  {
    id: "town-hello",
    phase: PHASE_TOWN,
    text: "The treehouse became a tower, and the tower is in the town square. A crowd gathers, and somebody starts clapping. It catches on.",
  },
  {
    id: "town-mason",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "mason") >= 1,
    text: "A mason in a yellow hat lays the first row. She whistles while she works, and everybody within a block starts whistling too.",
  },
  {
    id: "town-scaffold",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "scaffolding") >= 1,
    text: "Scaffolding climbs the tower like ivy. The pigeons move in at once.",
  },
  {
    id: "town-lean",
    phase: PHASE_TOWN,
    when: (run) => swayOf(run) >= 0.45,
    text: "The tower leans, just a little. A man with a clipboard says hmm. The crew pulls a rope, and it stands straight again.",
  },
  {
    id: "town-steel",
    phase: PHASE_TOWN,
    when: (run) => forkSide(run, "town") === 0,
    text: "Steel arrives on a long truck, as bright as a new coin. The tower gleams, and the crews are far too busy to learn anything.",
  },
  {
    id: "town-timber",
    phase: PHASE_TOWN,
    when: (run) => forkSide(run, "town") === 1,
    text: "Timber arrives, smelling like a forest. The tower looks warm, and a bit like a very large treehouse. The crews chat about it all day.",
  },
  {
    id: "town-crane",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "crane") >= 1,
    text: "The first tower crane swings out over the roofs. Children wave. The crane driver waves back, from very high up.",
  },
  {
    id: "visitor-mayor",
    phase: PHASE_TOWN,
    when: arrives("visitor-mayor"),
    text: "The mayor arrives with enormous scissors and cuts a ribbon right across the street. The tallest building in the valley, she says. Everybody cheers.",
  },
  {
    id: "town-knowhow",
    phase: PHASE_TOWN,
    when: (run) => knowhowOf(run) >= 30,
    text: "The crews know things now: where the wind comes from, how concrete sets, what the pigeons think. All of it is know-how, and it is piling up.",
  },
  {
    id: "town-overtime",
    phase: PHASE_TOWN,
    when: (run) => overtimeSoFar(run) >= 1,
    text: "Overtime! Lunch is moved to later. The cranes swing faster, and the whistling gets louder.",
  },
  {
    id: "town-truck",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "concrete-truck") >= 1,
    text: "The concrete truck rumbles up and pours a whole floor before lunch. Nobody can quite remember where the last floor went.",
  },
  {
    id: "visitor-pigeons",
    phase: PHASE_TOWN,
    when: arrives("visitor-pigeons"),
    text: "The pigeons walk the planks as if they own the place. They do, a bit.",
  },
  {
    id: "town-cheers",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "crane") >= 4,
    text: "The crowd is smaller than it was this morning, but it cheers just as loud. Most people have gone home for tea.",
  },
  {
    id: "town-neon",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "neon-sign") >= 1,
    text: "TOWER lights up in letters as tall as a bus. You can see it from three towns away.",
  },
  {
    id: "town-top",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "neon-sign") >= 1,
    text: "One more floor will make it the tallest thing in the valley. Then the robot will be done. Probably.",
  },
];
