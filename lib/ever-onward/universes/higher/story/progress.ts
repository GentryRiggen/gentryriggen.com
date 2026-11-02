import { upgradeCost } from "../../../engine/engine";
import type { RunState, StoryMessage } from "../../../engine/types";
import { descentShare } from "../descent";
import { PHASE_PLAYROOM, PHASE_SKY, PHASE_TOP, PHASE_TOWN } from "../resources";
import { UPGRADES } from "../upgrades";

/**
 * Lines that fire as a part's last purchase gets closer: a share of its price
 * is in hand. They keep the story moving through the long saving stretches.
 */
function saving(endId: string, share: number) {
  const end = UPGRADES.find((u) => u.id === endId);
  return (run: RunState): boolean =>
    !!end &&
    (run.resources[end.currency] ?? 0) >= share * upgradeCost(run, end);
}

const down = (share: number) => (run: RunState) => descentShare(run) >= share;

export const progress: StoryMessage[] = [
  {
    id: "play-saving-1",
    phase: PHASE_PLAYROOM,
    when: saving("treehouse", 0.04),
    text: "The tower has outgrown the rug. Mum steps over it on tiptoe, carrying the washing.",
  },
  {
    id: "play-saving-2",
    phase: PHASE_PLAYROOM,
    when: saving("treehouse", 0.15),
    text: "The robot measures the tower against the door frame. Then it measures the door frame against the tower. Only one of them is finished.",
  },
  {
    id: "play-saving-3",
    phase: PHASE_PLAYROOM,
    when: saving("treehouse", 0.4),
    text: "Someone has drawn a little face on the top block with felt pen. The robot decides to leave it there. It likes the company.",
  },
  {
    id: "town-saving-1",
    phase: PHASE_TOWN,
    when: saving("skyscraper", 0.01),
    text: "The newspaper takes a picture of the tower. The headline just says HIGHER. The robot does not mind the headline.",
  },
  {
    id: "town-saving-2",
    phase: PHASE_TOWN,
    when: saving("skyscraper", 0.04),
    text: "The bakery sells tower-shaped buns. They are very good, and the queue goes right round the block.",
  },
  {
    id: "town-saving-3",
    phase: PHASE_TOWN,
    when: saving("skyscraper", 0.12),
    text: "A window on the fifth floor has a lamp, a plant and someone who waves. The robot waves back. It is nice to be waved at.",
  },
  {
    id: "town-saving-4",
    phase: PHASE_TOWN,
    when: saving("skyscraper", 0.3),
    text: "From the street, the top of the tower is a small bright dot. Several people point at it. Several more are not looking.",
  },
  {
    id: "sky-saving-1",
    phase: PHASE_SKY,
    when: saving("space-elevator", 0.005),
    text: "A cloud drifts right through the third floor and out of the other side. It leaves everything slightly damp and slightly kinder.",
  },
  {
    id: "sky-saving-2",
    phase: PHASE_SKY,
    when: saving("space-elevator", 0.02),
    text: "The robot looks down. The town is a handful of tiny lights, and then the clouds close, and it is a handful of nothing.",
  },
  {
    id: "sky-saving-3",
    phase: PHASE_SKY,
    when: saving("space-elevator", 0.08),
    text: "Someone has hung a sign on the scaffold. It says WELCOME, in very neat letters, to nobody in particular.",
  },
  {
    id: "sky-saving-4",
    phase: PHASE_SKY,
    when: saving("space-elevator", 0.25),
    text: "The robot counts the floors. Then it counts them again, to be sure. The number is large and getting larger, and that is all the robot needs to know.",
  },
  {
    id: "top-ten",
    phase: PHASE_TOP,
    when: down(0.08),
    text: "A few landings down. The lamps flicker as the robot goes by, as if they were saying hello.",
  },
  {
    id: "top-balloon",
    phase: PHASE_TOP,
    when: down(0.3),
    text: "Inside the clouds, a lost balloon bumps against a window. The robot opens it and lets the balloon go on its way.",
  },
  {
    id: "top-count",
    phase: PHASE_TOP,
    when: down(0.5),
    text: "The robot counts the floors on the way down. It is a different number, going down. It gets smaller each time, and that feels better.",
  },
  {
    id: "top-aeroplane",
    phase: PHASE_TOP,
    when: down(0.7),
    text: "A paper aeroplane drifts past from some window far above. The robot catches it, reads it, and puts it carefully in a pocket. It just says: hello.",
  },
];
