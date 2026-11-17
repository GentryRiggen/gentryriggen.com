/**
 * Marshmallow Toast rules. Hold to toast over the flame; a marshmallow goes
 * white, golden, brown, then burnt. Release at golden for the best score.
 */

export type ToastStage = "white" | "golden" | "brown" | "burnt";

export const TOAST_MARSHMALLOWS = 5;
/** How much doneness (0 to 1) a second of toasting adds. */
export const TOAST_RATE = 0.18;
/** Where each stage starts on the 0 to 1 doneness scale. */
export const GOLDEN_FROM = 0.32;
export const BROWN_FROM = 0.58;
export const BURNT_FROM = 0.82;
/** The marshmallow stops toasting (and the hold ends) at this point. */
export const TOAST_MAX = 1;
/** A tap that toasts less than this counts as a raw one. */
export const RAW_BELOW = 0.12;

export function toastStage(doneness: number): ToastStage {
  if (doneness >= BURNT_FROM) return "burnt";
  if (doneness >= BROWN_FROM) return "brown";
  if (doneness >= GOLDEN_FROM) return "golden";
  return "white";
}

/**
 * Points for a marshmallow let go at `doneness`: 3 for golden, 2 for a nearly
 * golden or a brown one, 1 for a raw or a burnt one (a burnt one still makes
 * the pet giggle, so a round is always worth playing). 5 to 15 a round.
 */
export function toastPoints(doneness: number): number {
  const stage = toastStage(doneness);
  if (stage === "golden") return 3;
  if (stage === "brown") return 2;
  if (stage === "white" && doneness >= RAW_BELOW) return 2;
  return 1;
}
