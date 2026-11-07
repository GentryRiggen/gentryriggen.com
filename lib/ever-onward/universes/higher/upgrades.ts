import { ownsAtLeast } from "../../engine/goal";
import { rateEffect } from "../../engine/purchaseFeedback";
import type { RunState, UpgradeDef } from "../../engine/types";
import { leanCalm, swayCalm } from "./sway";
import {
  PHASE_IDS,
  PHASE_PLAYROOM,
  PHASE_SKY,
  PHASE_TOP,
  PHASE_TOWN,
  type HigherPhaseId,
  MANUAL_RESOURCES,
  RESOURCES,
} from "./resources";
import { descentShare } from "./descent";
import { incomePerSecond, manualPerTap } from "./tick";
import { owned } from "./lines";
import { TUNING } from "./tuning";

/** What this chapter's taps and helpers make, lowercase ("blocks"). */
const noun = (run: RunState): string =>
  (
    RESOURCES.find((r) => r.id === MANUAL_RESOURCES[run.phase])?.label ?? ""
  ).toLowerCase();

/** "Blocks per tap 2 → 3" for a scale step, read from the run as it stands. */
function scalePreview(run: RunState, id: string): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  return [
    rateEffect(manualPerTap(run), manualPerTap(after), `${noun(run)} per tap`),
    rateEffect(
      incomePerSecond(run),
      incomePerSecond(after),
      `${noun(run)}/sec`
    ),
  ].join("\n");
}

function ratePreview(run: RunState, id: string): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  return rateEffect(
    incomePerSecond(run),
    incomePerSecond(after),
    `${noun(run)}/sec`
  );
}

/**
 * "The tower sways 30% slower" then "Sway speed ×0.77 → ×0.54", for a brace
 * or a one-off that calms the tower.
 */
function swayPreview(run: RunState, id: string): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  const round = (n: number): string => String(Math.round(n * 100) / 100);
  if (run.phase === 0) {
    // The playroom's lean comes from the build pace; braces only go so far.
    const floor = TUNING.playroom.calmFloor;
    const was = Math.max(floor, leanCalm(run));
    const now = Math.max(floor, leanCalm(after));
    const less = Math.round((1 - now / was) * 100);
    return `The tower leans ${less}% less\nLean amount ×${round(was)} → ×${round(now)}\nA leaning tower tumbles sooner`;
  }
  const before = swayCalm(run);
  const next = swayCalm(after);
  const slower = before > 0 ? Math.round((1 - next / before) * 100) : 0;
  return `The tower sways ${slower}% slower\nSway speed ×${round(before)} → ×${round(next)}\nA leaning tower slows the crew`;
}

