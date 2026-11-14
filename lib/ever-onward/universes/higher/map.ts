import { add, helpers, mul } from "../../engine/mapKit";
import type { ArtifactDef, MapDef } from "../../engine/types";

/** Build It Higher's prestige map: the Blueprint. Right is the next town, down is deeper inside the blueprint. Effects only touch numbers the tick already reads (`speed`, `tapMult`, `costMult`, `headStart`) and starting helpers. */
export const HIGHER_ARTIFACTS: readonly ArtifactDef[] = [
  {
    id: "golden-level",
    x: 1,
    y: 3,
    tier: "big",
    name: "The Golden Level",
    effect: "Everything builds 15% faster, in every part.",
    apply: (run) => mul(run, "speed", 1.15),
    spot: { x: 14, y: 118, scale: 1.5 },
    palette: { G: "#f5c542", g: "#a8791b", B: "#8fe3a0", W: "#e8fff0" },
    glyph: [
      "............",
      "............",
      "............",
      "GGGGGGGGGGGG",
      "GgggBBWBgggG",
      "GgggBBBBgggG",
      "GGGGGGGGGGGG",
      ".....gg.....",
      "....gggg....",
      "............",
      "............",
      "............",
    ],
  },
  {
    id: "teddy-crew",
    x: 5,
    y: 1,
    tier: "big",
    name: "The Teddy Crew",
    effect:
      "Every run starts with two teddy stackers already at work and a little extra to spend in each part.",
    apply: (run) => {
      helpers(run, "bear", 2, 6);
      add(run, "headStart", 1);
    },
    spot: { x: 368, y: 118, scale: 1.5 },
    palette: { B: "#a8703f", b: "#7a4a24", K: "#1b1b1b", P: "#f2c9a0" },
    glyph: [
      ".bb......bb.",
      ".bBb....bBb.",
      "..bBBBBBBb..",
      "..BBKBBKBB..",
      "..BBBPPBBB..",
      "..BBPKKPBB..",
      "...BBPPBB...",
      ".BBBBBBBBBB.",
      "BB.BBBBBB.BB",
      "...BBBBBB...",
      "..BBB..BBB..",
      "............",
    ],
  },
  {
    id: "master-plan",
    x: 2,
    y: 2,
    tier: "big",
    name: "The Master Plan",
    effect: "Everything builds 10% faster and upgrades cost 10% less.",
    apply: (run) => {
      mul(run, "speed", 1.1);
      mul(run, "costMult", 0.9);
    },
    spot: { x: 44, y: 118, scale: 1.5 },
    palette: { U: "#2f5fb3", u: "#1d3f80", W: "#dbeafe" },
    glyph: [
      "............",
      ".UUUUUUUUUU.",
      ".UWWWWUUUUu.",
      ".UWUUWUWWUu.",
      ".UWUUWUUWUu.",
      ".UWWWWUUWUu.",
      ".UUUUUUWWUu.",
      ".UWWWWWWUUu.",
      ".UUUUUUUUUu.",
      "..uuuuuuuuu.",
      "............",
      "............",
    ],
  },
  {
    id: "lucky-rivet",
    x: 1,
    y: 0,
    tier: "modest",
    name: "A Lucky Rivet",
    effect: "Everything builds 8% faster.",
    apply: (run) => mul(run, "speed", 1.08),
    spot: { x: 160, y: 124, scale: 1.1 },
    palette: { M: "#b0b8c4", m: "#6b7280", W: "#ffffff" },
    glyph: [
      "............",
      "....MMMM....",
      "...MWWMMm...",
      "..MWMMMMMm..",
      "..MMMMMMMm..",
      "..MMMMMMmm..",
      "...mmmmmm...",
      ".....MM.....",
      ".....MM.....",
      ".....Mm.....",
      ".....mm.....",
      "............",
    ],
  },
  {
    id: "grippy-gloves",
    x: 7,
    y: 5,
    tier: "modest",
    name: "Grippy Gloves",
    effect: "Every tap is worth 25% more.",
    apply: (run) => mul(run, "tapMult", 1.25),
    spot: { x: 196, y: 124, scale: 1.1 },
    palette: { O: "#f59e0b", o: "#b45309" },
    glyph: [
      "............",
      "...O.O.O....",
      "...O.O.O.O..",
      "...O.O.O.O..",
      ".O.OOOOOOO..",
      ".OOOOOOOOO..",
      "..OOOOOOOO..",
      "..OOoOOoOO..",
      "...OOOOOO...",
      "...oooooo...",
      "...oooooo...",
      "............",
    ],
  },
  {
    id: "spare-blocks",
    x: 5,
    y: 6,
    tier: "modest",
    name: "A Box of Spare Blocks",
    effect: "Each part starts with a little extra to spend.",
    apply: (run) => add(run, "headStart", 1),
    spot: { x: 232, y: 124, scale: 1.1 },
    palette: { R: "#e2433b", Y: "#f5c542", B: "#3b82f6", G: "#22c55e" },
    glyph: [
      "............",
      "....YYYY....",
      "....YYYY....",
      "....YYYY....",
      "....YYYY....",
      "RRRRGGGGBBBB",
      "RRRRGGGGBBBB",
      "RRRRGGGGBBBB",
      "RRRRGGGGBBBB",
      "............",
      "............",
      "............",
    ],
  },
  {
    id: "discount-card",
    x: 4,
    y: 4,
    tier: "modest",
    name: "A Builder's Discount Card",
    effect: "Upgrades cost 6% less.",
    apply: (run) => mul(run, "costMult", 0.94),
    spot: { x: 268, y: 124, scale: 1.1 },
    palette: { C: "#a78bfa", c: "#6d28d9", W: "#ffffff", Y: "#fde047" },
    glyph: [
      "............",
      "............",
      "CCCCCCCCCCCC",
      "CccccccccccC",
      "CCCCCCCCCCCC",
      "CWWCCCCCYYCC",
      "CCCCCCCCYYCC",
      "CWWWWWCCCCCC",
      "CCCCCCCCCCCC",
      "............",
      "............",
      "............",
    ],
  },
  {
    id: "foreman-whistle",
    x: 0,
    y: 2,
    tier: "modest",
    name: "The Foreman's Whistle",
    effect: "Every tap is worth 15% more.",
    apply: (run) => mul(run, "tapMult", 1.15),
    spot: { x: 304, y: 124, scale: 1.1 },
    palette: { S: "#c0c6d0", s: "#6b7280", R: "#e2433b" },
    glyph: [
      "............",
      "............",
      ".......RR...",
      "......R..R..",
      "SSSSSSSs.R..",
      "SsssssSSRR..",
      "SSSSSSSS....",
      "....SSSS....",
      "....SSSS....",
      ".....ss.....",
      "............",
      "............",
    ],
  },
  {
    id: "ear-pencil",
    x: 6,
    y: 3,
    tier: "modest",
    name: "A Pencil Behind Your Ear",
    effect: "Upgrades cost 4% less.",
    apply: (run) => mul(run, "costMult", 0.96),
    spot: { x: 178, y: 144, scale: 1.1 },
    palette: { Y: "#facc15", P: "#f9a8d4", K: "#1b1b1b", W: "#f1d5a8" },
    glyph: [
      "...........P",
      "..........YP",
      ".........YY.",
      "........YY..",
      ".......YY...",
      "......YY....",
      ".....YY.....",
      "....YY......",
      "...YY.......",
      "..WW........",
      ".KW.........",
      "K...........",
    ],
  },
  {
    id: "wobbly-crane",
    x: 1,
    y: 7,
    tier: "odd",
    name: "The Wobbly Crane",
    effect: "Everything builds 12% faster.",
    catch: "Upgrades cost 8% more.",
    apply: (run) => {
      mul(run, "speed", 1.12);
      mul(run, "costMult", 1.08);
    },
    spot: { x: 214, y: 144, scale: 1.1 },
    palette: { Y: "#facc15", K: "#1b1b1b", s: "#6b7280" },
    glyph: [
      "YYYYYYYYYY..",
      "Y.Y.Y.Y.YY..",
      ".........Y..",
      ".........Y..",
      "..s......Y..",
      "..s......Y..",
      "..KK.....Y..",
      ".........Y..",
      ".........Y..",
      "........YYY.",
      ".......YYYYY",
      ".......KKKKK",
    ],
  },
  {
    id: "sledgehammer",
    x: 7,
    y: 2,
    tier: "odd",
    name: "The Sledgehammer",
    effect: "Every tap is worth 60% more.",
    catch: "Everything else builds 8% slower.",
    apply: (run) => {
      mul(run, "tapMult", 1.6);
      mul(run, "speed", 0.92);
    },
    spot: { x: 250, y: 144, scale: 1.1 },
    palette: { H: "#6b7280", h: "#374151", B: "#8a5a2b" },
    glyph: [
      "............",
      ".HHHHHHH....",
      ".HhhhhhH....",
      ".HHHHHHH....",
      "....B.......",
      "....B.......",
      "....B.......",
      "....B.......",
      "....B.......",
      "....B.......",
      "....B.......",
      "............",
    ],
  },
  {
    id: "night-watchman",
    x: 4,
    y: 2,
    tier: "odd",
    name: "The Night Watchman",
    effect:
      "Nothing at all. A watchman with a lantern walks past the site in every run now, and checks on you.",
    apply: () => {},
    spot: { x: 0, y: 236, scale: 1.6, walk: true },
    palette: {
      C: "#1e3a8a",
      F: "#f2c9a0",
      K: "#1b1b1b",
      B: "#334155",
      L: "#fde047",
    },
    glyph: [
      "...CCCCC....",
      "..CCCCCCC...",
      "...FFFFF....",
      "...FKFKF....",
      "...FFFFF....",
      "..BBBBBBB...",
      ".BBBBBBBBL..",
      ".B.BBBBB.L..",
      "...BBBBB....",
      "...B...B....",
      "...B...B....",
      "..KK...KK...",
    ],
  },
  {
    id: "cursed-brick",
    x: 0,
    y: 6,
    tier: "odd",
    name: "The Brick That Watches",
    effect: "Upgrades cost 12% less.",
    catch: "Everything builds 5% slower.",
    apply: (run) => {
      mul(run, "costMult", 0.88);
      mul(run, "speed", 0.95);
    },
    spot: { x: 286, y: 144, scale: 1.1 },
    palette: { R: "#9f1239", r: "#4c0519", E: "#fde047" },
    glyph: [
      "............",
      "............",
      "............",
      "RRRRRRRRRRRR",
      "RrRRRRRRRRrR",
      "RRREERREERRR",
      "RRRERRRERRRR",
      "RrRRRRRRRRrR",
      "RRRRRRRRRRRR",
      "rrrrrrrrrrrr",
      "............",
      "............",
    ],
  },
  {
    id: "tower-pigeon",
    x: 3,
    y: 7,
    tier: "odd",
    name: "The Tower Pigeon",
    effect: "Everything builds 8% faster.",
    catch: "Every tap is worth 15% less.",
    apply: (run) => {
      mul(run, "speed", 1.08);
      mul(run, "tapMult", 0.85);
    },
    spot: { x: 322, y: 144, scale: 1.1 },
    palette: {
      G: "#9ca3af",
      g: "#6b7280",
      P: "#a78bfa",
      O: "#f97316",
      K: "#1b1b1b",
    },
    glyph: [
      "............",
      "....GGG.....",
      "...GKGGO....",
      "...GGGGOO...",
      "....PPG.....",
      "...GPPGGG...",
      "..GGGGGGGGg.",
      ".GGGGGGGggg.",
      "..GGGGGGg...",
      "....O..O....",
      "....O..O....",
      "............",
    ],
  },
];

