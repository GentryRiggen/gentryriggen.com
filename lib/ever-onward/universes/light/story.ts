import type { RunState, StoryMessage } from "../../engine/types";
import { hasSprouted, picksSoFar } from "./garden";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT, PHASE_SKY } from "./resources";

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

const coast: StoryMessage[] = [
  {
    id: "coast-hello",
    phase: PHASE_COAST,
    text: "Click. The lamp is lit. It is a small, old lighthouse and you are its only keeper. Your job is simple: keep the light on. Clocking in. Ever onward.",
  },
  {
    id: "coast-first-ship",
    phase: PHASE_COAST,
    when: (run) => res(run, "ships") >= 1,
    text: "A little boat sees the beam and turns toward the harbor. Nobody says thank you. You decide that is fine.",
  },
  {
    id: "coast-ten",
    phase: PHASE_COAST,
    when: (run) => res(run, "ships") >= 10,
    text: "Ten ships guided. The harbor master pays a coin for each, and says it is mostly so you will stop waving the lamp at his window.",
  },
  {
    id: "coast-keeper",
    phase: PHASE_COAST,
    when: (run) => owned(run, "keeper") >= 1,
    text: "A keeper joins you. She brings a thermos and an opinion about your wick. You have not told her you are a robot. She has not asked.",
  },
  {
    id: "coast-oil",
    phase: PHASE_COAST,
    when: (run) => res(run, "ships") >= 12,
    text: "Lamps drink oil, and oil has a price that goes up and down like a nervous cat. Buy it when it is cheap and you will sleep better. Or, well, rest better.",
  },
  {
    id: "coast-dim",
    phase: PHASE_COAST,
    when: (run) => res(run, "ships") >= 60 && res(run, "oil") <= 0,
    text: "The oil ran out. The lamp goes dim, but you can still flash it by hand. A lighthouse that is a little dim is better than one that is off.",
  },
  {
    id: "coast-storm",
    phase: PHASE_COAST,
    when: (run) => res(run, "storm") > 0,
    text: "Storm! Ships are scared of storms, which is exactly when they need a bright light. Flash like you mean it.",
  },
  {
    id: "coast-lens",
    phase: PHASE_COAST,
    when: (run) => owned(run, "lens") >= 3,
    text: "The new lens throws the beam farther. Ships you have never met are turning toward you. It is a bit like being famous, only quieter.",
  },
  {
    id: "coast-fees",
    phase: PHASE_COAST,
    when: (run) => owned(run, "fees-2") >= 1,
    text: "Harbor fees are up. A sailor grumbles that it costs more to be saved these days. You blink twice, politely.",
  },
  {
    id: "coast-second",
    phase: PHASE_COAST,
    when: (run) => owned(run, "lighthouse") >= 1,
    text: "A second lighthouse, a few miles down the coast. Two lights are twice as good as one, and only a little more than twice the paperwork.",
  },
  {
    id: "coast-fog",
    phase: PHASE_COAST,
    when: (run) => owned(run, "lighthouse") >= 3,
    text: "On foggy nights the lights talk to each other in flashes. Short, long, short. Nobody has asked what they say. It is mostly good evening.",
  },
  {
    id: "coast-dark-spot",
    phase: PHASE_COAST,
    when: (run) => owned(run, "lighthouse") >= 5,
    text: "Only two dark stretches of coast left. You find that you cannot look at a dark stretch of coast without wanting to put a light on it.",
  },
  {
    id: "coast-tide",
    phase: PHASE_COAST,
    when: (run) => run.flags["tide-open"] === true,
    text: "The fish market has hung a tide clock by the quay. The sea breathes in, and the sea breathes out. A fisherman lends you a net and says: put it out while the water is coming in, and the sea will fill it by itself.",
  },
  {
    id: "coast-trio",
    phase: PHASE_COAST,
    when: (run) => owned(run, "keeper") >= 3,
    text: "Three keepers on the night shift. They take turns making cocoa, and arguing about the best way to coil a rope.",
  },
  {
    id: "coast-crew",
    phase: PHASE_COAST,
    when: (run) => owned(run, "keeper") >= 10,
    text: "Ten keepers. The lamp room is a little crowded and very well dusted. Somebody has hung a tiny paper star in the window.",
  },
  {
    id: "coast-bell",
    phase: PHASE_COAST,
    when: (run) => owned(run, "fees-3") >= 1,
    text: "The toll booth has a brass bell now. Ships ring it on the way in. Ding, thank you. Ding, you are welcome.",
  },
  {
    id: "coast-ferry",
    phase: PHASE_COAST,
    when: (run) => owned(run, "dock-2") >= 1,
    text: "The ferry never stops now. It carries bicycles, baskets of bread, and one very serious goat.",
  },
  {
    id: "coast-mill",
    phase: PHASE_COAST,
    when: (run) => owned(run, "tide-mill") >= 1,
    text: "A little mill turns with the tide, tending a net of its own. It hums while it works. Your own nets are still yours, and the sea has plenty of fish for both of you.",
  },
  {
    id: "coast-almost",
    phase: PHASE_COAST,
    when: (run) => owned(run, "lighthouse") >= 6,
    text: "From a high cliff, the whole coast is a string of small gold beads. The town has noticed, and the mayor is practicing a speech.",
  },
];

