import type { ArtifactDef, MapDef, RunState } from "../../engine/types";

/**
 * Keep the Light On's prestige map: a night sea chart. Right is the farther
 * coast, down is deeper into the lamp's dream. Effects only touch numbers the
 * tick already reads (`speed`, `tapMult`, `costMult`, `headStart`, `calm`,
 * `bright`) and multiply onto whatever the keepsake set.
 */

const mul = (run: RunState, mod: string, by: number) => {
  run.mods[mod] = (run.mods[mod] ?? 1) * by;
};
const add = (run: RunState, mod: string, by: number) => {
  run.mods[mod] = (run.mods[mod] ?? 0) + by;
};
/** Storm calm stays below 0.9, like the old Calm seas upgrade. */
const calm = (run: RunState, by: number) => {
  run.mods.calm = Math.min(0.9, (run.mods.calm ?? 0) + by);
};

/** Where each artifact floats in the 400 x 300 scene, and how big. */
export interface ArtifactSpot {
  x: number;
  y: number;
  scale: number;
}

type LightArtifact = ArtifactDef & { spot: ArtifactSpot };

export const LIGHT_ARTIFACTS: readonly LightArtifact[] = [
  // ------------------------------------------------------------ big
  {
    id: "brass-heart",
    x: 6,
    y: 2,
    tier: "big",
    name: "The Brass Heart",
    effect: "Everything runs 15% faster, in every part.",
    apply: (run) => mul(run, "speed", 1.15),
    spot: { x: 30, y: 24, scale: 1.6 },
    palette: { G: "#f2b84b", D: "#8a5a1c", R: "#e2435b" },
    glyph: [
      "....GGGG....",
      "..GGDGGDGG..",
      ".GDGGGGGGDG.",
      ".GGRR..RRGG.",
      "GGRRRRRRRRGG",
      "GDRRRRRRRRDG",
      "GGGRRRRRRGGG",
      ".GGGRRRRGGG.",
      ".GDGGRRGGDG.",
      "..GGDGGDGG..",
      "....GGGG....",
      "............",
    ],
  },
  {
    id: "keepers-lantern",
    x: 2,
    y: 6,
    tier: "big",
    name: "The Keeper's Lantern",
    effect:
      "Every run starts with two keepers at the lamp and a little extra to spend in each part.",
    apply: (run) => {
      run.owned.keeper = (run.owned.keeper ?? 0) + 2;
      add(run, "headStart", 10);
    },
    spot: { x: 352, y: 22, scale: 1.6 },
    palette: { K: "#3b3f5c", Y: "#ffe27a", O: "#ff9f3a" },
    glyph: [
      ".....KK.....",
      "....K..K....",
      "...KKKKKK...",
      "...KYYYYK...",
      "..KYYOOYYK..",
      "..KYOOOOYK..",
      "..KYOOOOYK..",
      "..KYYOOYYK..",
      "...KYYYYK...",
      "...KKKKKK...",
      "....KKKK....",
      "............",
    ],
  },
  {
    id: "star-chart",
    x: 5,
    y: 5,
    tier: "big",
    name: "The Star Chart",
    effect: "Everything runs 10% faster and upgrades cost 10% less.",
    apply: (run) => {
      mul(run, "speed", 1.1);
      mul(run, "costMult", 0.9);
    },
    spot: { x: 196, y: 14, scale: 1.6 },
    palette: { B: "#7a5230", P: "#e9d8a6", S: "#3f8fd8" },
    glyph: [
      "............",
      ".BPPPPPPPPB.",
      ".BPPPSPPPPB.",
      ".BPPSSSPPPB.",
      ".BPPPSPPSPB.",
      ".BPPPPPSSSB.",
      ".BPSPPPPSPB.",
      ".BPPPPPPPPB.",
      ".BPPPSPPPPB.",
      ".BPPPPPPPPB.",
      ".BBBBBBBBBB.",
      "............",
    ],
  },
  // ------------------------------------------------------------ modest
  {
    id: "gull-feather",
    x: 1,
    y: 0,
    tier: "modest",
    name: "A Gull Feather",
    effect: "Everything runs 5% faster.",
    apply: (run) => mul(run, "speed", 1.05),
    spot: { x: 76, y: 46, scale: 1.2 },
    palette: { W: "#f1f5ff", G: "#8a97b5" },
    glyph: [
      ".........WW.",
      "........WWW.",
      ".......WWGW.",
      "......WWGWW.",
      ".....WWGWW..",
      "....WWGWW...",
      "...WWGWW....",
      "..WWGWW.....",
      "...GWW......",
      "..G.........",
      ".G..........",
      "............",
    ],
  },
  {
    id: "driftwood-charm",
    x: 0,
    y: 2,
    tier: "modest",
    name: "A Driftwood Charm",
    effect: "Every tap is worth 25% more.",
    apply: (run) => mul(run, "tapMult", 1.25),
    spot: { x: 114, y: 30, scale: 1.2 },
    palette: { D: "#9c6b3f", d: "#5e3d22", B: "#59c3e8" },
    glyph: [
      "............",
      "....BB......",
      "....BB......",
      ".....d......",
      "..DDDDDDDD..",
      ".DDdDDDdDDD.",
      "..DDDDDDDD..",
      ".....d......",
      "....BBB.....",
      "....BBB.....",
      ".....B......",
      "............",
    ],
  },
  {
    id: "biscuit-tin",
    x: 2,
    y: 1,
    tier: "modest",
    name: "A Tin of Biscuits",
    effect: "Each part starts with a little extra to spend.",
    apply: (run) => add(run, "headStart", 10),
    spot: { x: 152, y: 50, scale: 1.2 },
    palette: { L: "#f2c14e", T: "#d94b4b", C: "#c98a4b" },
    glyph: [
      "............",
      "..LLLLLLLL..",
      ".LLLLLLLLLL.",
      ".TTTTTTTTTT.",
      ".TCCTTTTCCT.",
      ".TCCTLLTCCT.",
      ".TTTTLLTTTT.",
      ".TCCTTTTCCT.",
      ".TCCTTTTCCT.",
      ".TTTTTTTTTT.",
      "..TTTTTTTT..",
      "............",
    ],
  },
  {
    id: "salt-coin",
    x: 3,
    y: 3,
    tier: "modest",
    name: "A Salt-Cured Coin",
    effect: "Upgrades cost 6% less.",
    apply: (run) => mul(run, "costMult", 0.94),
    spot: { x: 236, y: 44, scale: 1.2 },
    palette: { C: "#f5c542", c: "#a8791b", W: "#ffffff" },
    glyph: [
      "....CCCC....",
      "..CCccccCC..",
      ".CcCCCCCCcC.",
      ".CcCCcCCCcC.",
      "CcCCcccCCCcC",
      "CcCCCcCCCCcC",
      "CcCCCCcCCCcC",
      "CcCCcccCCCcC",
      ".CcCCcCCCcC.",
      ".CcCCCCCCcC.",
      "..CCccccCC..",
      "....CCCC.W.W",
    ],
  },
  {
    id: "ship-bottle",
    x: 4,
    y: 1,
    tier: "modest",
    name: "A Ship in a Bottle",
    effect: "Storms are shorter and oil prices wobble less.",
    apply: (run) => calm(run, 0.3),
    spot: { x: 274, y: 26, scale: 1.2 },
    palette: {
      K: "#b07a43",
      G: "#9fe3d0",
      S: "#ffffff",
      H: "#8a5a2b",
      W: "#3b82f6",
    },
    glyph: [
      "............",
      ".....KK.....",
      ".....GG.....",
      "....G..G....",
      "...G....G...",
      "..G..S...G..",
      "..G.SSS..G..",
      "..G.SSSS.G..",
      "..GHHHHHHG..",
      "..GWWWWWWG..",
      "...GGGGGG...",
      "............",
    ],
  },
  {
    id: "warm-wick",
    x: 1,
    y: 4,
    tier: "modest",
    name: "A Warm Wick",
    effect: "In The Last Light, the lights fade more slowly.",
    apply: (run) => add(run, "bright", 1),
    spot: { x: 312, y: 48, scale: 1.2 },
    palette: { Y: "#ffd45e", O: "#ff8a3a", C: "#f3eadb", c: "#c9b99a" },
    glyph: [
      ".....Y......",
      "....YOY.....",
      "....YOY.....",
      ".....Y......",
      ".....c......",
      "....CCC.....",
      "....CCc.....",
      "....CCc.....",
      "....CCc.....",
      "....CCc.....",
      "...cccccc...",
      "............",
    ],
  },
  // ------------------------------------------------------------ odd
  {
    id: "storm-glass",
    x: 6,
    y: 0,
    tier: "odd",
    name: "The Storm Glass",
    effect: "Everything runs 12% faster.",
    catch: "Storms last longer and oil prices swing wildly.",
    apply: (run) => {
      mul(run, "speed", 1.12);
      calm(run, -0.5);
    },
    spot: { x: 56, y: 74, scale: 1.3 },
    palette: { G: "#9fc5e8", D: "#5b6b8c", Y: "#ffe14d" },
    glyph: [
      "....GGGG....",
      ".....GG.....",
      "....G..G....",
      "...GDDDDG...",
      "..GDDDDDDG..",
      "..GDDDDDDG..",
      "..G..YY..G..",
      "..G..Y...G..",
      "..G.YY...G..",
      "..G..Y...G..",
      "...GGGGGG...",
      "............",
    ],
  },
  {
    id: "cracked-lens",
    x: 0,
    y: 5,
    tier: "odd",
    name: "The Cracked Lens",
    effect: "Every tap is worth 60% more.",
    catch: "Everything else runs 8% slower.",
    apply: (run) => {
      mul(run, "tapMult", 1.6);
      mul(run, "speed", 0.92);
    },
    spot: { x: 136, y: 76, scale: 1.3 },
    palette: { R: "#cfa040", L: "#bfe7ff", K: "#222222" },
    glyph: [
      "....RRRR....",
      "..RRLLLLRR..",
      ".RLLLLKLLLR.",
      ".RLLLKLLLLR.",
      "RLLLLKKLLLLR",
      "RLLLLLKLLLLR",
      "RLLLLKLLLLLR",
      "RLLLKLLLLLLR",
      ".RLLKLLLLLR.",
      ".RLLLKLLLLR.",
      "..RRLLLLRR..",
      "....RRRR....",
    ],
  },
  {
    id: "ghost-keeper",
    x: 3,
    y: 5,
    tier: "odd",
    name: "The Ghost Keeper",
    effect:
      "Nothing at all. An old keeper walks the shore in every run now, and waves.",
    apply: () => {},
    spot: { x: 0, y: 250, scale: 1.6 },
    palette: { C: "#3b4a7a", W: "#e6ecff", w: "#9aa6cc", K: "#1b1f33" },
    glyph: [
      "....CCCC....",
      "...CCCCCC...",
      "...WWWWWW...",
      "..WWWWWWWW..",
      "..WKKWWKKW..",
      "..WKKWWKKW..",
      "..WWWWWWWW..",
      "..WWWwwWWW..",
      "..WWWWWWWW..",
      "..WWWWWWWW..",
      "..W.WW.WW.W.",
      "............",
    ],
  },
  {
    id: "black-pearl",
    x: 7,
    y: 4,
    tier: "odd",
    name: "The Black Pearl",
    effect: "Upgrades cost 12% less.",
    catch: "In The Last Light, the lights fade faster.",
    apply: (run) => {
      mul(run, "costMult", 0.88);
      add(run, "bright", -1);
    },
    spot: { x: 258, y: 78, scale: 1.3 },
    palette: { P: "#2a2440", p: "#6e5ca8", S: "#e9e4ff", O: "#d9b7a0" },
    glyph: [
      "............",
      "............",
      "....PPPP....",
      "...PPPPPP...",
      "..PPSPPPPP..",
      "..PSSPPPpP..",
      "..PPPPPPpP..",
      "..PPPPPpPP..",
      "...PPpppP...",
      ".OOOPPPPOOO.",
      "OOOOOOOOOOOO",
      ".OOOOOOOOOO.",
    ],
  },
  {
    id: "moth-jar",
    x: 4,
    y: 7,
    tier: "odd",
    name: "A Jar of Moths",
    effect: "Everything runs 8% faster.",
    catch: "Every tap is worth 15% less.",
    apply: (run) => {
      mul(run, "speed", 1.08);
      mul(run, "tapMult", 0.85);
    },
    spot: { x: 340, y: 76, scale: 1.3 },
    palette: { L: "#8c6b3e", G: "#b9d8c9", M: "#e6d2a0", m: "#a08350" },
    glyph: [
      "..LLLLLLLL..",
      "..LLLLLLLL..",
      "...G....G...",
      "..G......G..",
      "..G.M..M.G..",
      "..G.MMMM.G..",
      "..G.mMMm.G..",
      "..G..MM..G..",
      "..G......G..",
      "..G......G..",
      "...GGGGGG...",
      "............",
    ],
  },
];

