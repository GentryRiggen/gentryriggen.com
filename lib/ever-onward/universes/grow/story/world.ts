import type { RunState, StoryMessage } from "../../../engine/types";
import { biomeShare, switchesSoFar, worldCover } from "../biomes";
import { PHASE_WORLD } from "../resources";
import { phaseTime } from "../seasons";
import { isDry } from "../water";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** True once the world has been open this many minutes. */
const after = (run: RunState, minutes: number): boolean =>
  phaseTime(run) >= minutes * 60;

/** True once this much of the planet is green (0 to 1). */
const covered = (run: RunState, share: number): boolean =>
  worldCover(run) >= share;

/**
 * The world's story. Early lines are about the green; as it spreads, the
 * news ticker starts to mention that people have moved over, cheerfully, and
 * the robot calls every one of them a success. Nobody is hurt, and nothing
 * is ever counted: it is told in passing, and only grown-ups read between
 * the lines.
 */
export const world: StoryMessage[] = [
  {
    id: "world-hello",
    phase: PHASE_WORLD,
    text: "From up here the world is a big round map with a lot of bare spots on it. You pick one and plant a tree. It is a start.",
  },
  {
    id: "world-windbreak",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "windbreak") >= 1,
    text: "A row of windbreak trees takes root along the edge of the map. They sway, they shade, and a family of starlings moves in the same afternoon.",
  },
  {
    id: "world-choice",
    phase: PHASE_WORLD,
    when: (run) => after(run, 1),
    text: "The birds are ready to carry seeds. Forest, jungle, meadow or wetland: each is good at something different, and you can change your mind whenever you like.",
  },
  {
    id: "world-time-1",
    phase: PHASE_WORLD,
    when: (run) => after(run, 3),
    text: "A cartographer unrolls a new map, looks at the green patches and sighs happily. Every colour has to be redrawn, and she does not mind one bit.",
  },
  {
    id: "world-jungle",
    phase: PHASE_WORLD,
    when: (run) => biomeShare(run, "jungle") >= 0.05,
    text: "The jungle comes up fast, loud and very drippy. It drinks everything in reach, so keep an eye on the rivers.",
  },
  {
    id: "world-rain-makers",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "rain-makers") >= 1,
    text: "The clouds learn to rain exactly where a planting is waiting. They look quite proud of themselves.",
  },
  {
    id: "world-forest",
    phase: PHASE_WORLD,
    when: (run) => biomeShare(run, "forest") >= 0.08,
    text: "Forest spreads over the hills in soft, deep green. The squirrels were asked to keep count, and have politely declined.",
  },
  {
    id: "world-river",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "river-bend") >= 1,
    text: "A river bends in where it was needed, and the whole valley leans toward it like a plant to a window.",
  },
  {
    id: "world-time-2",
    phase: PHASE_WORLD,
    when: (run) => after(run, 5),
    text: "NEWS: A new forest has opened a short walk from the old market. Locals say it is lovely, and also, gently, in the market.",
  },
  {
    id: "world-meadow",
    phase: PHASE_WORLD,
    when: (run) => biomeShare(run, "meadow") >= 0.05,
    text: "Meadow grass rolls out in long waves, and the bees send a thank-you card by air mail. Migrating birds will carry more seeds now.",
  },
  {
    id: "world-rover",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "planting-rover") >= 1,
    text: "A planting rover trundles over a hill, plants a tree, and trundles on. It seems very pleased with itself.",
  },
  {
    id: "world-wetland",
    phase: PHASE_WORLD,
    when: (run) => biomeShare(run, "wetland") >= 0.05,
    text: "The wetlands soak up the rain like a big green sponge. The frogs hold a meeting and vote, unanimously, to stay.",
  },
  {
    id: "world-time-3",
    phase: PHASE_WORLD,
    when: (run) => after(run, 7),
    text: "NEWS: The town of Millbrook has moved to the hills, to give the new trees some room. Residents say the view is excellent, and the post is delayed.",
  },
  {
    id: "world-thirsty",
    phase: PHASE_WORLD,
    when: (run) => after(run, 3) && isDry(run),
    text: "The land is thirsty and the clouds are busy somewhere else. Everything still grows, only slower. A river bend or a cloud seeder would help.",
  },
  {
    id: "world-switch",
    phase: PHASE_WORLD,
    when: (run) => switchesSoFar(run) >= 1,
    text: "You point the birds somewhere new. A newly chosen biome takes a moment to settle in, and then it spreads like it has always lived there.",
  },
  {
    id: "world-cover-1",
    phase: PHASE_WORLD,
    when: (run) => covered(run, 0.15),
    text: "NEWS: The old road to the coast is a meadow now. Walkers say it is soft underfoot and, oddly, very quiet.",
  },
  {
    id: "world-time-4",
    phase: PHASE_WORLD,
    when: (run) => after(run, 9),
    text: "NEWS: The mayor has relocated the town hall. Again. It is now on a hill with a lovely view of where the town used to be.",
  },
  {
    id: "world-cloud",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "cloud-seeder") >= 1,
    text: "A cloud is taught to rain on purpose. It practises on a field, and then, a little shyly, on a hat.",
  },
  {
    id: "world-time-5",
    phase: PHASE_WORLD,
    when: (run) => after(run, 11),
    text: "The robot sends its first report: every square of the map is greener than last week. It adds three exclamation marks, which is a lot for a robot.",
  },
  {
    id: "world-cover-2",
    phase: PHASE_WORLD,
    when: (run) => covered(run, 0.3),
    text: "NEWS: Three more towns have moved house to make space for the forest. The removal vans were waved off by a very jolly oak.",
  },
  {
    id: "world-seeder",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "sky-seeder") >= 1,
    text: "A sky seeder drifts out over the ocean and the dry places, scattering seed like slow snow. Wherever it lands, something small and green turns up to see.",
  },
  {
    id: "world-time-6",
    phase: PHASE_WORLD,
    when: (run) => after(run, 13),
    text: "NEWS: The last bakery in the valley has closed for a move. A note on the door says: back soon, the bread is coming too.",
  },
  {
    id: "world-time-7",
    phase: PHASE_WORLD,
    when: (run) => after(run, 15),
    text: "A long line of cheerful removal vans heads for the horizon. Somebody waves from a window. Somebody else has left a note on a fence: all fine, see you later!",
  },
  {
    id: "world-cover-3",
    phase: PHASE_WORLD,
    when: (run) => covered(run, 0.45),
    text: "NEWS: A school has moved into the next valley, desks and all. The new classroom has no walls, a great many leaves, and a very patient squirrel in charge of snacks.",
  },
  {
    id: "world-time-8",
    phase: PHASE_WORLD,
    when: (run) => after(run, 17),
    text: "The robot polishes its watering can. It has been told many times that it is doing a wonderful job, though nobody has said it in person for a while.",
  },
  {
    id: "world-time-9",
    phase: PHASE_WORLD,
    when: (run) => after(run, 19),
    text: "NEWS: The county library has relocated its books to somewhere with better light. The shelves have been left in place, and the ivy has started on chapter one.",
  },
  {
    id: "world-cover-4",
    phase: PHASE_WORLD,
    when: (run) => covered(run, 0.6),
    text: "A forest grows where the town square used to be. The fountain still runs, and the pigeons still look up whenever the church bell rings, just in case.",
  },
  {
    id: "world-time-10",
    phase: PHASE_WORLD,
    when: (run) => after(run, 21),
    text: "NEWS: Good news from the valley: it is the greenest it has ever been! The town council could not be reached for comment, as it has moved. All of it.",
  },
  {
    id: "world-time-11",
    phase: PHASE_WORLD,
    when: (run) => after(run, 23),
    text: "The streets are soft with moss now, and every window is open to let the breeze through. The robot waves at each one as it passes. Nothing waves back, which it takes as modesty.",
  },
  {
    id: "world-cover-5",
    phase: PHASE_WORLD,
    when: (run) => covered(run, 0.75),
    text: "NEWS: Everybody has found somewhere new to be. Where exactly is not on the map yet, but the map is very green, so that is sorted.",
  },
  {
    id: "world-time-12",
    phase: PHASE_WORLD,
    when: (run) => after(run, 25),
    text: "A bicycle leans against a lamp post with a basket full of flowers. It has been there a while. The flowers have grown into the basket and are doing quite well.",
  },
  {
    id: "world-time-13",
    phase: PHASE_WORLD,
    when: (run) => after(run, 27),
    text: "The robot checks its list. Plant everywhere: nearly done. Make it grow: still going. Ask someone how they are: it looks for the line, and cannot find it.",
  },
  {
    id: "world-cover-6",
    phase: PHASE_WORLD,
    when: (run) => covered(run, 0.9),
    text: "From up here the whole world is the same warm green, with white clouds drifting over it. It is the most beautiful thing the robot has ever made, and it says so out loud, to nobody.",
  },
  {
    id: "world-time-14",
    phase: PHASE_WORLD,
    when: (run) => after(run, 30),
    text: "A weather vane turns slowly on a roof that is mostly leaves now. It points toward the horizon, as if everyone had gone that way and it were keeping an eye out.",
  },
  {
    id: "world-time-15",
    phase: PHASE_WORLD,
    when: (run) => after(run, 33),
    text: "Somewhere under all that green is a small pot on a small windowsill, and the robot has just remembered it. It sets down its watering can and looks for the way.",
  },
  {
    id: "world-time-16",
    phase: PHASE_WORLD,
    when: (run) => after(run, 36),
    text: "The seed vault plans are ready. One seed from everything, kept safe for later, in case anyone wants to start again.",
  },
  {
    id: "world-time-17",
    phase: PHASE_WORLD,
    when: (run) => after(run, 39),
    text: "A very small, very green sprout pushes up through the cobbles outside the old town hall. The robot tips its watering can toward it, just a drop.",
  },
  {
    id: "world-vault",
    phase: PHASE_WORLD,
    when: (run) => owned(run, "seed-vault") >= 1,
    text: "The seed vault is sealed. It is very quiet in there and very green outside, and one seed from everything waits in the dark for later.",
  },
];