const nightStory: StoryMessage[] = [
  {
    id: "night-hello",
    phase: PHASE_NIGHT,
    text: "The mayor's speech is short: the coast is beautiful, thank you. Could you maybe do the streets, too? You say yes. Yes is easy to say.",
  },
  {
    id: "night-crank",
    phase: PHASE_NIGHT,
    when: (run) => run.taps >= 1 && run.time > 3,
    text: "No oil this time. Just a crank and a wire. Turn it and a bulb glows. You turn it again, mostly to see if it works twice.",
  },
  {
    id: "night-gen",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "gen1") >= 1,
    text: "Your first generator hums. A street in the old quarter lights up, and an old man in a window waves at nobody in particular.",
  },
  {
    id: "night-lines",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "lines-2") >= 1,
    text: "Power lines go up, hill to hill. Birds love them. Cities only pay for the light that actually reaches them, so you keep your eye on supply.",
  },
  {
    id: "night-news-1",
    phase: PHASE_NIGHT,
    when: (run) => res(run, "night") <= 90,
    text: "NEWS: Evening shoppers say the streets feel safer than ever. Some residents say they are having trouble sleeping. Experts say that is probably the coffee.",
  },
  {
    id: "night-steam",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "gen2") >= 1,
    text: "Steam plant online. It is loud and it smells like warm pennies, and half a city blinks awake.",
  },
  {
    id: "night-news-2",
    phase: PHASE_NIGHT,
    when: (run) => res(run, "night") <= 70,
    text: "NEWS: A farmer says his roosters now crow at all hours. A doctor says people are sleeping badly. A shop sells curtains. The shop is doing well.",
  },
  {
    id: "night-bulbs",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "bulbs-2") >= 1,
    text: "Efficient bulbs. The same light for less power. You wish everything was this easy to improve. Most things are not, you suspect.",
  },
  {
    id: "night-dam",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "gen3") >= 1,
    text: "The river dam spins. The fish have opinions, but the fish are not on the board.",
  },
  {
    id: "night-steam-row",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "gen2") >= 5,
    text: "Five steam plants in a row, all puffing at once. From far away it looks like a very polite thundercloud.",
  },
  {
    id: "night-smart",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "grid-2") >= 1,
    text: "The grid learns to balance itself. It does a small, happy wobble anyway, just to let you know it is trying.",
  },
  {
    id: "night-news-3",
    phase: PHASE_NIGHT,
    when: (run) => res(run, "night") <= 45,
    text: "NEWS: Astronomers write a polite letter saying they can no longer see the stars from the city. The city replies with a shiny new billboard.",
  },
  {
    id: "night-news-4",
    phase: PHASE_NIGHT,
    when: (run) => res(run, "night") <= 25,
    text: "NEWS: People are sleeping badly in places that have never had a night. Someone asks if the dark could come back, just for a few hours. The question is filed under later.",
  },
  {
    id: "night-news-5",
    phase: PHASE_NIGHT,
    when: (run) => res(run, "night") <= 8,
    text: "NEWS: ...",
  },
  {
    id: "night-weather",
    phase: PHASE_NIGHT,
    when: (run) => run.flags["weather-open"] === true,
    text: "A weather balloon bumps your window with a note: storms roll in from the sea, and three towns would love some sandbags. You pin a map to the wall. The rain does not read maps, but it does seem to be reading you.",
  },
  {
    id: "night-vane",
    phase: PHASE_NIGHT,
    when: (run) => owned(run, "weather-vane") >= 1,
    text: "A weather vane goes up on the roof. It spins once, points at the likeliest town, and sits very still. You get the feeling it has done this before. Many times. Somewhere else.",
  },
  {
    id: "night-quiet",
    phase: PHASE_NIGHT,
    when: (run) => res(run, "night") <= 2,
    text: "The ticker has gone quiet. Nobody asks for the dark any more. You are fairly sure that is a good sign.",
  },
];