/** Scene spot of an artifact id (the scene draws them). */
export const ARTIFACT_SPOTS: Readonly<Record<string, ArtifactSpot>> =
  Object.fromEntries(LIGHT_ARTIFACTS.map((a) => [a.id, a.spot]));

export const LIGHT_MAP: MapDef = {
  cols: 8,
  rows: 8,
  title: "The Sea Chart",
  rightLabel: "Farther coast",
  downLabel: "Deeper dream",
  columns: [
    { text: "" },
    { text: "Calmer seas: storms are shorter", apply: (r) => calm(r, 0.2) },
    {
      text: "Busy harbour: everything 6% faster, upgrades 6% dearer",
      apply: (r) => {
        mul(r, "speed", 1.06);
        mul(r, "costMult", 1.06);
      },
    },
    {
      text: "Strong winds: taps worth 15% more, storms last longer",
      apply: (r) => {
        mul(r, "tapMult", 1.15);
        calm(r, -0.2);
      },
    },
    {
      text: "Thrifty town: upgrades cost 5% less",
      apply: (r) => mul(r, "costMult", 0.95),
    },
    {
      text: "Fog bank: everything 5% slower, taps worth 20% more",
      apply: (r) => {
        mul(r, "speed", 0.95);
        mul(r, "tapMult", 1.2);
      },
    },
    {
      text: "Rich coast: everything 5% faster, rougher seas",
      apply: (r) => {
        mul(r, "speed", 1.05);
        calm(r, -0.3);
      },
    },
    {
      text: "The far coast: a little extra to spend in each part",
      apply: (r) => add(r, "headStart", 10),
    },
  ],
  rowChanges: [
    { text: "" },
    { text: "A dream: the sky turns strange" },
    {
      text: "The lamp remembers: taps worth 10% more",
      apply: (r) => mul(r, "tapMult", 1.1),
    },
    {
      text: "Dream logic: everything 5% faster, upgrades 5% dearer",
      apply: (r) => {
        mul(r, "speed", 1.05);
        mul(r, "costMult", 1.05);
      },
    },
    { text: "Strange tides: storms are shorter", apply: (r) => calm(r, 0.2) },
    {
      text: "Something watches: everything 5% slower",
      apply: (r) => mul(r, "speed", 0.95),
    },
    {
      text: "The lamp dreams of you: taps worth 20% more",
      apply: (r) => mul(r, "tapMult", 1.2),
    },
    {
      text: "The deepest dream: everything 5% faster",
      apply: (r) => mul(r, "speed", 1.05),
    },
  ],
  artifacts: LIGHT_ARTIFACTS,
  keepsake: {
    name: "A Keepsake of old embers",
    palette: { C: "#c9a14a", R: "#e2435b", O: "#ff9f3a", Y: "#ffe27a" },
    glyph: [
      ".....CC.....",
      "....C..C....",
      ".....CC.....",
      "....RRRR....",
      "...RROORR...",
      "..RROOOORR..",
      "..ROOYYOOR..",
      "..ROOYYOOR..",
      "..RROOOORR..",
      "...RROORR...",
      "....RRRR....",
      "............",
    ],
  },
};
