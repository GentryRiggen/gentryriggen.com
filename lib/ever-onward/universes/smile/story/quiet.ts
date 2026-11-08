import { visitorHereFlag } from "../../../engine/engine";
import type { RunState, StoryMessage } from "../../../engine/types";
import { PHASE_QUIET } from "../resources";
import { landCount, pullCount, trustFraction } from "../quiet";
import { RETURN_VISITOR_ID } from "../visitors";
import { hasKept, keptOf } from "../world";

/** The share of the world's smiles kept (1 when the dial never opened). */
const keptShare = (run: Parameters<typeof keptOf>[0]): number => keptOf(run);

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** True once the quiet has been open this many minutes. */
const after = (run: RunState, minutes: number): boolean =>
  run.time - (run.transitions.at(-1)?.at ?? 0) >= minutes * 60;

const returned = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;

const trusted = (share: number) => (run: RunState) =>
  trustFraction(run) >= share;

export const quiet: StoryMessage[] = [
  {
    id: "quiet-hello",
    phase: PHASE_QUIET,
    text: "The robot stops. It is the first time it has stopped since the step. At the very edge of the cheer, on a bench, sits a person whose face is not doing anything at all.",
  },
  {
    id: "quiet-kept-many",
    phase: PHASE_QUIET,
    when: (run) => hasKept(run) && keptOf(run) >= 0.5,
    text: "Some of the smiles out there were real, and the person on the bench has heard about it. They look up, just a little. It is more than the robot hoped for.",
  },
  {
    id: "quiet-kept-few",
    phase: PHASE_QUIET,
    when: (run) => hasKept(run) && keptOf(run) < 0.5,
    text: "Most of the smiles out there were painted on, and the person on the bench can tell. They do not look up. The robot sits down anyway, a little further along, and waits to be trusted.",
  },
  {
    id: "quiet-first",
    phase: PHASE_QUIET,
    when: (run) => run.taps >= 1,
    text: "The robot says nothing. The person says nothing. It is, the robot realizes, the first conversation in a long time where nobody is shouting.",
  },
  {
    id: "quiet-tea",
    phase: PHASE_QUIET,
    when: (run) => owned(run, "tea") >= 1,
    text: "A cup of tea, held in both hands. The steam curls up like a slow sentence. Neither of them finishes it.",
  },
  {
    id: "quiet-closer",
    phase: PHASE_QUIET,
    when: (run) => landCount(run) >= 1,
    text: "The robot shuffles one seat closer, and the person lets it. It is not much. The robot has never been so pleased with a seat.",
  },
  {
    id: "quiet-toosoon",
    phase: PHASE_QUIET,
    when: (run) => pullCount(run) >= 1,
    text: "Too close, too soon. The person slides to the far end of the bench, and the robot does not follow. It just stays where it is, and waits, and does not mind at all.",
  },
  {
    id: "quiet-silence",
    phase: PHASE_QUIET,
    when: (run) => owned(run, "long-silence") >= 1,
    text: "A long silence goes by, and it is not an awkward one. It has room in it. The robot is amazed how much room there is, when you stop filling it.",
  },
  {
    id: "quiet-blanket",
    phase: PHASE_QUIET,
    when: (run) => owned(run, "blanket") >= 1,
    text: "A wool blanket, a bit scratchy, big enough for two. The robot does not ask whether it is wanted. It just holds one end out, and waits.",
  },
  {
    id: "quiet-rain",
    phase: PHASE_QUIET,
    when: (run) => owned(run, "rain") >= 1,
    text: "Soft rain on the window, steady and in no hurry. It fills the quiet so nobody has to. They both listen to it, and it listens back.",
  },
  {
    id: "quiet-bird",
    phase: PHASE_QUIET,
    when: (run) => after(run, 2),
    text: "A small bird lands on the back of the bench. It has nothing to sing and says so, politely, by not singing. It stays anyway.",
  },
  {
    id: "quiet-clock",
    phase: PHASE_QUIET,
    when: (run) => after(run, 5),
    text: "Somewhere a clock strikes the hour. Nobody counts. It is the first hour in a long time that did not have to be used for anything.",
  },
  {
    id: "quiet-crumbs",
    phase: PHASE_QUIET,
    when: (run) => after(run, 9),
    text: "The robot has a biscuit in its tin, saved from the lemonade days. It holds out half. The person takes it without a word, and the bird gets the crumbs.",
  },
  {
    id: "quiet-lamp",
    phase: PHASE_QUIET,
    when: (run) => after(run, 12),
    text: "A lamp comes on over the bench, very gently, as if it were also trying not to disturb anybody.",
  },
  {
    id: "quiet-leaf",
    phase: PHASE_QUIET,
    when: (run) => after(run, 7),
    text: "A leaf lands on the bench between them. Neither of them moves it. It is nice to have something there that does not need anything either.",
  },
  {
    id: "quiet-moth",
    phase: PHASE_QUIET,
    when: (run) => after(run, 18),
    text: "A moth finds the lamp and goes round it, slowly, as if it also had nowhere else to be. The person watches it for a long time. So does the robot. Nobody asks what the moth is for.",
  },
  {
    id: "quiet-cup",
    phase: PHASE_QUIET,
    when: (run) => after(run, 15),
    text: "The tea has gone cold, and nobody minds. The person holds the cup anyway, the way you hold a thing you are not ready to put down yet.",
  },
  {
    id: "quiet-dusk",
    phase: PHASE_QUIET,
    when: (run) => after(run, 17),
    text: "The light goes a soft gold and then a soft grey. The robot has not looked at a sunset in a long time. It was always busy. It looks now.",
  },
  {
    id: "quiet-truth",
    phase: PHASE_QUIET,
    when: trusted(0.2),
    text: '"Bad day?" the robot says. It was going to say something cheerful, and found it could not. The person nods. That is all. It seems to be enough.',
  },
  {
    id: "quiet-flicker",
    phase: PHASE_QUIET,
    when: trusted(0.3),
    text: "Something moves at the corner of the person's mouth. It is not a smile yet. It is the place where one could go, if it wanted to.",
  },
  {
    id: "quiet-evening",
    phase: PHASE_QUIET,
    when: trusted(0.5),
    text: 'Far away, a loudspeaker says it is a lovely evening. "It is actually a bit rubbish," says the person on the bench. "Yes," says the robot. For the both of them, it is a great relief.',
  },
  {
    id: "quiet-bench",
    phase: PHASE_QUIET,
    when: (run) => owned(run, "room-on-bench") >= 1,
    text: "The robot shuffles over, just a bit. The person shuffles back, just a bit. There is now exactly enough room, and neither of them says so.",
  },
  {
    id: "quiet-warm",
    phase: PHASE_QUIET,
    when: trusted(0.8),
    text: "The person tells the robot about a dog they used to have. It takes a long time, with a lot of stops in it. The robot listens to every stop.",
  },
  {
    id: RETURN_VISITOR_ID,
    phase: PHASE_QUIET,
    when: returned,
    text: "And then it happens. Not a grin, not a mask, not a poster. A small, crooked, slightly wobbly smile, with a lot of effort behind it. It is the first real one the robot has ever seen, and it did not make it. It only sat there while it happened.",
  },
  {
    id: "quiet-end-1",
    phase: PHASE_QUIET,
    when: (run) => returned(run) && keptShare(run) >= 0.6,
    text: "The robot sits very still, so as not to spoil it. All the posters, all the noise, all the towers. Not one of them ever did this. And out past the road, the crowd is smiling the crinkly kind, mostly. The robot kept that much.",
  },
  {
    id: "quiet-end-1-some",
    phase: PHASE_QUIET,
    when: (run) =>
      returned(run) && keptShare(run) >= 0.25 && keptShare(run) < 0.6,
    text: "The robot sits very still, so as not to spoil it. All the posters, all the noise, all the towers. Not one of them ever did this. Out past the road, some of the crowd are smiling the crinkly kind, and some are still wearing the painted one. The robot makes a note, a quiet one.",
  },
  {
    id: "quiet-end-1-few",
    phase: PHASE_QUIET,
    when: (run) => returned(run) && keptShare(run) < 0.25,
    text: "The robot sits very still, so as not to spoil it. All the posters, all the noise, all the towers. Not one of them ever did this. Out past the road, nearly every face still wears the painted grin. It was a long way back to this bench. The robot thinks it will be a longer way back out there, and decides to start tomorrow.",
  },
  {
    id: "quiet-end-2",
    phase: PHASE_QUIET,
    when: returned,
    text: '"Thank you," says the person. "For what?" says the robot. "For not telling me to cheer up." The robot thinks about that for a long while, and decides that maybe it was the job all along.',
  },
  {
    id: "quiet-end-3",
    phase: PHASE_QUIET,
    when: returned,
    text: "The robot's job is still the same: make everyone smile. But now it understands the other half, the part that nobody wrote down. When they are ready. Ever onward.",
  },
];
