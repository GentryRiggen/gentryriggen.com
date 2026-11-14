import type { RunState, StoryMessage } from "../../../engine/types";
import { PHASE_TOWN } from "../resources";
import { DAY_HOT, dayKind, grumpyCount, isTownOpen } from "../town";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** True once the town has been open this many minutes. */
const after = (run: RunState, minutes: number): boolean =>
  run.time - (run.transitions.at(-1)?.at ?? 0) >= minutes * 60;

export const town: StoryMessage[] = [
  {
    id: "town-hello",
    phase: PHASE_TOWN,
    text: 'Word gets around. By lunchtime there is a crowd, and by teatime there is a queue, and nobody is quite sure what it is a queue for. "For smiles," says the robot, and everybody agrees that sounds fair.',
  },
  {
    id: "town-clown",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "clown") >= 1,
    text: "The first clown graduates from clown school with a diploma, a red nose and a flower that squirts. The squirt lands mostly on the teacher, who is a very good sport.",
  },
  {
    id: "town-bunting",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "bunting") >= 1,
    text: "Little flags in every color, from lamppost to lamppost, all the way down Main Street. The whole town looks like it is having a birthday, and it might as well be.",
  },
  {
    id: "town-band",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "band") >= 1,
    text: "The band has four tubas, one very small drum and a conductor who is mostly mustache. They only know one song. It is a very good song, so nobody has the heart to tell them.",
  },
  {
    id: "town-bench",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "bench") >= 1,
    text: "The robot adds benches in the shade, so a street can wait happily for the next float. The mayor says it is the first sensible idea of the week.",
  },
  {
    id: "town-stand",
    phase: PHASE_TOWN,
    when: (run) => isTownOpen(run),
    text: "The robot sets up a lemonade stand with a little chalk sign. Nobody is sure what a fair price is, so the sign has a lot of rubbing out on it.",
  },
  {
    id: "town-parade",
    phase: PHASE_TOWN,
    when: (run) => (run.resources.tnMoves ?? 0) >= 1,
    text: "A parade! Floats, confetti, and a dog in a very small hat. Every street gets a turn, and the whole street throws up its arms.",
  },
  {
    id: "town-fork",
    phase: PHASE_TOWN,
    when: (run) => (run.resources.fkTown ?? 0) > 0,
    text: "The town has picked who runs the cheering, and the other plan goes carefully into a drawer. Some day, perhaps, the drawer will be opened again.",
  },
  {
    id: "town-factory",
    phase: PHASE_TOWN,
    when: (run) => owned(run, "smile-factory") >= 1,
    text: "The smile factory opens with a big ribbon and a small whistle. Smiles go in the front and come out the back, in boxes, all lined up. Each one is tested on a volunteer before it ships.",
  },
  {
    id: "town-grumpy",
    phase: PHASE_TOWN,
    when: (run) => grumpyCount(run) > 0,
    text: "One street has been left out of the parade, and it has noticed. Arms are crossed. Somebody says hmph, quite loudly. The robot takes the hint and starts looking for a float.",
  },
  {
    id: "town-hot",
    phase: PHASE_TOWN,
    when: (run) => dayKind(run) === DAY_HOT,
    text: "It is boiling. A queue forms at the lemonade stand, then another queue behind it. The robot wonders, not for the first time, what a cup of lemonade is really worth.",
  },
  {
    id: "town-hero",
    phase: PHASE_TOWN,
    when: (run) => after(run, 9),
    text: "The town paints the robot's name on the water tower. HERO, it says, in very big letters. Underneath, in much smaller ones, somebody has added: PLEASE STAY.",
  },
  {
    id: "town-key",
    phase: PHASE_TOWN,
    when: (run) => run.revealed.includes("key-to-town"),
    text: "The mayor has a key the size of a dinner plate, and a speech to go with it. Beyond the town hall the road goes on, over the hill and into somewhere else. There are other towns out there, and they have not smiled yet.",
  },
  {
    id: "town-wave",
    phase: PHASE_TOWN,
    when: (run) => after(run, 2),
    text: "Somebody waves from a window. Then everybody on the street waves back, at everybody. Nobody wants to be the first one to stop.",
  },
  {
    id: "town-hats",
    phase: PHASE_TOWN,
    when: (run) => after(run, 6),
    text: "Party hats have sold out. A man is selling plain paper cones instead, and calling them fancy. He is doing very well.",
  },
  {
    id: "town-pigeons",
    phase: PHASE_TOWN,
    when: (run) => after(run, 11),
    text: "The pigeons have learned that parades mean crumbs. They arrive early and take the good spots at the front. Nobody minds. They are very enthusiastic.",
  },
  {
    id: "town-queue",
    phase: PHASE_TOWN,
    when: (run) => after(run, 16),
    text: "The queue for smiles now goes round the block and comes back to the front. Someone has started a second queue to wait for the first one to get shorter.",
  },
  {
    id: "town-lights",
    phase: PHASE_TOWN,
    when: (run) => after(run, 21),
    text: "Evening comes, and every window in town is lit up and loud. It is the happiest street in the world. It is also, the robot notices, rather difficult to hear yourself think.",
  },
  {
    id: "town-statue",
    phase: PHASE_TOWN,
    when: (run) => after(run, 26),
    text: "They have started a statue of the robot in the square. It is a good likeness, apart from the smile, which is very, very big.",
  },
  {
    id: "town-paper",
    phase: PHASE_TOWN,
    when: (run) => after(run, 31),
    text: "BEST WEEK EVER, says the newspaper, in letters so large the rest of the page had to move over. (It has said this every week since the robot arrived.)",
  },
  {
    id: "town-balloons",
    phase: PHASE_TOWN,
    when: (run) => after(run, 4),
    text: "There are balloons on the church, the post office and the bus. One has gotten stuck on the town clock, and the clock is running slow, as if it were enjoying itself.",
  },
  {
    id: "town-bakery",
    phase: PHASE_TOWN,
    when: (run) => after(run, 8),
    text: "The bakery has made a new bread called Smile Loaf. It is just a loaf, but it has a face cut into the crust. Nobody is sure how to eat it. Everyone is trying.",
  },
  {
    id: "town-choir",
    phase: PHASE_TOWN,
    when: (run) => after(run, 13.5),
    text: "The town choir has learned one cheerful song, and they sing it three times a day. By the third time the baritone has started to sing something else, quietly, and nobody has noticed.",
  },
  {
    id: "town-grump",
    phase: PHASE_TOWN,
    when: (run) => after(run, 18.5),
    text: "There is one grumpy man in town, and the robot has not been able to cheer him up. He sits on his porch and says, 'Oh, go away.' The robot decides he is an expert, and leaves him a lemonade.",
  },
  {
    id: "town-school",
    phase: PHASE_TOWN,
    when: (run) => after(run, 23.5),
    text: "The schoolchildren have invented a game called Who Can Laugh Longest. The record is eleven minutes. A teacher has had to lie down.",
  },
  {
    id: "town-sign",
    phase: PHASE_TOWN,
    when: (run) => after(run, 28.5),
    text: "A sign goes up at the edge of town: WELCOME TO THE HAPPIEST PLACE ON EARTH. Underneath, in smaller letters, someone has written: PLEASE KEEP IT THAT WAY.",
  },
  {
    id: "town-cheer",
    phase: PHASE_TOWN,
    when: (run) => after(run, 33.5),
    text: "By evening the whole town is hoarse from cheering, and happier than it has ever been. It is a very good feeling. It is also, the robot suspects, a bit like being full of cake.",
  },
  {
    id: "visitor-mayor",
    phase: PHASE_TOWN,
    text: '"I have a ribbon," says the mayor, holding up a ribbon the length of a bus. "I have nothing to cut it with." The robot lends a pair of scissors. The ribbon is cut, and the crowd cheers, and the mayor looks very, very relieved.',
  },
  {
    id: "visitor-baker",
    phase: PHASE_TOWN,
    text: "The baker has made a cake in the shape of a smile, with icing for teeth. It is the most cheerful cake anyone has seen. It is also slightly alarming, from the side, but it is delicious.",
  },
];
