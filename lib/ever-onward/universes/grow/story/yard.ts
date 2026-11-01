import type { RunState, StoryMessage } from "../../../engine/types";
import { PHASE_YARD } from "../resources";
import { seasonOf } from "../seasons";
import { isDry } from "../water";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** Seconds of yard time (the yard is the first phase, so the run clock). */
const year = (run: RunState, n: number): boolean => run.time >= n * 360;

/** A visitor's line fires the moment it arrives. */
const arrives = (id: string) => (run: RunState) =>
  run.flags[`here-${id}`] === true;

export const yard: StoryMessage[] = [
  {
    id: "yard-hello",
    phase: PHASE_YARD,
    text: "A seed, a pot, a bit of sun. You pour a little water and the soil goes dark and soft. Somewhere under it, something is thinking about growing.",
  },
  {
    id: "yard-sprinkler",
    phase: PHASE_YARD,
    when: (run) => owned(run, "sprinkler") >= 1,
    text: "The first sprinkler hiccups, coughs, and then starts to drip. The seed has never been so well looked after. It does not say thank you, but it does lean toward you a little.",
  },
  {
    id: "yard-basket",
    phase: PHASE_YARD,
    when: (run) => owned(run, "basket") >= 1,
    text: "A wicker basket sits by the row and quietly collects whatever is ripe. Pick by hand in autumn and the harvest is even better. Ripe things wait for you, they never spoil.",
  },
  {
    id: "yard-summer",
    phase: PHASE_YARD,
    when: (run) => seasonOf(run) === "summer",
    text: "Summer! The sprinklers and bees work extra hard when the sun stays out late. The bees have started to notice the flowers.",
  },
  {
    id: "yard-autumn",
    phase: PHASE_YARD,
    when: (run) => seasonOf(run) === "autumn",
    text: "Autumn, and the garden is heavy with ripe things. If you pick by hand now, the harvest is the best of the year.",
  },
  {
    id: "yard-winter",
    phase: PHASE_YARD,
    when: (run) => seasonOf(run) === "winter",
    text: "Winter. The garden rests under a thin white blanket, and so, for a moment, can you. Nothing is lost. Spring is already thinking about coming back.",
  },
  {
    id: "yard-thirsty",
    phase: PHASE_YARD,
    when: (run) => run.time > 60 && isDry(run),
    text: "The rain took a holiday and the garden is thirsty. It still grows, only slower. A barrel to catch the next shower would help.",
  },
  {
    id: "yard-barrel",
    phase: PHASE_YARD,
    when: (run) => owned(run, "rain-barrel") >= 1,
    text: "The rain barrel fills up with a happy plink, plink, plink. Now a dry week is much easier to wait out.",
  },
  {
    id: "yard-bees",
    phase: PHASE_YARD,
    when: (run) => owned(run, "bee-hive") >= 1,
    text: "A hive of bees moves in by the fence. They have opinions about the sunflowers, and they are always right.",
  },
  {
    id: "yard-gardener",
    phase: PHASE_YARD,
    when: (run) => owned(run, "gardener") >= 1,
    text: "A small gardener bot trundles down the row with a tidy little rake. It picks a good share of the ripe produce and hums while it does. Ever onward.",
  },
  {
    id: "yard-hives",
    phase: PHASE_YARD,
    when: (run) => owned(run, "bee-hive") >= 6,
    text: "Six hives now, and the hum can be heard from the road. The honey is not for sale, but the neighbors keep asking about it anyway.",
  },
  {
    id: "yard-tea",
    phase: PHASE_YARD,
    when: (run) => owned(run, "compost-tea") >= 1,
    text: "The compost tea smells a little like a wet sock. The tomatoes have never looked happier, so you decide not to say anything.",
  },
  {
    id: "yard-barrow",
    phase: PHASE_YARD,
    when: (run) => owned(run, "wheelbarrow") >= 1,
    text: "A wheelbarrow with one squeaky wheel joins the crew. It announces itself before it arrives, which is considerate.",
  },
  {
    id: "yard-crew",
    phase: PHASE_YARD,
    when: (run) => owned(run, "gardener") >= 6,
    text: "Six gardener bots go down the rows in a neat line, picking in step. A passing child waves. Six robots wave back, all at once.",
  },
  {
    id: "yard-greenhouse",
    phase: PHASE_YARD,
    when: (run) => owned(run, "greenhouse") >= 1,
    text: "The greenhouse glows like a lantern at dusk. Inside it is always a little bit summer, and the tomatoes are very pleased about that.",
  },
  {
    id: "yard-frame",
    phase: PHASE_YARD,
    when: (run) =>
      run.revealed.includes("cold-frame") && owned(run, "greenhouse") >= 1,
    text: "There is one more thing to build: a small cold frame at the edge of the yard. Behind it, past the fence, the field starts. It is a very big field.",
  },
  {
    id: "yard-orchard",
    phase: PHASE_YARD,
    when: (run) => owned(run, "orchard") >= 1,
    text: "Three thin saplings go in along the fence. An apple, a pear and a fig that has no business growing here. You water them like they are royalty.",
  },
  {
    id: "yard-honey",
    phase: PHASE_YARD,
    when: (run) => owned(run, "honey-stand") >= 1,
    text: "The honey stand has a hand-painted sign with a bee on it. A queue forms by lunchtime. Nobody can say what they are queuing for, only that it is lovely.",
  },
  {
    id: "yard-year-1",
    phase: PHASE_YARD,
    when: (run) => year(run, 1),
    text: "A whole year has gone round, spring to winter. The window box is getting a bit crowded. This is a very good problem.",
  },
  {
    id: "yard-year-2",
    phase: PHASE_YARD,
    when: (run) => year(run, 2),
    text: "Another year. A neighbor leans over the fence to ask what you are feeding the tomatoes. You say sunshine, and mean it.",
  },
  {
    id: "yard-year-3",
    phase: PHASE_YARD,
    when: (run) => year(run, 3),
    text: "Year three. The sunflowers are taller than the shed, and one of them seems to be watching the road.",
  },
  {
    id: "yard-year-4",
    phase: PHASE_YARD,
    when: (run) => year(run, 4),
    text: "Year four. The whole yard is humming. Someone has started leaving jam jars on the wall, with notes.",
  },
  {
    id: "yard-year-5",
    phase: PHASE_YARD,
    when: (run) => year(run, 5),
    text: "Year five. There is more garden than gardener, and you cannot say you mind. The cold frame is looking at you hopefully.",
  },
  {
    id: "yard-mid",
    phase: PHASE_YARD,
    when: (run) => run.time >= 960,
    text: "Somebody has hung a little wind chime from the shed roof. Nobody admits to it. It rings whenever the garden does something particularly well, which is often.",
  },
  {
    id: "yard-late-1",
    phase: PHASE_YARD,
    when: (run) => run.time >= 1200,
    text: "The jam jars on the wall have started to come back, washed, with a note in each. One says only: more tomatoes, please. You take that seriously.",
  },
  {
    id: "yard-late-1b",
    phase: PHASE_YARD,
    when: (run) => run.time >= 1300,
    text: "A small brass plaque has appeared on the garden gate. It reads: Gardener, robot, and extremely good at it. You did not order it. You keep it.",
  },
  {
    id: "yard-late-2",
    phase: PHASE_YARD,
    when: (run) => run.time >= 1560,
    text: "The hedge has grown a door. Behind it, the bees have built a second city. They send a polite buzz of thanks every morning at six.",
  },
  {
    id: "yard-late-3",
    phase: PHASE_YARD,
    when: (run) => run.time >= 1740,
    text: "From the top of the shed you can see the whole yard, green from fence to fence, and past the fence, a field waiting for its turn. The robot hums. Ever onward.",
  },
  {
    id: "visitor-ladybirds",
    phase: PHASE_YARD,
    when: arrives("visitor-ladybirds"),
    text: "A parade of ladybirds files across the fence, all in step, and settles on the tomatoes. They leave a small pile of seeds behind, which is very polite of them.",
  },
  {
    id: "visitor-neighbor",
    phase: PHASE_YARD,
    when: arrives("visitor-neighbor"),
    text: "The neighbor arrives with a ladder, a bucket and a plan to help with the apples. She leaves you a handful of seeds from her own garden and a very long story about her cat.",
  },
  {
    id: "yard-news-1",
    phase: PHASE_YARD,
    when: (run) => owned(run, "bee-hive") >= 2,
    text: "NEWS: Local bees report that the new flowers are the best in the street. A neighbor says her tomatoes have started to wave. Experts say it is probably the wind.",
  },
  {
    id: "yard-news-2",
    phase: PHASE_YARD,
    when: (run) => run.time >= 1500,
    text: "NEWS: A hedge is now taller than the house it belongs to. The council has asked it to stop. The hedge says it will think about it, and then grows another inch.",
  },
];
