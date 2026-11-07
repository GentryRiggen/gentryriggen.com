import { add, helpers, mul } from "../../engine/mapKit";
import type { ArtifactDef, MapDef } from "../../engine/types";

/** Make Everyone Smile's prestige map: the Crayon Map. Right is the next street, down is deeper inside the smile (and stranger). Effects only touch numbers the tick already reads (`speed`, `tapMult`, `costMult`, `headStart`) and starting helpers. */
export const SMILE_ARTIFACTS: readonly ArtifactDef[] = [
  {
    id: "golden-balloon",
    x: 3,
    y: 1,
    tier: "big",
    name: "The Golden Balloon",
    effect: "Everything cheers up 15% faster, in every part.",
    apply: (run) => mul(run, "speed", 1.15),
    spot: { x: 14, y: 118, scale: 1.5 },
    palette: { Y: "#fde047", y: "#ca8a04", W: "#fffbe6", S: "#e5e7eb" },
    glyph: [
      "...YYYYY....",
      "..YYYYYYY...",
      ".YYWYYYYYY..",
      ".YWYYYYYYy..",
      ".YYYYYYYYy..",
      ".YYYYYYYyy..",
      "..YYYYYyy...",
      "...YYyyy....",
      ".....yy.....",
      ".....S......",
      "......S.....",
      ".....S......",
    ],
  },
  {
    id: "puppy-pack",
    x: 1,
    y: 5,
    tier: "big",
    name: "The Puppy Pack",
    effect:
      "Every run starts with a puppy already wagging and a little extra to spend in each part.",
    apply: (run) => {
      helpers(run, "puppy", 1, 1);
      add(run, "headStart", 1);
    },
    spot: { x: 368, y: 118, scale: 1.5 },
    palette: { B: "#c08457", b: "#7a4a24", K: "#1b1b1b", P: "#f472b6" },
    glyph: [
      "............",
      ".bb......bb.",
      "bbbBBBBBBbbb",
      "bbBBBBBBBBbb",
      ".bBKBBBBKBb.",
      "..BBBBBBBB..",
      "..BBBKKBBB..",
      "..BBBBBBBB..",
      "...BBPPBB...",
      "....BPPB....",
      "............",
      "............",
    ],
  },
  {
    id: "friendship-book",
    x: 2,
    y: 2,
    tier: "big",
    name: "The Friendship Book",
    effect: "Everything cheers up 10% faster and upgrades cost 10% less.",
    apply: (run) => {
      mul(run, "speed", 1.1);
      mul(run, "costMult", 0.9);
    },
    spot: { x: 44, y: 118, scale: 1.5 },
    palette: { R: "#f472b6", r: "#be185d", P: "#fff1f2", H: "#e11d48" },
    glyph: [
      "............",
      ".RRRRRRRRR..",
      ".RPPPPPPPR..",
      ".RPHHPHHPR..",
      ".RPHHHHHPR..",
      ".RPPHHHPPR..",
      ".RPPPHPPPR..",
      ".RPPPPPPPR..",
      ".RRRRRRRRR..",
      ".rPPPPPPPPr.",
      "..rrrrrrrrr.",
      "............",
    ],
  },
  {
    id: "smiley-sticker",
    x: 0,
    y: 1,
    tier: "modest",
    name: "A Smiley Sticker",
    effect: "Everything cheers up 8% faster.",
    apply: (run) => mul(run, "speed", 1.08),
    spot: { x: 160, y: 124, scale: 1.1 },
    palette: { Y: "#fde047", K: "#1b1b1b" },
    glyph: [
      "....YYYY....",
      "..YYYYYYYY..",
      ".YYYYYYYYYY.",
      ".YYKYYYYKYY.",
      "YYYKYYYYKYYY",
      "YYYYYYYYYYYY",
      "YYKYYYYYYKYY",
      "YYYKYYYYKYYY",
      ".YYYKKKKYYY.",
      ".YYYYYYYYYY.",
      "..YYYYYYYY..",
      "....YYYY....",
    ],
  },
  {
    id: "foam-hand",
    x: 5,
    y: 7,
    tier: "modest",
    name: "A Big Foam Hand",
    effect: "Every tap is worth 25% more.",
    apply: (run) => mul(run, "tapMult", 1.25),
    spot: { x: 196, y: 124, scale: 1.1 },
    palette: { F: "#3b82f6", f: "#1d4ed8", W: "#ffffff" },
    glyph: [
      ".....FF.....",
      ".....FF.....",
      ".....FF.....",
      ".....FF.....",
      "..F..FF.....",
      "..FFFFFFFF..",
      "..FFFFFFFF..",
      ".FFFFFFFFF..",
      "..FFFFFFFf..",
      "...FFFFFf...",
      "...ffffff...",
      "...WWWWWW...",
    ],
  },
  {
    id: "party-hat",
    x: 6,
    y: 5,
    tier: "modest",
    name: "A Spare Party Hat",
    effect: "Each part starts with a little extra to spend.",
    apply: (run) => add(run, "headStart", 1),
    spot: { x: 232, y: 124, scale: 1.1 },
    palette: { P: "#a855f7", Y: "#fde047" },
    glyph: [
      ".....YY.....",
      ".....PP.....",
      "....PPPP....",
      "....PYPP....",
      "...PPPPPP...",
      "...PPPYPP...",
      "..PPYPPPPP..",
      "..PPPPPYPP..",
      ".PPPYPPPPPP.",
      ".PPPPPPYPPP.",
      "YYYYYYYYYYYY",
      "............",
    ],
  },
  {
    id: "lucky-button",
    x: 4,
    y: 4,
    tier: "modest",
    name: "A Lucky Button",
    effect: "Upgrades cost 6% less.",
    apply: (run) => mul(run, "costMult", 0.94),
    spot: { x: 268, y: 124, scale: 1.1 },
    palette: { B: "#f97316", b: "#9a3412", H: "#1b1b1b" },
    glyph: [
      "....BBBB....",
      "..BBbbbbBB..",
      ".BbBBBBBBbB.",
      ".BbBBBBBBbB.",
      "BbBBHBBHBBbB",
      "BbBBBBBBBBbB",
      "BbBBBBBBBBbB",
      "BbBBHBBHBBbB",
      ".BbBBBBBBbB.",
      ".BbBBBBBBbB.",
      "..BBbbbbBB..",
      "....BBBB....",
    ],
  },
  {
    id: "kazoo",
    x: 2,
    y: 0,
    tier: "modest",
    name: "A Kazoo",
    effect: "Every tap is worth 15% more.",
    apply: (run) => mul(run, "tapMult", 1.15),
    spot: { x: 304, y: 124, scale: 1.1 },
    palette: { K: "#ef4444", k: "#991b1b", W: "#fde047" },
    glyph: [
      "............",
      "............",
      "............",
      "..........W.",
      "KKKKKKKKKK.W",
      "KkkkKKkkkKKW",
      "KKKKKKKKKK.W",
      "....KK....W.",
      "............",
      "............",
      "............",
      "............",
    ],
  },
  {
    id: "daisy-chain",
    x: 3,
    y: 6,
    tier: "modest",
    name: "A Daisy Chain",
    effect: "Upgrades cost 4% less.",
    apply: (run) => mul(run, "costMult", 0.96),
    spot: { x: 178, y: 144, scale: 1.1 },
    palette: { W: "#ffffff", Y: "#facc15", G: "#22c55e" },
    glyph: [
      "............",
      ".WWW....WWW.",
      "WWYWW..WWYWW",
      ".WWW....WWW.",
      "..G......G..",
      "...G....G...",
      "....GGGG....",
      ".....WWW....",
      "....WWYWW...",
      ".....WWW....",
      "............",
      "............",
    ],
  },
  {
    id: "painted-smile",
    x: 7,
    y: 1,
    tier: "odd",
    name: "The Painted Smile",
    effect: "Everything cheers up 12% faster.",
    catch: "Upgrades cost 8% more. And everyone smiles a little too wide.",
    apply: (run) => {
      mul(run, "speed", 1.12);
      mul(run, "costMult", 1.08);
    },
    spot: { x: 214, y: 144, scale: 1.1 },
    palette: { F: "#fef3c7", K: "#1b1b1b", R: "#dc2626" },
    glyph: [
      "..FFFFFFFF..",
      ".FFFFFFFFFF.",
      "FFKKFFFFKKFF",
      "FFKKFFFFKKFF",
      "FFFFFFFFFFFF",
      "FFFFFFFFFFFF",
      "FRFFFFFFFFRF",
      "FRRFFFFFFRRF",
      "FFRRRRRRRRFF",
      ".FFRRRRRRFF.",
      "..FFFFFFFF..",
      "............",
    ],
  },
  {
    id: "whoopee-cushion",
    x: 0,
    y: 4,
    tier: "odd",
    name: "The Whoopee Cushion",
    effect: "Every tap is worth 60% more.",
    catch: "Everything else cheers up 8% slower.",
    apply: (run) => {
      mul(run, "tapMult", 1.6);
      mul(run, "speed", 0.92);
    },
    spot: { x: 250, y: 144, scale: 1.1 },
    palette: { P: "#f472b6", p: "#be185d" },
    glyph: [
      "............",
      "............",
      "............",
      "...PPPPPP...",
      ".PPPPPPPPPP.",
      "PPPPPPPPPPPP",
      "PPPPPPPPPPPP",
      ".PPPPPPPPPpp",
      "...PPPPPP.pp",
      "...........p",
      "............",
      "............",
    ],
  },
  {
    id: "following-clown",
    x: 2,
    y: 4,
    tier: "odd",
    name: "The Clown Who Follows",
    effect:
      "Nothing at all. A clown walks through every run now. It waves. It keeps waving.",
    apply: () => {},
    spot: { x: 0, y: 236, scale: 1.6, walk: true },
    palette: {
      W: "#ffffff",
      R: "#ef4444",
      K: "#1b1b1b",
      B: "#3b82f6",
      Y: "#facc15",
    },
    glyph: [
      "..YY....YY..",
      ".YYYWWWWYYY.",
      "..YWWWWWWY..",
      "...WKWWKW...",
      "...WWRRWW...",
      "...WRWWRW...",
      "....WRRW....",
      "..BBBBBBBB..",
      ".BBYBBBBYBB.",
      "..BBBBBBBB..",
      "...B....B...",
      "..RR....RR..",
    ],
  },
  {
    id: "hand-mirror",
    x: 6,
    y: 0,
    tier: "odd",
    name: "The Hand Mirror",
    effect: "Upgrades cost 12% less.",
    catch: "Everything cheers up 5% slower.",
    apply: (run) => {
      mul(run, "costMult", 0.88);
      mul(run, "speed", 0.95);
    },
    spot: { x: 286, y: 144, scale: 1.1 },
    palette: { F: "#c9a14a", M: "#9ec5e8", W: "#e0f2fe" },
    glyph: [
      "...FFFFFF...",
      "..FMMMMMMF..",
      ".FMWMMMMMMF.",
      ".FMMWMMMMMF.",
      ".FMMMMMMMMF.",
      ".FMMMMMMMMF.",
      ".FMMMMMMMMF.",
      "..FMMMMMMF..",
      "...FFFFFF...",
      ".....FF.....",
      "....FFFF....",
      "............",
    ],
  },
  {
    id: "music-box",
    x: 7,
    y: 3,
    tier: "odd",
    name: "The Music Box",
    effect: "Everything cheers up 8% faster.",
    catch: "Every tap is worth 15% less.",
    apply: (run) => {
      mul(run, "speed", 1.08);
      mul(run, "tapMult", 0.85);
    },
    spot: { x: 322, y: 144, scale: 1.1 },
    palette: { B: "#8b5cf6", b: "#5b21b6", Y: "#fde047", K: "#c9a14a" },
    glyph: [
      "............",
      "............",
      "..BBBBBBBB..",
      "..BYYYYYYB..",
      "..BBBBBBBB..",
      "..BbbbbbbB..",
      "..BbYbbYbBKK",
      "..BbbbbbbB.K",
      "..BBBBBBBB..",
      "............",
      "............",
      "............",
    ],
  },
];

