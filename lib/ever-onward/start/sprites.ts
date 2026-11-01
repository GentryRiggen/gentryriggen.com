/**
 * Pixel art for the start screen and the icons, as plain strings so it is
 * easy to read and to change. "." is empty; every other character is a key
 * into a palette.
 */

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

export type Palette = Readonly<Record<string, string>>;

/**
 * Turns rows of characters into rectangles, merging horizontal runs of the
 * same color so the SVG stays small.
 */
export function spriteRects(
  rows: readonly string[],
  palette: Palette,
  offsetX = 0,
  offsetY = 0
): PixelRect[] {
  const rects: PixelRect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      const fill = palette[key];
      if (key === "." || !fill) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      rects.push({ x: x + offsetX, y: y + offsetY, w: end - x, h: 1, fill });
      x = end;
    }
  });
  return rects;
}

/** The little robot, facing front, lantern in its right hand (20 x 18). */
export const ROBOT_ROWS: readonly string[] = [
  ".........AA.........",
  ".........KK.........",
  "....KKKKKKKKKKKK....",
  "....KBBBBBBBBBBK....",
  "....KBVVVVVVVVBK....",
  "....KBVVVVVVVVBK....",
  "....KBVVVVVVVVBK....",
  "....KBVVVVVVVVBK....",
  "....KBBBBBBBBBBK....",
  "....KKKKKKKKKKKK....",
  "........KBBK.....KK.",
  ".....KKKKKKKKKK..KK.",
  "...KBKBBBBBBBBK.OOOO",
  "...KBKBBBAABBBKBOLLO",
  "...KKKbbbbbbbbKKOLLO",
  ".....KKKKKKKKKK.OLLO",
  "......KK....KK..OOOO",
  ".....KKKK..KKKK.....",
];

export const ROBOT_WIDTH = 20;
export const ROBOT_HEIGHT = ROBOT_ROWS.length;

/** The two eyes (they blink), in robot pixels. */
export const ROBOT_EYES: readonly {
  x: number;
  y: number;
  w: number;
  h: number;
}[] = [
  { x: 7, y: 5, w: 2, h: 2 },
  { x: 11, y: 5, w: 2, h: 2 },
];

/** The lantern's centre, in robot pixels (for the glow and the beam). */
export const LANTERN_CENTER = { x: 18, y: 14.5 } as const;

export const ROBOT_COLORS: Palette = {
  K: "#26335f",
  V: "#060a18",
  B: "#b6c6e6",
  b: "#7d90ba",
  A: "#fb7185",
  O: "#78350f",
};

export const EYE_COLOR = "#67e8f9";

/** A lighthouse (9 x 14) in lit and unlit colors, and a padlock (9 x 7). */
export const LIGHTHOUSE_ROWS: readonly string[] = [
  "....R....",
  "...RRR...",
  "..RRRRR..",
  "..KYYYK..",
  "..KYYYK..",
  "..WWWWW..",
  "..RRRRR..",
  "..WWWWW..",
  ".RRRRRRR.",
  ".WWWWWWW.",
  ".RRRRRRR.",
  ".WWWWWWW.",
  "KKKKKKKKK",
  "KKKKKKKKK",
];

export const LIGHTHOUSE_LIT: Palette = {
  R: "#ef4444",
  W: "#f1f5f9",
  K: "#475569",
  Y: "#fde047",
};

export const LIGHTHOUSE_DIM: Palette = {
  R: "#7f1d1d",
  W: "#64748b",
  K: "#1e293b",
  Y: "#475569",
};

export const PADLOCK_ROWS: readonly string[] = [
  "...SSS...",
  "..S...S..",
  "..S...S..",
  ".SSSSSSS.",
  ".SSSkSSS.",
  ".SSSkSSS.",
  ".SSSSSSS.",
];

export const PADLOCK_COLORS: Palette = { S: "#475569", k: "#0f172a" };

/** A speaker (9 x 7); the waves are a separate sprite so "off" can drop them. */
export const SPEAKER_ROWS: readonly string[] = [
  "...S.....",
  "..SS..W..",
  "SSSS...W.",
  "SSSS..W.W",
  "SSSS...W.",
  "..SS..W..",
  "...S.....",
];

export const SPEAKER_ON: Palette = { S: "#fcd34d", W: "#fde68a" };
export const SPEAKER_OFF: Palette = { S: "#64748b" };

/** A small flame: the ember icon. */
export const EMBER_ROWS = [
  "...O...",
  "..OO...",
  "..OOO.O",
  ".OOYOOO",
  "OOOYYOO",
  "OOYYYOO",
  "OOYYYOO",
  ".OOYOO.",
  "..OOO..",
] as const;

export const EMBER_COLORS: Palette = { O: "#fb923c", Y: "#fde047" };

/** A seedling in a pot (11 x 12): the Make It Grow hub card, lit and dim. */
export const SEEDLING_ROWS: readonly string[] = [
  "..GG...GG..",
  ".GGGG.GGGG.",
  ".GGGGGGGGG.",
  "..GGG.GGG..",
  ".....S.....",
  ".....S.....",
  ".....S.....",
  "..PPPPPPP..",
  "..PPPPPPP..",
  "...PPPPP...",
  "...PPPPP...",
  "...PPPPP...",
];

export const SEEDLING_LIT: Palette = {
  G: "#4ade80",
  S: "#16a34a",
  P: "#c2410c",
};

export const SEEDLING_DIM: Palette = {
  G: "#365a43",
  S: "#27422f",
  P: "#4a2a1c",
};

/** An acorn (9 x 11): what a finished Make It Grow run earns. */
export const ACORN_ROWS: readonly string[] = [
  "....T....",
  "..CCCCC..",
  ".CCCCCCC.",
  ".CDCDCDC.",
  ".CCCCCCC.",
  "..NNNNN..",
  ".NNLNNNN.",
  ".NNLNNNN.",
  "..NNNNN..",
  "...NNN...",
  "....N....",
];

export const ACORN_COLORS: Palette = {
  T: "#78350f",
  C: "#92400e",
  D: "#78350f",
  N: "#d97706",
  L: "#fcd34d",
};
