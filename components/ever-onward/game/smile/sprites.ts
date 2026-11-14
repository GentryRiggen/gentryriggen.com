import type { Palette } from "@/lib/ever-onward/start/sprites";

/** A round smiling face (11 x 12): the Make Everyone Smile hub card. */
export const SMILEY_ROWS: readonly string[] = [
  "...YYYYY...",
  "..YYYYYYY..",
  ".YYYYYYYYY.",
  ".YYKYYYKYY.",
  "YYYKYYYKYYY",
  "YYYYYYYYYYY",
  "YYKYYYYYKYY",
  "YYYKKKKKYYY",
  ".YYYYYYYYY.",
  ".YYYYYYYYY.",
  "..YYYYYYY..",
  "...YYYYY...",
];

export const SMILEY_LIT: Palette = { Y: "#fde047", K: "#78350f" };
export const SMILEY_DIM: Palette = { Y: "#5a5230", K: "#2f2410" };

/** A smiley sticker (9 x 9): what a finished Make Everyone Smile run earns. */
export const STICKER_ROWS: readonly string[] = [
  "..YYYYY..",
  ".YYYYYYY.",
  "YYKYYYKYY",
  "YYKYYYKYY",
  "YYYYYYYYY",
  "YKYYYYYKY",
  "YYKKKKKYY",
  ".YYYYYYY.",
  "..YYYYY..",
];

export const STICKER_COLORS: Palette = { Y: "#fde047", K: "#78350f" };