export const HIGHER_MAP: MapDef = {
  cols: 8,
  rows: 8,
  title: "The Blueprint",
  rightLabel: "Next town",
  downLabel: "Inside the blueprint",
  columns: [
    { text: "" },
    {
      text: "Quiet town: everything builds 4% faster",
      apply: (r) => {
        mul(r, "speed", 1.04);
      },
    },
    {
      text: "Boom town: everything 6% faster, upgrades 6% dearer",
      apply: (r) => {
        mul(r, "speed", 1.06);
        mul(r, "costMult", 1.06);
      },
    },
    {
      text: "Windy heights: taps worth 15% more, everything 3% slower",
      apply: (r) => {
        mul(r, "tapMult", 1.15);
        mul(r, "speed", 0.97);
      },
    },
    {
      text: "Cheap timber: upgrades cost 5% less",
      apply: (r) => {
        mul(r, "costMult", 0.95);
      },
    },
    {
      text: "Foggy streets: everything 5% slower, taps worth 20% more",
      apply: (r) => {
        mul(r, "speed", 0.95);
        mul(r, "tapMult", 1.2);
      },
    },
    {
      text: "Steel city: everything 6% faster, upgrades 4% dearer",
      apply: (r) => {
        mul(r, "speed", 1.06);
        mul(r, "costMult", 1.04);
      },
    },
    {
      text: "The far town: a little extra to spend in each part",
      apply: (r) => {
        add(r, "headStart", 1);
      },
    },
  ],
  rowChanges: [
    { text: "" },
    { text: "Inside the lines: the sky turns blueprint blue" },
    {
      text: "Measured twice: taps worth 10% more",
      apply: (r) => {
        mul(r, "tapMult", 1.1);
      },
    },
    {
      text: "Impossible angles: everything 5% faster, upgrades 5% dearer",
      apply: (r) => {
        mul(r, "speed", 1.05);
        mul(r, "costMult", 1.05);
      },
    },
    {
      text: "Erased lines: upgrades cost 4% less",
      apply: (r) => {
        mul(r, "costMult", 0.96);
      },
    },
    {
      text: "The drawing looks back: everything 5% slower",
      apply: (r) => {
        mul(r, "speed", 0.95);
      },
    },
    {
      text: "The plan knows you: taps worth 20% more",
      apply: (r) => {
        mul(r, "tapMult", 1.2);
      },
    },
    {
      text: "The innermost sheet: everything 5% faster",
      apply: (r) => {
        mul(r, "speed", 1.05);
      },
    },
  ],
  artifacts: HIGHER_ARTIFACTS,
  tint: "#1d4ed8",
  keepsake: {
    name: "A Keepsake of old gold stars",
    palette: { Y: "#fde047", y: "#ca8a04" },
    glyph: [
      ".....YY.....",
      ".....YY.....",
      "....YYYY....",
      "YYYYYYYYYYYY",
      ".YYYYYYYYYY.",
      "..YYYyyYYY..",
      "...YYyyYY...",
      "...YYYYYY...",
      "..YYY..YYY..",
      "..YY....YY..",
      ".Y........Y.",
      "............",
    ],
  },
};