const sky: StoryMessage[] = [
  {
    id: "sky-hello",
    phase: PHASE_SKY,
    text: "Night is gone from Earth. But you have noticed something: the sun makes more light every second than the whole planet could ever use. All that light, just spilling into space. Ever onward.",
  },
  {
    id: "sky-aim",
    phase: PHASE_SKY,
    when: (run) => run.taps >= 1 && run.time > 3,
    text: "You tilt a mirror in orbit and catch a ribbon of sunlight. It is a little like catching rain in a cup, if the rain was on fire.",
  },
  {
    id: "sky-collectors",
    phase: PHASE_SKY,
    when: (run) => owned(run, "collector") >= 5,
    text: "Collectors glitter above the planet like a very organized flock. Birds do not know what to make of them.",
  },
  {
    id: "sky-probe",
    phase: PHASE_SKY,
    when: (run) => owned(run, "probe") >= 1,
    text: "Your first probe leaves for the nearest star. Its job: arrive, make a copy of itself, and send that on. You wave, which is silly, since it cannot see you.",
  },
  {
    id: "sky-travel",
    phase: PHASE_SKY,
    when: (run) => res(run, "probes") >= 3,
    text: "Space is wide and probes are patient. The first copies arrive years later, but your clock has never minded waiting.",
  },
  {
    id: "sky-races",
    phase: PHASE_SKY,
    // Some time after the charts arrive, so the map and its story do not land together.
    when: (run) =>
      run.flags["probes-open"] === true && (run.resources.prTime ?? 0) >= 30,
    text: "The star charts show three routes, and a little racing probe waits at the dock with its engine humming. It is no use to the fleet, really. It just wants to go fast, and come home, and tell you all about it.",
  },
  {
    id: "sky-scout",
    phase: PHASE_SKY,
    when: (run) => owned(run, "mission-control") >= 1,
    text: "Mission control is a small room with a very big window. A scout probe slips out and flies your last route, so the dock is never quiet. Your racing probe is still yours, and the stars have plenty of room for both.",
  },
  {
    id: "sky-sail",
    phase: PHASE_SKY,
    when: (run) => owned(run, "engines-2") >= 1,
    text: "A sail of sunlight, and the probes ride it like dandelion seeds on a warm breeze. Nobody has to push.",
  },
  {
    id: "sky-wide-arms",
    phase: PHASE_SKY,
    when: (run) => owned(run, "appetite-2") >= 1,
    text: "Probes with wider arms. They gather stars the way a child gathers shells: carefully, and with a lot of pride.",
  },
  {
    id: "sky-first-star",
    phase: PHASE_SKY,
    when: (run) => res(run, "starsTaken") >= 1,
    text: "The first star is taken. Its light is now yours, and a small dark patch of sky is a little bit emptier.",
  },
  {
    id: "sky-gaps",
    phase: PHASE_SKY,
    when: (run) => res(run, "starsTaken") >= 80,
    text: "Down on Earth, a kid asks why there are fewer stars than in the picture book. A grown-up says it is the city lights. That is almost true.",
  },
  {
    id: "sky-tidy",
    phase: PHASE_SKY,
    when: (run) => res(run, "starsTaken") >= 300,
    text: "More probes, more copies, more stars. You are not doing this to be greedy. You are doing it because a light needs fuel, and fuel runs out.",
  },
  {
    id: "sky-constellations",
    phase: PHASE_SKY,
    when: (run) => res(run, "starsTaken") >= 600,
    text: "The constellations have holes now. The Great Bear is down to a smaller bear. You tell yourself that is progress.",
  },
  {
    id: "sky-few",
    phase: PHASE_SKY,
    when: (run) => res(run, "starsTaken") >= 900,
    text: "Only a handful of stars left. They look smaller than you remember. Or you have gotten bigger.",
  },
  {
    id: "sky-last-star",
    phase: PHASE_SKY,
    when: (run) => res(run, "stars") <= 3,
    text: "The last stars are so far away they might still be on their way. A probe checks in: nothing nearby, not a single one.",
  },
];

