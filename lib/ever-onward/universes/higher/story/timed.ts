import type { RunState, StoryMessage } from "../../../engine/types";
import { PHASE_PLAYROOM, PHASE_SKY, PHASE_TOP, PHASE_TOWN } from "../resources";

/** Minutes spent in the current part (the run clock minus when it began). */
const minutesIn = (run: RunState): number =>
  (run.time - (run.transitions.at(-1)?.at ?? 0)) / 60;

const after = (minutes: number) => (run: RunState) => minutesIn(run) >= minutes;

/**
 * Small moments that come with the passing of time rather than a purchase,
 * so the story keeps moving through the long stretches between big steps.
 * Light at first, and a little stranger as the tower gets taller.
 */
export const timed: StoryMessage[] = [
  {
    id: "play-count",
    phase: PHASE_PLAYROOM,
    when: after(3.5),
    text: "The robot counts the blocks. It loses its place at about a hundred and starts again, quite happily.",
  },
  {
    id: "play-plane",
    phase: PHASE_PLAYROOM,
    when: after(6.5),
    text: "A paper aeroplane lands on the roof of the tower and stays there. Nobody sends it back.",
  },
  {
    id: "play-bedtime",
    phase: PHASE_PLAYROOM,
    when: after(9),
    text: "Somebody mentions bedtime in the next room, in a quiet voice. It is not discussed with the robot.",
  },
  {
    id: "play-shadow",
    phase: PHASE_PLAYROOM,
    when: after(12.5),
    text: "The tower casts a long shadow across the rug. It is shaped, a little, like a very tall question mark.",
  },
  {
    id: "play-biscuit",
    phase: PHASE_PLAYROOM,
    when: after(10.8),
    text: "A biscuit appears on the rug. The robot is not sure whose it is, so it builds carefully around it.",
  },
  {
    id: "play-torch",
    phase: PHASE_PLAYROOM,
    when: after(14.5),
    text: "Someone shines a torch up the tower to see how far it goes. The beam gets lost somewhere near the top.",
  },
  {
    id: "play-ladder",
    phase: PHASE_PLAYROOM,
    when: after(26),
    text: "The robot looks at the rope ladder it is about to build. It looks at the tower. It looks at the ladder again.",
  },
  {
    id: "play-dusk",
    phase: PHASE_PLAYROOM,
    when: after(27.8),
    text: "Evening comes in through the window and turns every block gold. The robot does not stop to look. It would, if it could.",
  },
  {
    id: "play-sock",
    phase: PHASE_PLAYROOM,
    when: after(17),
    text: "A sock has been hung on the top block, for decoration or for luck.",
  },
  {
    id: "play-watching",
    phase: PHASE_PLAYROOM,
    when: after(21),
    text: "The cat has stopped watching the tower and started watching the robot. The robot waves.",
  },
  {
    id: "play-enough",
    phase: PHASE_PLAYROOM,
    when: after(24),
    text: "That is enough for today, says a voice from the doorway. The robot thinks about that. Then it stacks one more block, softly, so as not to wake anything.",
  },
  {
    id: "town-clock",
    phase: PHASE_TOWN,
    when: after(5),
    text: "The town clock is at the tower's knees now. It strikes noon, and everyone looks up instead of at it.",
  },
  {
    id: "town-bakery",
    phase: PHASE_TOWN,
    when: after(7),
    text: "The bakery sells tower-shaped rolls. They are very good, and the queue goes right round the block.",
  },
  {
    id: "town-gull",
    phase: PHASE_TOWN,
    when: after(11),
    text: "A gull lands on the scaffold and looks at the town from higher up than a gull has ever been. It seems pleased with itself.",
  },
  {
    id: "town-chalk",
    phase: PHASE_TOWN,
    when: after(9),
    text: "Kids draw the tower on the pavement in chalk. Rain comes. The next day they draw it taller.",
  },
  {
    id: "town-reporter",
    phase: PHASE_TOWN,
    when: after(13),
    text: "A reporter asks the robot how tall it will be. Higher, says the robot. The reporter writes it down twice.",
  },
  {
    id: "town-weather",
    phase: PHASE_TOWN,
    when: after(18),
    text: "The tower has its own weather now. A small cloud sits on the thirtieth floor and will not be moved.",
  },
  {
    id: "town-tea",
    phase: PHASE_TOWN,
    when: after(22),
    text: "Tea is sent up to the crews in baskets on pulleys. It is still warm when it arrives. The ropes are getting longer.",
  },
  {
    id: "town-lift",
    phase: PHASE_TOWN,
    when: after(27),
    text: "A lift is put in. It has buttons for floors that nobody has visited yet.",
  },
  {
    id: "town-shifts",
    phase: PHASE_TOWN,
    when: after(29),
    text: "The crews work in shifts now, so the tower is never quite asleep. The pigeons have learned to do the same.",
  },
  {
    id: "town-whistle",
    phase: PHASE_TOWN,
    when: after(14.5),
    text: "The whistling has become a tune, and the tune has become a song. Nobody remembers who started it.",
  },
  {
    id: "town-lunch",
    phase: PHASE_TOWN,
    when: after(31),
    text: "The crews eat lunch on a beam, legs swinging. One of them waves at the robot. The robot waves back, and does not stop working.",
  },
  {
    id: "town-quiet",
    phase: PHASE_TOWN,
    when: after(36.5),
    text: "The cheering has thinned to a polite clap, then to a nod. The tower does not seem to notice, and neither does the robot.",
  },
  {
    id: "town-valley",
    phase: PHASE_TOWN,
    when: after(34),
    text: "From the top, the robot can see the whole valley. The river looks like a dropped ribbon. The robot looks up.",
  },
  {
    id: "town-hum",
    phase: PHASE_TOWN,
    when: after(33),
    text: "At night the tower hums. Nobody minds. It sounds a bit like it is thinking.",
  },
  {
    id: "sky-air",
    phase: PHASE_SKY,
    when: after(4),
    text: "The air is thin up here, and everybody speaks slowly. It makes even the jokes sound wise.",
  },
  {
    id: "sky-cloud",
    phase: PHASE_SKY,
    when: after(8),
    text: "The robot passes a cloud shaped exactly like the tower. It is not as tall.",
  },
  {
    id: "sky-sunrise",
    phase: PHASE_SKY,
    when: after(11),
    text: "Up here the sun rises twice, once for the robot and once, a bit later, for everyone below.",
  },
  {
    id: "sky-hush",
    phase: PHASE_SKY,
    when: after(15),
    text: "Sound travels oddly at this height. The robot can hear a teaspoon rattle in a kitchen far below, and not one voice.",
  },
  {
    id: "sky-lamp",
    phase: PHASE_SKY,
    when: after(19.5),
    text: "A lamp is left on at the foot of the tower, all night, for anyone who might be passing. Nobody is.",
  },
  {
    id: "sky-weather",
    phase: PHASE_SKY,
    when: after(25),
    text: "It rains below the tower and shines above it. The robot waters nothing and gets rather a good tan.",
  },
  {
    id: "sky-count",
    phase: PHASE_SKY,
    when: after(36),
    text: "The robot tries to remember what the first block looked like. It was red, probably. It was a very long time ago.",
  },
  {
    id: "sky-flags",
    phase: PHASE_SKY,
    when: after(22),
    text: "The platform is hung with prayer flags, or washing. From here it is hard to say.",
  },
  {
    id: "sky-spider",
    phase: PHASE_SKY,
    when: after(26.5),
    text: "A spider has spun a web between two beams, miles up. It has no idea how it got here either.",
  },
  {
    id: "sky-sign",
    phase: PHASE_SKY,
    when: after(28.2),
    text: "Someone has painted a number on a beam, so the crews know which floor they are on. The paint is still wet. The number is very large.",
  },
  {
    id: "sky-radio",
    phase: PHASE_SKY,
    when: after(30),
    text: "A radio picks up a faint show from the town. The presenter asks if anyone is listening. The robot is, a bit.",
  },
  {
    id: "sky-stars",
    phase: PHASE_SKY,
    when: after(34),
    text: "The stars come out early. They seem closer, and not very interested.",
  },
  {
    id: "sky-moon",
    phase: PHASE_SKY,
    when: after(31.5),
    text: "The moon is level with the tower's shoulder tonight. The robot nods to it, as to a fellow worker.",
  },
  {
    id: "sky-lighter",
    phase: PHASE_SKY,
    when: after(38),
    text: "Every beam is a little lighter than the last, and the robot does not ask why.",
  },
  {
    id: "top-narrow",
    phase: PHASE_TOP,
    when: after(3),
    text: "The stairs are narrow and the robot is wide. It turns sideways, and manages.",
  },
  {
    id: "top-steps",
    phase: PHASE_TOP,
    when: after(6),
    text: "The robot's footsteps sound very loud, and then, after a while, not loud at all.",
  },
  {
    id: "top-bucket",
    phase: PHASE_TOP,
    when: after(10),
    text: "On one landing there is a tiny garden growing in a bucket. The robot waters it from its sleeve.",
  },
  {
    id: "top-note",
    phase: PHASE_TOP,
    when: after(12),
    text: "Someone has left a note on the wall of the stairs. It says GOING DOWN? The robot adds a small tick underneath.",
  },
  {
    id: "top-lights",
    phase: PHASE_TOP,
    when: after(17),
    text: "The lamps on the lower landings are already lit. Someone, or something, has been keeping them for a very long time.",
  },
  {
    id: "top-table",
    phase: PHASE_TOP,
    when: after(15),
    text: "In one room a table is laid for dinner, and nobody is there. The candle is still warm.",
  },
  {
    id: "top-rest",
    phase: PHASE_TOP,
    when: after(18),
    text: "The robot sets the block down to rest. It is lighter than it looks, and heavier than the robot remembers.",
  },
];
