import { STABILITY_THRESHOLDS } from "../model/stats";
import { HULL_STRENGTH, strainOf } from "./breakup";
import { PLUNGE_PITCH } from "./flooding";
import { LOPSIDED_LIST } from "./seaTrial";
import { formatStoryTime, storyMinutesSinceImpact } from "./story";
import type {
  CompartmentSpec,
  SimEvent,
  SimSea,
  SimShip,
  SimState,
  TrialInput,
  TrialReason,
} from "./types";

export interface TrialSummary {
  /** Short headline, e.g. "Steady as she goes!". */
  title: string;
  /** One or two plain sentences on what happened and why. */
  message: string;
  /** What to change next time; empty when the ship did well. */
  tips: string[];
  /** Iceberg trial: what happened to her lights, when they failed. */
  lights?: string;
  /** Iceberg trial that sank: whether she broke in two, and where. */
  breakup?: string;
  /** Present once she (or both halves) came to rest on the sea floor. */
  floor?: string;
}

const SEA_WORDS: Record<SimSea, string> = {
  calm: "calm sea",
  choppy: "choppy sea",
  stormy: "stormy sea",
};

const TIP_LOWER = "Build fewer levels on top, or move heavy blocks lower down.";
const TIP_WIDER = "Make the hull wider so she can't tip so easily.";
const TIP_BALANCE =
  "Balance the weight: put about the same on both sides of the middle.";
const TIP_CALMER = "Try a calmer sea first, then work up to the stormy one.";

function capsizedSummary(
  reason: TrialReason | null,
  ship: SimShip,
  sea: SimSea
): { message: string; tips: string[] } {
  const where = SEA_WORDS[sea];
  if (reason === "lopsided") {
    const side = ship.listAngle < 0 ? "port" : "starboard";
    return {
      message: `She was heavier on the ${side} side, so she leaned over and the ${where} tipped her the rest of the way.`,
      tips: [TIP_BALANCE, TIP_LOWER, ...(sea === "calm" ? [] : [TIP_CALMER])],
    };
  }
  if (reason === "stable" || reason === "rough-sea" || reason === null) {
    return {
      message: `The ${where} was too much for her and rolled her over.`,
      tips: [TIP_LOWER, TIP_WIDER, ...(sea === "calm" ? [] : [TIP_CALMER])],
    };
  }
  const how =
    reason === "dangerous"
      ? "She is very top-heavy, so even small waves can roll her over."
      : `She is top-heavy, and the ${where} was too much for her.`;
  return {
    message: how,
    tips: [TIP_LOWER, TIP_WIDER, ...(sea === "calm" ? [] : [TIP_CALMER])],
  };
}

function recoveredSummary(
  reason: TrialReason | null,
  sea: SimSea
): { message: string; tips: string[] } {
  if (reason === "lopsided") {
    return {
      message:
        "She rolled hard and came back up, but she leans to one side, which made it much riskier.",
      tips: [TIP_BALANCE],
    };
  }
  if (reason === "rough-sea") {
    return {
      message: `The ${SEA_WORDS[sea]} rolled her hard, but she is built well and bobbed back up.`,
      tips: [],
    };
  }
  return {
    message: `She rolled a long way in the ${SEA_WORDS[sea]} before she came back up. She is a bit top-heavy.`,
    tips: [TIP_LOWER, TIP_WIDER],
  };
}

function steadySummary(
  ship: SimShip,
  sea: SimSea
): { message: string; tips: string[] } {
  const isTopHeavy = ship.stabilityRatio >= STABILITY_THRESHOLDS.topHeavy;
  const isLeaning = Math.abs(ship.listAngle) >= LOPSIDED_LIST / 2;
  if (!isTopHeavy && !isLeaning) {
    return {
      message: `She sailed through the ${SEA_WORDS[sea]} without any trouble.`,
      tips: [],
    };
  }
  const tips = [
    ...(isTopHeavy ? [TIP_LOWER] : []),
    ...(isLeaning ? [TIP_BALANCE] : []),
  ];
  return {
    message: `She stayed steady in the ${SEA_WORDS[sea]}, but ${isTopHeavy ? "she is top-heavy" : "she leans a little"}, so a rougher sea could be too much.`,
    tips,
  };
}

const TIP_TALLER_WALLS = "Make the walls near the bow taller.";
const TIP_MORE_WALLS = "Add more walls so each compartment is smaller.";
const TIP_ADD_WALLS = "Add walls in Below deck, in the Hull panel.";

function compartmentsWord(count: number): string {
  return `${count} ${count === 1 ? "compartment" : "compartments"}`;
}

function openedCount(state: SimState): number {
  return state.compartments.filter((c) => c.opened).length;
}

