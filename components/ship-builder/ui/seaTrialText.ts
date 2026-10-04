import type { SimSea } from "@/lib/ship-builder/sim/types";

/** How each sea reads in the trial's status line, matching the sea buttons. */
export const SEA_LABELS: Record<SimSea, string> = {
  calm: "Calm sea",
  choppy: "Choppy sea",
  stormy: "Stormy sea",
};
