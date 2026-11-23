/**
 * A dazzle scheme in the style of 1918 British merchant dazzle (the
 * Admiralty's Dazzle Section under Norman Wilkinson): big hard-edged
 * shapes in black, white, greys and a blue-grey, slanted across the hull
 * and houses so the eye cannot read her course. The Carpathia's own
 * pattern is not documented (README, "The Carpathia"): this one is ours.
 * Like the real schemes, her two sides differ.
 *
 * Pure data, no three.js or canvas: `textures.ts` draws it into one
 * texture. Shapes are in metres: `s` along the hull from its after end,
 * `z` up from the keel. Deterministic.
 */

/** The palette (sRGB). */
export const DAZZLE_COLORS = {
  black: 0x1d1f22,
  white: 0xe6e7e3,
  pale: 0xb9bec2,
  grey: 0x7f868d,
  blueGrey: 0x4f6475,
  dark: 0x3b4148,
} as const;

export type DazzleColor = keyof typeof DAZZLE_COLORS;

export interface DazzleShape {
  color: DazzleColor;
  /** A polygon, (s, z) in metres. */
  pts: [number, number][];
}

/** The pattern's ground: the first shape covers all of it in this. */
export const DAZZLE_GROUND: DazzleColor = "grey";

/**
 * One fan of bands: `n` parallelogram bands side by side, each crossing
 * the full height and slanted by `lean` (metres of run per metre of rise;
 * + leans forward going up), starting at `s0` on the keel, `widths` in
 * metres, colours in turn.
 */
interface Fan {
  s0: number;
  lean: number;
  /** The lean grows this much a band (the bands spread like a fan). */
  spread: number;
  widths: number[];
  colors: DazzleColor[];
}

/**
 * A wedge: a triangle from a base on the keel line (or the top) to a
 * point, cutting across the fans.
 */
interface Wedge {
  base: [number, number];
  /** The base along z = 0 (bottom) or z = height (top). */
  at: "bottom" | "top";
  tip: [number, number];
  color: DazzleColor;
}

interface Scheme {
  fans: Fan[];
  wedges: Wedge[];
}

/**
 * Port: three fans of bands leaning alternately, end to end along her
 * length so little ground shows, each cutting across the last; a black
 * wedge rising to the bow, white and blue-grey ones dropping from the top
 * amidships and at the stern, two more over the houses. Bold bands 5–13 m wide: the schemes' scale, a few shapes
 * to the length of a hold.
 */
const PORT: Scheme = {
  fans: [
    {
      s0: -34,
      lean: 1.15,
      spread: 0.06,
      widths: [10, 6, 12, 5, 9, 8, 11],
      colors: ["black", "white", "blueGrey", "white", "dark", "pale", "black"],
    },
    {
      s0: 44,
      lean: -1.05,
      spread: -0.05,
      widths: [8, 12, 5, 10, 7, 11, 6],
      colors: ["white", "black", "grey", "white", "blueGrey", "black", "pale"],
    },
    {
      s0: 92,
      lean: 0.95,
      spread: 0.07,
      widths: [6, 11, 8, 5, 13, 7, 10, 9],
      colors: [
        "black",
        "white",
        "grey",
        "black",
        "white",
        "blueGrey",
        "black",
        "white",
      ],
    },
  ],
  wedges: [
    { base: [128, 152], at: "bottom", tip: [178, 24], color: "black" },
    { base: [66, 92], at: "top", tip: [50, 6], color: "white" },
    { base: [4, 24], at: "top", tip: [-6, 8], color: "blueGrey" },
    // Two more from the top, so the houses carry the scheme too.
    { base: [100, 122], at: "top", tip: [114, 13], color: "black" },
    { base: [30, 50], at: "top", tip: [20, 14], color: "white" },
  ],
};

/** Starboard: a different scheme (the real ones never matched). */
const STARBOARD: Scheme = {
  fans: [
    {
      s0: -12,
      lean: -0.95,
      spread: -0.06,
      widths: [7, 10, 5, 12, 6, 9, 8],
      colors: ["blueGrey", "white", "black", "grey", "white", "black", "pale"],
    },
    {
      s0: 52,
      lean: 1.15,
      spread: 0.05,
      widths: [10, 4, 8, 6, 11, 7, 9],
      colors: ["black", "white", "dark", "pale", "black", "white", "blueGrey"],
    },
    {
      s0: 112,
      lean: -1.05,
      spread: -0.06,
      widths: [8, 5, 11, 6, 9, 7, 10, 12],
      colors: [
        "white",
        "blueGrey",
        "black",
        "white",
        "grey",
        "black",
        "white",
        "dark",
      ],
    },
  ],
  wedges: [
    { base: [142, 174], at: "top", tip: [120, 4], color: "white" },
    { base: [38, 64], at: "bottom", tip: [84, 25], color: "black" },
    { base: [-6, 14], at: "bottom", tip: [20, 24], color: "dark" },
    // Two more from the top, so the houses carry the scheme too.
    { base: [14, 42], at: "top", tip: [34, 13], color: "black" },
    { base: [96, 118], at: "top", tip: [84, 14], color: "blueGrey" },
  ],
};

/**
 * The shapes of one side, in drawing order (the ground first), over a
 * hull `length` m long and `height` m tall.
 */
export function dazzleShapes(
  side: "port" | "starboard",
  length: number,
  height: number
): DazzleShape[] {
  const scheme = side === "port" ? PORT : STARBOARD;
  // Schemes are drawn for a 170 m hull and 28 m of height: scale along.
  const k = length / 170;
  const kz = height / 28;
  const out: DazzleShape[] = [
    {
      color: DAZZLE_GROUND,
      pts: [
        [-1, -1],
        [length + 1, -1],
        [length + 1, height + 1],
        [-1, height + 1],
      ],
    },
  ];
  for (const fan of scheme.fans) {
    let s = fan.s0;
    fan.widths.forEach((w, i) => {
      const lean = fan.lean + fan.spread * i;
      const run = lean * 28;
      out.push({
        color: fan.colors[i % fan.colors.length],
        pts: [
          [s * k, -1],
          [(s + w) * k, -1],
          [(s + w + run) * k, (28 + 1) * kz],
          [(s + run) * k, (28 + 1) * kz],
        ],
      });
      s += w;
    });
  }
  for (const w of scheme.wedges) {
    const z = w.at === "bottom" ? -1 : (28 + 1) * kz;
    out.push({
      color: w.color,
      pts: [
        [w.base[0] * k, z],
        [w.base[1] * k, z],
        [w.tip[0] * k, w.tip[1] * kz],
      ],
    });
  }
  return out;
}