const RAW_UPGRADES: readonly UpgradeDef[] = [
  // The Playroom
  {
    id: "bear",
    name: "A teddy stacker",
    description:
      "He stacks blocks all by himself, one fuzzy paw at a time, and he never gets bored.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 15,
    costGrowth: 2.4,
    maxLevel: 6,
    effectPreview: (run) => ratePreview(run, "bear"),
  },
  {
    id: "big-blocks",
    name: "Bigger blocks",
    description:
      "The big wooden ones from the bottom of the box. Every tap and every helper does more.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 120,
    costGrowth: 2.6,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("bear", 2),
    effectPreview: (run) => scalePreview(run, "big-blocks"),
  },
  {
    id: "rug-corners",
    name: "Tape on the rug corners",
    description:
      "The rug stops sliding, so the tower leans less at every pace. Fewer tumbles for you.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 90,
    costGrowth: 1.9,
    maxLevel: 3,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("bear", 3),
    effectPreview: (run) => swayPreview(run, "rug-corners"),
  },
  {
    id: "ramp",
    name: "A cardboard ramp",
    description:
      "Blocks roll up the ramp on their own. It is three or four times as fast as the teddy.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 700,
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("bear", 4),
    effectPreview: (run) => ratePreview(run, "ramp"),
  },
  {
    id: "cushion-fort",
    name: "A cushion fort",
    description:
      "Sofa cushions around the bottom. Soft and wide, and the tower leans half as much.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 3000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("rug-corners", 2),
    effectPreview: (run) => swayPreview(run, "cushion-fort"),
  },
  {
    id: "toy-crane",
    name: "A toy crane",
    description:
      "Yellow plastic, with a hook and a handle that goes round and round. It lifts blocks right to the top.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 4500,
    costGrowth: 2.2,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("ramp", 3),
    effectPreview: (run) => ratePreview(run, "toy-crane"),
  },
  {
    id: "fairy-lights",
    name: "A string of fairy lights",
    description:
      "Warm little lights wound round the tower. The whole playroom cheers up, and everything pays more.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 25000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("toy-crane", 2),
    effectPreview: (run) => ratePreview(run, "fairy-lights"),
  },
  {
    id: "treehouse",
    name: "A treehouse for the tower",
    description:
      "Planks, a rope ladder and a flag. The block tower climbs out of the playroom and into the big world.",
    phases: [PHASE_PLAYROOM],
    currency: "blocks",
    baseCost: 250000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("fairy-lights", 1),
  },
  // The Town
  {
    id: "mason",
    name: "A cheerful mason",
    description:
      "She lays bricks in neat rows, and whistles while she does it.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 150,
    costGrowth: 2.4,
    maxLevel: 6,
    effectPreview: (run) => ratePreview(run, "mason"),
  },
  {
    id: "scaffolding",
    name: "Scaffolding",
    description:
      "Poles and planks all the way up, so every tap and every crew can reach further.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 1500,
    costGrowth: 2.6,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("mason", 2),
    effectPreview: (run) => scalePreview(run, "scaffolding"),
  },
  {
    id: "cross-braces",
    name: "Cross-braces",
    description:
      "Big iron X shapes inside the walls. The tower sways more slowly.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 500,
    costGrowth: 1.9,
    maxLevel: 3,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("mason", 2),
    effectPreview: (run) => swayPreview(run, "cross-braces"),
  },
  {
    id: "crane",
    name: "A tower crane",
    description:
      "Red and tall, with a hook that swings out over the whole town. It lifts about six times what a mason carries.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 20000,
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("mason", 3),
    effectPreview: (run) => ratePreview(run, "crane"),
  },
  {
    id: "safety-nets",
    name: "Safety nets",
    description:
      "Wide nets slung round every floor. The crews feel steadier, and the tower sways half as fast.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 40000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("cross-braces", 2),
    effectPreview: (run) => swayPreview(run, "safety-nets"),
  },
  {
    id: "concrete-truck",
    name: "A concrete truck",
    description:
      "Round and rumbling, and it pours a whole floor before lunch. It out-builds a crane six times over.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 190000,
    costGrowth: 2.2,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("crane", 3),
    effectPreview: (run) => ratePreview(run, "concrete-truck"),
  },
  {
    id: "neon-sign",
    name: "A big neon sign",
    description:
      "It says TOWER in letters taller than a bus. The whole town comes to look, and everything pays more.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 1000000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("concrete-truck", 2),
    effectPreview: (run) => ratePreview(run, "neon-sign"),
  },
  {
    id: "skyscraper",
    name: "The top floor",
    description:
      "A glass room at the very top, with a flag and a view of the whole town. The tower is the tallest thing in the valley, and there is still more sky.",
    phases: [PHASE_TOWN],
    currency: "bricks",
    baseCost: 3800000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("neon-sign", 1),
  },
  // The Sky
  {
    id: "sky-crew",
    name: "A cloud-top crew",
    description:
      "Tiny figures on a wobbly platform above the weather, waving down at the birds.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 500,
    costGrowth: 2.4,
    maxLevel: 6,
    effectPreview: (run) => ratePreview(run, "sky-crew"),
  },
  {
    id: "alloy",
    name: "Lightweight alloy",
    description:
      "Shiny, thin and strong. Every tap and every crew lifts more, because there is less to lift.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 2400,
    costGrowth: 2.6,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("sky-crew", 2),
    effectPreview: (run) => scalePreview(run, "alloy"),
  },
  {
    id: "damper",
    name: "A tuned damper",
    description:
      "A huge steel ball hung inside the tower. It swings against the wind, so the tower sways more slowly.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 1500,
    costGrowth: 1.9,
    maxLevel: 3,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("sky-crew", 2),
    effectPreview: (run) => swayPreview(run, "damper"),
  },
  {
    id: "cloud-crane",
    name: "A cloud crane",
    description:
      "It stands on a cloud and lifts beams from the ground a mile below. About seven times a crew.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 40000,
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("sky-crew", 3),
    effectPreview: (run) => ratePreview(run, "cloud-crane"),
  },
  {
    id: "ballast-ring",
    name: "A ring of ballast",
    description:
      "Round weights hung from the lower floors, like a skirt. The tower sways half as fast.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 25000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("damper", 2),
    effectPreview: (run) => swayPreview(run, "ballast-ring"),
  },
  {
    id: "cable-spinner",
    name: "A cable spinner",
    description:
      "It spins a cable thinner than a thread and longer than a road, up and up. Seven times a cloud crane.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 500000,
    costGrowth: 2.2,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("cloud-crane", 3),
    effectPreview: (run) => ratePreview(run, "cable-spinner"),
  },
  {
    id: "beacon",
    name: "A red beacon",
    description:
      "A light at the very top so the aeroplanes know where the tower is. Everything pays more.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 3800000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("cable-spinner", 2),
    effectPreview: (run) => ratePreview(run, "beacon"),
  },
  {
    id: "space-elevator",
    name: "The last block",
    description:
      "One more block, and a very long cable reaching up into the dark. The tower cannot get any higher, because there is no more up.",
    phases: [PHASE_SKY],
    currency: "beams",
    baseCost: 26000000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("beacon", 1),
  },
  // The Top
  {
    id: "stair-lamp",
    name: "A lamp on the stair",
    description:
      "A small warm light on every landing, so the way down is never dark.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 10,
    costGrowth: 2.4,
    maxLevel: 6,
    effectPreview: (run) => ratePreview(run, "stair-lamp"),
  },
  {
    id: "light-load",
    name: "Set something down",
    description:
      "The robot leaves a spare spanner on a step. The pack is lighter, and every step is easier.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 40,
    costGrowth: 2.5,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("stair-lamp", 2),
    effectPreview: (run) => scalePreview(run, "light-load"),
  },
  {
    id: "songbird",
    name: "A songbird for company",
    description:
      "It landed on the rail on its own and stayed. It sings the whole way down.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 110,
    costGrowth: 2.3,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("stair-lamp", 3),
    effectPreview: (run) => ratePreview(run, "songbird"),
  },
  {
    id: "hum",
    name: "A tune to hum",
    description:
      "Something the robot half remembers, from when a small voice used to sing it.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 1500,
    costGrowth: 2.2,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("songbird", 3),
    effectPreview: (run) => ratePreview(run, "hum"),
  },
  {
    id: "rest-bench",
    name: "A bench on the landing",
    description:
      "The robot sits for a minute with the block on its knee. Everything feels easier afterwards, and every step pays more.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 1500,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("stair-lamp", 4),
    effectPreview: (run) => ratePreview(run, "rest-bench"),
  },
  {
    id: "window-seat",
    name: "A seat by the window",
    description:
      "From here the whole way down is in view, and the ground looks nearer. Every step pays more again.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 30000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("rest-bench", 1),
    effectPreview: (run) => ratePreview(run, "window-seat"),
  },
  {
    id: "block-lantern",
    name: "A lantern for the last block",
    description:
      "The robot wraps the one block it carries in a warm cloth, with a candle inside. Every quiet step brings the ground twice as close.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 100000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) =>
      descentShare(run) >= 0.1 || owned(run, "songbird") >= 2,
    effectPreview: () => "Every step down brings the ground twice as close",
  },
  {
    id: "set-down",
    name: "Set the block down",
    description:
      "At the bottom of the stairs, the grass. The robot puts its one block down very gently. Nothing needs to go on top of it.",
    phases: [PHASE_TOP],
    currency: "quiet",
    baseCost: 3000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => descentShare(run) >= 0.95,
  },
];

/**
 * Every price in a phase, scaled together: the pacing knob (see TUNING).
 */
const CHAPTER_EFFECTS: Readonly<Record<string, string>> = {
  treehouse: "Finish the playroom and open The Town",
  skyscraper: "Finish the town and open The Sky",
  "space-elevator": "Place the last block and open The Top",
  "set-down": "Set down the block and welcome the visitor",
};

export const UPGRADES: readonly UpgradeDef[] = RAW_UPGRADES.map((u) => {
  const phase = Math.max(
    0,
    PHASE_IDS.indexOf((u.phases?.[0] ?? PHASE_PLAYROOM) as HigherPhaseId)
  );
  return {
    ...u,
    badge: CHAPTER_EFFECTS[u.id]
      ? u.id === "set-down"
        ? "LAST STEP"
        : "NEXT CHAPTER"
      : u.badge,
    effectPreview:
      u.effectPreview ??
      (CHAPTER_EFFECTS[u.id] ? () => CHAPTER_EFFECTS[u.id] : undefined),
    baseCost: u.baseCost * TUNING.costScale[phase],
    costGrowth:
      u.costGrowth > 1 ? u.costGrowth * TUNING.costSteepness[phase] : 1,
  };
});
