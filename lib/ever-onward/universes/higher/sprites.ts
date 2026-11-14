import type { Palette } from "../../start/sprites";

/** A little block tower (11 x 12): the Build It Higher hub card, lit and dim. */
export const BLOCKS_ROWS: readonly string[] = [
  "....RR.....",
  "....RR.....",
  "...BBBB....",
  "...BBBB....",
  "..YYYYYY...",
  "..YYYYYY...",
  ".GGGGGGGG..",
  ".GGGGGGGG..",
  "PPPPPPPPPP.",
  "PPPPPPPPPP.",
  "WWWWWWWWWWW",
  "WWWWWWWWWWW",
];

export const BLOCKS_LIT: Palette = {
  R: "#ef4444",
  B: "#38bdf8",
  Y: "#facc15",
  G: "#4ade80",
  P: "#c084fc",
  W: "#fb923c",
};

export const BLOCKS_DIM: Palette = {
  R: "#5b2a2a",
  B: "#1f4560",
  Y: "#5c5214",
  G: "#2a5238",
  P: "#47355e",
  W: "#5a3a1f",
};

/** A gold star (9 x 9): what a finished Build It Higher run earns. */
export const STAR_ROWS: readonly string[] = [
  "....Y....",
  "....Y....",
  "...YYY...",
  "YYYYYYYYY",
  ".YYYLYYY.",
  "..YYYYY..",
  "..YYYYY..",
  ".YYY.YYY.",
  ".YY...YY.",
];

export const STAR_COLORS: Palette = {
  Y: "#fbbf24",
  L: "#fef08a",
};