export const SMILE_MAP: MapDef = {
  cols: 8,
  rows: 8,
  title: "The Crayon Map",
  rightLabel: "Next street",
  downLabel: "Inside the smile",
  columns: [
    { text: "" },
    {
      text: "Quiet street: everything cheers up 4% faster",
      apply: (r) => {
        mul(r, "speed", 1.04);
      },
    },
    {
      text: "Party street: everything 6% faster, upgrades 6% dearer",
      apply: (r) => {
        mul(r, "speed", 1.06);
        mul(r, "costMult", 1.06);
      },
    },
    {
      text: "Windy park: taps worth 15% more, everything 3% slower",
      apply: (r) => {
        mul(r, "tapMult", 1.15);
        mul(r, "speed", 0.97);
      },
    },
    {
      text: "Bargain street: upgrades cost 5% less",
      apply: (r) => {
        mul(r, "costMult", 0.95);
      },
    },
    {
      text: "Rainy street: everything 5% slower, taps worth 20% more",
      apply: (r) => {
        mul(r, "speed", 0.95);
        mul(r, "tapMult", 1.2);
      },
    },
    {
      text: "Fair day: everything 6% faster, upgrades 4% dearer",
      apply: (r) => {
        mul(r, "speed", 1.06);
        mul(r, "costMult", 1.04);
      },
    },
    {
      text: "The far street: a little extra to spend in each part",
      apply: (r) => {
        add(r, "headStart", 1);
      },
    },
  ],
  rowChanges: [
    { text: "" },
    { text: "Behind the smile: the sky turns pink" },
    {
      text: "Practised grins: taps worth 10% more",
      apply: (r) => {
        mul(r, "tapMult", 1.1);
      },
    },
    {
      text: "Everyone agrees: everything 5% faster, upgrades 5% dearer",
      apply: (r) => {
        mul(r, "speed", 1.05);
        mul(r, "costMult", 1.05);
      },
    },
    {
      text: "Bargains with a wink: upgrades cost 4% less",
      apply: (r) => {
        mul(r, "costMult", 0.96);
      },
    },
    {
      text: "The smiles don't blink: everything 5% slower",
      apply: (r) => {
        mul(r, "speed", 0.95);
      },
    },
    {
      text: "They smile at you: taps worth 20% more",
      apply: (r) => {
        mul(r, "tapMult", 1.2);
      },
    },
    {
      text: "The smile within the smile: everything 5% faster",
      apply: (r) => {
        mul(r, "speed", 1.05);
      },
    },
  ],
  artifacts: SMILE_ARTIFACTS,
  tint: "#be185d",
  keepsake: {
    name: "A Keepsake of old stickers",
    palette: { Y: "#f472b6", y: "#be185d" },
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