function sankSummary(state: SimState): { message: string; tips: string[] } {
  const sunk = state.events.find((event) => event.kind === "sunk");
  const afloatFor = formatStoryTime(
    storyMinutesSinceImpact(sunk?.at ?? state.time)
  );
  const lead = `She stayed afloat for ${afloatFor}.`;
  switch (state.reason) {
    case "no-bulkheads":
      return {
        message: `${lead} She had no walls below deck, so the water filled her.`,
        tips: [TIP_ADD_WALLS],
      };
    case "too-many-opened":
      return {
        message: `${lead} The iceberg opened ${compartmentsWord(openedCount(state))} at once.`,
        tips: [TIP_MORE_WALLS],
      };
    default:
      return {
        message: `${lead} Water spilled over the low walls near the bow.`,
        tips: [TIP_TALLER_WALLS, TIP_MORE_WALLS],
      };
  }
}

const DEG = Math.PI / 180;

function hasEvent(state: SimState, kind: SimEvent["kind"]): boolean {
  return state.events.some((event) => event.kind === kind);
}

function lightsLine(state: SimState): string | undefined {
  if (hasEvent(state, "power-out")) {
    return "The lights flickered, then went out as she went down.";
  }
  if (hasEvent(state, "power-flicker")) {
    return "The lights flickered when the water reached the engine room.";
  }
  return undefined;
}

/** "just behind wall 3": the wall nearest where she broke, counted from the bow. */
function nearestWallWords(
  specs: readonly CompartmentSpec[],
  atX: number
): string | undefined {
  let best: { number: number; x: number } | undefined;
  for (let i = 0; i < specs.length - 1; i++) {
    const x = specs[i].toX;
    if (!best || Math.abs(x - atX) < Math.abs(best.x - atX)) {
      best = { number: i + 1, x };
    }
  }
  if (!best) return undefined;
  const side = atX >= best.x ? "just behind" : "just in front of";
  return `${side} wall ${best.number}`;
}

function breakupLine(state: SimState, input: TrialInput): string | undefined {
  const { iceberg } = input;
  if (!iceberg || state.outcome !== "sank") return undefined;
  if (state.breakup) {
    const degrees = Math.round(Math.abs(state.breakup.angle) / DEG);
    const where = nearestWallWords(iceberg.compartments, state.breakup.atX);
    const lead =
      iceberg.breakMode === "always"
        ? `She broke in two at ${degrees}°`
        : `She was too long to take the strain and broke in two at ${degrees}°`;
    return where ? `${lead}, ${where}.` : `${lead}.`;
  }
  switch (iceberg.breakMode) {
    case "never":
      return "You told her to hold together.";
    case "always":
      return "She went down before she could break.";
    default:
      // A ship that could never reach her limit is short and sturdy; a long
      // one that got lucky (she went down too gently) just held.
      return strainOf(PLUNGE_PITCH, iceberg.length) < HULL_STRENGTH
        ? "Short and sturdy, she held together."
        : "She held together, but only just.";
  }
}

function floorLine(state: SimState): string | undefined {
  if (!hasEvent(state, "touched-bottom")) return undefined;
  return state.halves
    ? "Both halves came to rest on the sea floor."
    : "She came to rest on the sea floor.";
}

/** The iceberg lines, only those that apply. */
function icebergLines(
  state: SimState,
  input: TrialInput
): Pick<TrialSummary, "lights" | "breakup" | "floor"> {
  const lines: Pick<TrialSummary, "lights" | "breakup" | "floor"> = {};
  const lights = lightsLine(state);
  const breakup = breakupLine(state, input);
  const floor = floorLine(state);
  if (lights) lines.lights = lights;
  if (breakup) lines.breakup = breakup;
  if (floor) lines.floor = floor;
  return lines;
}

/**
 * Plain-words summary of a finished trial for the result card. Kind in tone:
 * it talks about the ship, never about anyone aboard.
 */
export function explainTrial(state: SimState, input: TrialInput): TrialSummary {
  const { ship, sea } = input;
  switch (state.outcome) {
    case "capsized":
      return {
        title: "She capsized!",
        ...capsizedSummary(state.reason, ship, sea),
      };
    case "recovered":
      return {
        title: "That was close!",
        ...recoveredSummary(state.reason, sea),
      };
    case "steady":
      return {
        title: "Steady as she goes!",
        ...steadySummary(ship, sea),
      };
    case "afloat":
      return {
        title: "She stayed afloat!",
        message: `The walls kept the water in ${compartmentsWord(openedCount(state))}.`,
        tips: [],
        ...icebergLines(state, input),
      };
    case "sank":
      return {
        title: "She sank",
        ...sankSummary(state),
        ...icebergLines(state, input),
      };
    case null:
      return {
        title: "Sea trial under way",
        message: "Watch how she handles the waves.",
        tips: [],
      };
  }
}