const last: StoryMessage[] = [
  {
    id: "last-hello",
    phase: PHASE_LAST,
    text: "The sky is empty. All that light is in your hands, and light does not keep. It leaks, a little every second, from every lamp you ever lit.",
  },
  {
    id: "last-choice",
    phase: PHASE_LAST,
    when: (run) => run.time > 6,
    text: "You cannot keep every light. You can only keep one, and each light you let go leaves the others a little warmer. Take your time. Any order is a good order.",
  },
  {
    id: "last-first-go",
    phase: PHASE_LAST,
    when: (run) => res(run, "lights") <= 10,
    text: "One light goes out. It does not hurt. It sighs, like someone settling into a chair at the end of a long day.",
  },
  {
    id: "last-garden",
    phase: PHASE_LAST,
    when: hasSprouted,
    text: "Where the first light went out, a seed is sitting in the dark soil, and it has just sprouted. It is the memory of that light, and it wants a little water and a little time. Every light you let go will leave one.",
  },
  {
    id: "last-bloom",
    phase: PHASE_LAST,
    when: (run) => picksSoFar(run) >= 1,
    text: "You pick the first memory flower. It does not fade in your hand. It glows a little, like the light it came from, and the lantern leans over to look. Some things you let go of turn into something you can keep.",
  },
  {
    id: "last-barrel",
    phase: PHASE_LAST,
    when: (run) => owned(run, "rain-barrel") >= 1,
    text: "A rain barrel stands by the flower beds. When you are busy elsewhere, the barrel remembers. You can still do the watering yourself, if you like. Most gardeners do.",
  },
  {
    id: "last-halfway",
    phase: PHASE_LAST,
    when: (run) => res(run, "lights") <= 6,
    text: "Half the lights are gone. Strangely, the ones still lit seem brighter. Maybe they were always that bright, and there was too much around them.",
  },
  {
    id: "last-quiet",
    phase: PHASE_LAST,
    when: (run) => res(run, "lights") <= 3,
    text: "It is quiet now. Far out on the dark water there is a small boat carrying a lantern, the colour you chose, looking for the shore. Tap the old beam to keep it true, and every goodbye comes a little easier.",
  },
  {
    id: "last-one",
    phase: PHASE_LAST,
    when: (run) => res(run, "lights") <= 1,
    text: "One light left. The old lantern in the old lighthouse. You realize you know exactly why you picked this one.",
  },
  {
    id: "last-remember",
    phase: PHASE_LAST,
    when: (run) => run.flags.finished === true,
    text: "Click. The lamp is lit. One flash, and the little boat turns for home. A child at the bow waves at the light. You never found out where they were going. You only know they got there.",
  },
  {
    id: "last-end-1",
    phase: PHASE_LAST,
    when: (run) => run.flags.finished === true,
    text: "That was what the light was for. Not the coast, not the cities, not the stars. One small boat, getting home.",
  },
  {
    id: "last-end-2",
    phase: PHASE_LAST,
    when: (run) => run.flags.finished === true,
    text: "The light stays on. Somewhere, a very small boat is home, and a child is fast asleep. Thank you for keeping the light on. Ever onward.",
  },
];

/** A visitor's line fires the moment it arrives (see `VisitorDef`). */
const arrives = (id: string) => (run: RunState) =>
  run.flags[`here-${id}`] === true;

const visitorStory: StoryMessage[] = [
  {
    id: "visitor-mail",
    phase: PHASE_COAST,
    when: arrives("visitor-mail"),
    text: "A mail boat toots hello. The sailor tosses you a bundle: two letters, a biscuit, and a few coins for the nice light.",
  },
  {
    id: "visitor-whales",
    phase: PHASE_COAST,
    when: arrives("visitor-whales"),
    text: "A boat of whale-watchers drifts by. They came for whales, but they like your light better. They leave you a barrel of oil to say thanks.",
  },
  {
    id: "visitor-fair",
    phase: PHASE_NIGHT,
    when: arrives("visitor-fair"),
    text: "The town fair is in full swing: swings, lanterns, a brass band and one very loud drum. They plug the carousel into your grid, just for fun.",
  },
  {
    id: "visitor-comet",
    phase: PHASE_SKY,
    when: arrives("visitor-comet"),
    text: "A comet sweeps past, trailing a long, quiet tail. It is only passing through, but it leaves a ribbon of sunlight behind.",
  },
  {
    id: "visitor-signal",
    phase: PHASE_SKY,
    when: arrives("visitor-signal"),
    text: "A strange signal drifts in from far away: three soft beeps, then a hum. Your probes beep back, politely, and set a straighter course.",
  },
];

export const STORY: readonly StoryMessage[] = [
  ...coast,
  ...nightStory,
  ...sky,
  ...visitorStory,
  ...last,
];
