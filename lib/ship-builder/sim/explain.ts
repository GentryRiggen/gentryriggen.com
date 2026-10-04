import { STABILITY_THRESHOLDS } from "../model/stats";
import { LOPSIDED_LIST } from "./seaTrial";
import type { SimSea, SimShip, SimState, TrialReason } from "./types";

export interface TrialSummary {
  /** Short headline, e.g. "Steady as she goes!". */
  title: string;
  /** One or two plain sentences on what happened and why. */
  message: string;
  /** What to change next time; empty when the ship did well. */
  tips: string[];
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

/**
 * Plain-words summary of a finished trial for the result card. Kind in tone:
 * it talks about the ship, never about anyone aboard.
 */
export function explainTrial(
  state: SimState,
  ship: SimShip,
  sea: SimSea
): TrialSummary {
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
    case null:
      return {
        title: "Sea trial under way",
        message: "Watch how she handles the waves.",
        tips: [],
      };
  }
}
