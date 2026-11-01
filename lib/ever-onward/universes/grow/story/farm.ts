import type { RunState, StoryMessage } from "../../../engine/types";
import { visitorHereFlag } from "../../../engine/engine";
import { plantingsSoFar } from "../market";
import { PHASE_FARM } from "../resources";
import { phaseTime } from "../seasons";
import { isDry } from "../water";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** True once the farm has been open this many minutes. */
const after = (run: RunState, minutes: number): boolean =>
  phaseTime(run) >= minutes * 60;

/** A visitor's line fires the moment it arrives. */
const arrives = (id: string) => (run: RunState) =>
  run.flags[visitorHereFlag(id)] === true;

export const farm: StoryMessage[] = [
  {
    id: "farm-hello",
    phase: PHASE_FARM,
    text: "Rows of green stretch to the fence, and the fence is a long way off. The scarecrow tips his hat to you. It is a very good hat.",
  },
  {
    id: "farm-scarecrow",
    phase: PHASE_FARM,
    when: (run) => owned(run, "scarecrow") >= 1,
    text: "The first scarecrow takes up his post and waves at a crow. The crow waves back. They seem to have come to an arrangement.",
  },
  {
    id: "farm-market",
    phase: PHASE_FARM,
    when: (run) => after(run, 1),
    text: "Three towns have sent notes to the farm gate. One wants tomatoes, one wants corn, and one wants a pumpkin the size of a cart. What they want changes with the weather and the week, so keep an eye on the orders.",
  },
  {
    id: "farm-well",
    phase: PHASE_FARM,
    when: (run) => owned(run, "well") >= 1,
    text: "The well goes down, and down, and down, and then something far below says plink. Cool water for the rows, rain or no rain.",
  },
  {
    id: "farm-thirsty",
    phase: PHASE_FARM,
    when: (run) => after(run, 1) && isDry(run),
    text: "The fields are thirsty and the sky is being stubborn. Everything still grows, only slower. A well would help, and so would a little patience.",
  },
  {
    id: "farm-switch",
    phase: PHASE_FARM,
    when: (run) => plantingsSoFar(run) >= 1,
    text: "You plant what the towns are asking for, and a small green row pokes up to see what the fuss is about. Switching crops takes a moment to sprout, so pick one worth waiting for.",
  },
  {
    id: "farm-compost",
    phase: PHASE_FARM,
    when: (run) => owned(run, "compost") >= 1,
    text: "The compost heap steams gently in the morning cold. It smells like a very ambitious sandwich, and the soil adores it.",
  },
  {
    id: "farm-tractor",
    phase: PHASE_FARM,
    when: (run) => owned(run, "tractor") >= 1,
    text: "Putt, putt, putt. The green tractor rolls out of the shed and does a whole row before the scarecrow has finished his yawn.",
  },
  {
    id: "farm-time-1",
    phase: PHASE_FARM,
    when: (run) => after(run, 4),
    text: "A farm cat has moved into the hayloft without asking. It supervises everything from a very high beam and approves of most of it.",
  },
  {
    id: "farm-agent",
    phase: PHASE_FARM,
    when: (run) => owned(run, "market-agent") >= 1,
    text: "A cheerful person with a clipboard turns up at the gate. They will ask the towns what they want and plant it now and then. Plant it yourself, though, and it will be done sooner and better.",
  },
  {
    id: "farm-time-2",
    phase: PHASE_FARM,
    when: (run) => after(run, 7),
    text: "A school class visits to see where tomatoes come from. One child asks why the tomatoes are not in the shop already. It is a very fair question.",
  },
  {
    id: "farm-irrigation",
    phase: PHASE_FARM,
    when: (run) => owned(run, "irrigation") >= 1,
    text: "Little ditches fan out between the rows, and the rain finds every single one. The frogs move in the same afternoon.",
  },
  {
    id: "farm-time-3",
    phase: PHASE_FARM,
    when: (run) => after(run, 10),
    text: "The harvest festival is on Saturday. The scarecrow has been asked to judge the pies. He has asked for a very small slice.",
  },
  {
    id: "farm-glasshouse",
    phase: PHASE_FARM,
    when: (run) => owned(run, "glasshouse") >= 1,
    text: "Glass, glass and more glass. Inside it is warm all year and the tomatoes have lost track of the seasons entirely.",
  },
  {
    id: "farm-time-4",
    phase: PHASE_FARM,
    when: (run) => after(run, 13),
    text: "The towns are getting along beautifully. The corn town sent a parcel of cake to the pumpkin town, just because.",
  },
  {
    id: "farm-silo",
    phase: PHASE_FARM,
    when: (run) => owned(run, "silo") >= 1,
    text: "A tall silo goes up beside the barn-shaped gap. Inside it is dry and dim and smells of warm bread. Echoes live there now, and they are very polite.",
  },
  {
    id: "farm-time-9",
    phase: PHASE_FARM,
    when: (run) => after(run, 15.5),
    text: "A cloud sits over the far field and thinks about rain. Whatever it decides, the crops are ready.",
  },
  {
    id: "farm-time-5",
    phase: PHASE_FARM,
    when: (run) => after(run, 18),
    text: "The farm is the biggest thing for miles. A passing goose has been counting the rows and has lost count twice.",
  },
  {
    id: "farm-drone",
    phase: PHASE_FARM,
    when: (run) => owned(run, "seed-drone") >= 1,
    text: "A seed drone lifts off with a tiny whirr and drops seeds exactly where the soil wants them. Nobody had to ask it twice.",
  },
  {
    id: "farm-time-10",
    phase: PHASE_FARM,
    when: (run) => after(run, 20.5),
    text: "The towns have started a friendly argument about whose crop is the best. Nobody is cross. The scarecrow says they are all very good crops.",
  },
  {
    id: "farm-time-6",
    phase: PHASE_FARM,
    when: (run) => after(run, 23),
    text: "The county newspaper sends a photographer. The scarecrow stands very still and does his best side.",
  },
  {
    id: "farm-time-11",
    phase: PHASE_FARM,
    when: (run) => owned(run, "seed-drone") >= 2,
    text: "Evening falls over the rows. The tractor is parked, the drone is blinking sleepily, and the whole farm hums.",
  },
  {
    id: "farm-time-7",
    phase: PHASE_FARM,
    when: (run) => owned(run, "seed-drone") >= 3,
    text: "There is more green here than anyone expected. The farm has become the town's favourite place to have a picnic.",
  },
  {
    id: "farm-time-12",
    phase: PHASE_FARM,
    when: (run) => owned(run, "seed-drone") >= 4,
    text: "A child in the next county draws the farm from memory. It has a very large sun and a very small scarecrow, and it is quite right.",
  },
  {
    id: "farm-time-8",
    phase: PHASE_FARM,
    when: (run) => owned(run, "seed-drone") >= 5,
    text: "Somewhere past the last row, a bigger barn is quietly being drawn on a very large piece of paper.",
  },
  {
    id: "visitor-starlings",
    phase: PHASE_FARM,
    when: arrives("visitor-starlings"),
    text: "A swirl of starlings pours across the sky, folds itself into a tidy arrow and points at the best field. Then it drops a little harvest by the gate and flies off, very pleased with itself.",
  },
  {
    id: "visitor-mayor",
    phase: PHASE_FARM,
    when: arrives("visitor-mayor"),
    text: "The mayor of the three towns arrives in a hat with a feather in it, to say thank you on everyone's behalf. She leaves a basket of harvest and a very long list of kind words.",
  },
  {
    id: "farm-robot",
    phase: PHASE_FARM,
    when: (run) => owned(run, "tractor") >= 2,
    text: "The little gardener robot has rolled over from the old yard. It is not sure what a tractor is, but it has decided they are friends. It polishes the headlamp and hums. Ever onward.",
  },
  {
    id: "farm-news-1",
    phase: PHASE_FARM,
    when: (run) => owned(run, "scarecrow") >= 3,
    text: "NEWS: The three towns agree that this year's crops are the best-looking in the county. A scarecrow was asked for a comment and, as usual, stood by what he had said.",
  },
  {
    id: "farm-news-2",
    phase: PHASE_FARM,
    when: (run) => owned(run, "glasshouse") >= 2,
    text: "NEWS: Local glasshouse reports that its tomatoes have started telling jokes. Experts say they are not very good ones, but the tomatoes are laughing, so that is all right.",
  },
];
