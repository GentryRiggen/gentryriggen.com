import { visitorHereFlag } from "../../engine/engine";
import type { RunState } from "../../engine/types";
import { bondGain } from "./tick";
import { isBallReady } from "./fetch";
import { forkSide } from "./forks";
import { isParadeOn, isProjectDone } from "./knowhow";
import { isTired, meterQuarters } from "./meter";
import {
  TRUST_STAGES,
  isWanting,
  trustFraction,
  trustStage,
  type TrustStage,
} from "./quiet";
import { PHASE_IDS, type SmilePhaseId } from "./resources";
import { RETURN_VISITOR_ID } from "./visitors";
import { TUNING } from "./tuning";

/** The few numbers the picture needs; the scene redraws only when they change. */
export interface SmileSceneInfo {
  phase: SmilePhaseId;
  /** This part's fork: 0 not chosen, 1 the first side, 2 the second. */
  fork: number;
  /** The three helper lines, by level owned in this part. */
  a: number;
  b: number;
  c: number;
  d: number;
  /** Scaling levels owned in this part. */
  scaling: number;
  /** Whether this part's ending purchase is made. */
  ended: boolean;
  /** The part's extra one-offs, drawn when owned. */
  extraA: number;
  extraB: number;
  extraC: number;
  /** Town and world: the parade is on, the cheer meter in quarters, worn out. */
  parade: boolean;
  heat: number;
  tired: boolean;
  /** Which know-how projects are done (bit 0, 1 and 2). */
  projects: number;
  /** Friend: the bank's tier (0 to 3), and the puppy waits with a ball. */
  bond: number;
  ball: boolean;
  /** Quiet: whole percent of trust (steps of 5), and the face's stage. */
  trust: number;
  face: TrustStage;
  /** Quiet: the friend wants something, and the kettle is on. */
  wanting: boolean;
  /** Quiet: someone smiled. */
  visitorHere: boolean;
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** [a, b, c, d, scale, extraA, extraB, extraC, ender] ids per phase. */
const IDS: readonly (readonly string[])[] = [
  [
    "balloon",
    "puppy",
    "lemonade",
    "magic-hat",
    "joke-book",
    "bracelet",
    "",
    "",
    "next-door",
  ],
  [
    "clown",
    "band",
    "smile-factory",
    "fireworks",
    "bunting",
    "bench",
    "",
    "",
    "key-to-town",
  ],
  [
    "poster",
    "loudspeaker",
    "cheer-tower",
    "cheer-blimp",
    "bigger-brush",
    "mask-booth",
    "no-bad-days",
    "",
    "cheer-satellite",
  ],
  [
    "tea",
    "blanket",
    "rain",
    "candle",
    "long-silence",
    "kettle",
    "room-on-bench",
    "",
    "",
  ],
];

const PROJECT_IDS: readonly (readonly string[])[] = [
  [],
  ["big-top", "shady-corners", "confetti-cannons"],
  ["quiet-hours", "every-language", "grin-guide"],
  [],
];

const level = (run: RunState, id: string): number => (id ? owned(run, id) : 0);

/** The bank's tier: empty, a little, a good deal, nearly full. */
function bondTier(run: RunState): number {
  if (run.phase !== 0) return 0;
  const gain = bondGain(run) / TUNING.bond.maxGain;
  return gain >= 0.6 ? 3 : gain >= 0.3 ? 2 : gain >= 0.05 ? 1 : 0;
}

export function sceneInfo(run: RunState): SmileSceneInfo {
  const p = Math.max(0, Math.min(3, run.phase));
  const phase = PHASE_IDS[p];
  const ids = IDS[p];
  const forkId = (["friend", "town", "world", "quiet"] as const)[p];
  const side = forkSide(run, forkId);
  const trust = trustFraction(run);
  return {
    phase,
    fork: side === null ? 0 : side + 1,
    a: level(run, ids[0]),
    b: level(run, ids[1]),
    c: level(run, ids[2]),
    d: level(run, ids[3]),
    scaling: level(run, ids[4]),
    ended: ids[8] ? owned(run, ids[8]) > 0 : false,
    extraA: level(run, ids[5]),
    extraB: level(run, ids[6]),
    extraC: level(run, ids[7]),
    parade: isParadeOn(run) && (p === 1 || p === 2),
    heat: p === 1 || p === 2 ? meterQuarters(run) : 0,
    tired: isTired(run),
    projects: PROJECT_IDS[p].reduce(
      (bits, id, i) => bits | (isProjectDone(run, id) ? 1 << i : 0),
      0
    ),
    bond: bondTier(run),
    ball: isBallReady(run),
    trust: p === 3 ? Math.round(trust * 20) * 5 : 0,
    face: p === 3 ? trustStage(run) : TRUST_STAGES[0],
    wanting: p === 3 && isWanting(run),
    visitorHere: run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true,
  };
}

/** True when two scene infos draw the same picture. */
export function isSameSceneInfo(a: SmileSceneInfo, b: SmileSceneInfo): boolean {
  return (Object.keys(a) as (keyof SmileSceneInfo)[]).every(
    (key) => a[key] === b[key]
  );
}
