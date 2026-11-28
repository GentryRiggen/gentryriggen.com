import { TITANIC_BOATS } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { createHullSurface, type HullSurface } from "./hullSurface";

/**
 * The Titanic's details, from her particulars and the builder's profile
 * plans: where every house, window, boat, funnel fitting, mast and wire
 * goes. Pure data and placement maths (no three.js), so it can be tested;
 * `buildShip.ts` turns it into geometry.
 *
 * Everything is in the ship frame: metres, x forward, y to port, z up from
 * the keel at midships. Decks follow the sheer: a deck's height at x is its
 * height amidships plus the C deck's rise there.
 */

export type V3 = [number, number, number];

const FT = 0.3048;

/** A cheap deterministic hash of two integers into [0, 1). */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A light: a porthole or a window, lit from inside at night. */
export interface LightSpot {
  kind: "porthole" | "window";
  /** Centre, on the surface (ship frame). */
  p: V3;
  /** Outward unit normal of the surface. */
  n: V3;
  w: number;
  h: number;
  /** Index into `spec.decks` (0 Boat … 9 Tank top). */
  deck: number;
  /** In [0, 1): picks the bulb's warmth, brightness and whether it is on. */
  seed: number;
  /** Swung open (a porthole the sim floods through): a dark hole, no glass. */
  open?: boolean;
  /**
   * Stays lit on her emergency power after the blackout (the Concordia's
   * sparse pattern, which the scene reads); missing: dark then.
   */
  emergency?: true;
}

/** A box-shaped deck house: x and y extents, standing on z0. */
export interface House {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Height of its floor at x0 and x1 (decks follow the sheer). */
  z0: number;
  z1: number;
  h: number;
  /** Roof: grey painted canvas, or a raised skylight with a pitched top. */
  roof: "flat" | "skylight";
  /** Walls this colour (default white). */
  wallColor?: number;
  /** Walls in the dazzle paint (the recipe's `paint.dazzle`). */
  dazzle?: boolean;
}

export interface Dome {
  x: number;
  z: number;
  /** Half-length, half-width and height of the glass dome. */
  a: number;
  b: number;
  c: number;
  /** Hidden while walking on her (as `Block.walkHidden`). */
  walkHidden?: true;
}

export interface FunnelRecipe {
  index: number;
  x: number;
  baseZ: number;
  topZ: number;
  dummy: boolean;
  /** Half-axes of the ellipse: fore and aft, athwartships. */
  semiA: number;
  semiB: number;
  /** Lean aft, radians. */
  rake: number;
  /** Height of the black top, m. */
  blackTop: number;
  /** Thin black bands (the guy-wire bands), fractions of the height. */
  bands: number[];
  /** Steam and waste pipes up the forward face: athwart offset, radius. */
  pipes: { y: number; r: number }[];
  hasWhistle: boolean;
  /**
   * Wide bands of colour over the funnel's own (fractions of its height
   * from its foot; the Fitzgerald's buff band). None by default.
   */
  stripes?: { from: number; to: number; color: number }[];
  /**
   * The fleet's mark on both sides: a five-pointed star with a letter
   * ("C") on it, centred at `z` (a fraction of the height), `r` m from its
   * middle to a point.
   */
  emblem?: {
    z: number;
    r: number;
    star: number;
    letter: number;
    /** Only the letter, thick, `r` m across its middle (Costa's "C"). */
    letterOnly?: true;
    /** In her real paint only: a fun paint leaves it off. */
    realOnly?: true;
  };
  /**
   * The top's size as a share of the foot's (the Poseidon's tapering
   * funnel); default 1 (straight).
   */
  taper?: number;
  /**
   * A wing-like fin either side of the top (the Poseidon's): `span` m out
   * from the funnel's side, `chord` m fore and aft, `thick` m deep, in the
   * top's colour.
   */
  wing?: { span: number; chord: number; thick: number };
  /**
   * A wavy stripe round the funnel (the Poseidon's gold wave): its middle
   * at fraction `z` of the height, `height` m tall, swinging `amp` m up and
   * down; `realOnly`: her real paint only.
   */
  wave?: {
    z: number;
    height: number;
    amp: number;
    color: number;
    realOnly?: true;
  };
}

export interface MastRecipe {
  /** Fore and main; the Carpathia's four add the mizzen and jigger. */
  id: "fore" | "main" | "mizzen" | "jigger";
  x: number;
  baseZ: number;
  topZ: number;
  r0: number;
  r1: number;
  rake: number;
  crowsNest?: { z: number; r: number; h: number };
  /** The spreader across the top for a wireless aerial (default true). */
  yard?: boolean;
}

export type BoatKind = "lifeboat" | "cutter" | "collapsible";

export interface BoatRecipe {
  /** 0..19, the order of `TITANIC_BOATS` (and of the sim's boat events). */
  index: number;
  label: string;
  kind: BoatKind;
  /** "centre": a raft on the centre line (the Fitzgerald's after raft). */
  side: "port" | "starboard" | "centre";
  /** Keel centre when stowed. */
  x: number;
  y: number;
  z: number;
  length: number;
  beam: number;
  depth: number;
  /** Whether it hangs from its own pair of davits. */
  hasDavits: boolean;
  /** Outboard y of the davits' feet (the deck edge). */
  edgeY: number;
  /** The boat deck's height at the boat. */
  deckZ: number;
  /**
   * Wrecked by a torpedo in the real run at this shown time (the
   * Carpathia's port 8 and 10: `CarpathiaBoat.wreckedAtT`); the scene hides
   * it from its hit. Missing: never.
   */
  wreckedAtT?: number;
  /** Stowed in this gantry set (`ShipRecipe.gantries` index), not davits. */
  gantry?: number;
  /**
   * Stowed in a recess in her side (the cruise kit's `recessBoats`), its
   * deck inboard of it: a walker gets in from its inboard side.
   */
  recess?: true;
}

/**
 * The ship-frame y of a boat's middle swung out over the side on its
 * davits (+ to port): just clear of the deck edge.
 */
export function swungOutY(
  b: Pick<BoatRecipe, "side" | "edgeY" | "beam">
): number {
  const s = b.side === "port" ? 1 : -1;
  return s * (Math.abs(b.edgeY) + 0.35 + b.beam / 2 + 0.7);
}

export interface DavitRecipe {
  boat: number;
  x: number;
  /** Foot at the deck edge; the arm curves inboard over the boat. */
  footY: number;
  headY: number;
  z: number;
}

export interface Placement {
  p: V3;
  /** Turn about z, radians (0: facing forward). */
  yaw: number;
  scale: number;
}

export interface Hatch {
  x0: number;
  x1: number;
  hw: number;
  z: number;
  h: number;
  /** Painted this colour (default the Titanic's tarpaulins). */
  color?: number;
  /**
   * A steel cover on a coaming (the Fitzgerald's): the coaming rises from
   * the deck at side to `z`, `hx` and `hw` its half-sizes; both are cut by
   * the tear like the deck. Without it the hatch is one box.
   */
  coaming?: { hx: number; hw: number; color: number };
}

export interface RailRun {
  /** The rail's foot along the deck edge, in order. */
  points: V3[];
  /** The wires' colour (default the white rails). */
  color?: number;
}

export type WireKind = "rig" | "aerial";
export interface Wire {
  a: V3;
  b: V3;
  kind: WireKind;
}

export interface Propeller {
  hub: V3;
  radius: number;
  blades: number;
  /** Turn of the blades about the shaft, radians. */
  phase: number;
}

export interface NameBoard {
  where: "bow" | "stern";
  /** Centre of the lettering. */
  x: number;
  z: number;
  side: "port" | "starboard" | "aft";
  width: number;
  height: number;
  /**
   * Rows of the board up its height (default 1: its two edges); more on a
   * counter that curves in height, so the letters follow it.
   */
  rows?: number;
}

export interface ShipLayout {
  sternX: number;
  stemX: number;
  /** After end of the forecastle, forward end of the poop. */
  forecastleFrom: number;
  poopTo: number;
  /** The bridge deck (B), 550 ft, between the wells. */
  bridgeDeckFrom: number;
  bridgeDeckTo: number;
  /** The boat and A decks, 500 ft aft from the navigating bridge. */
  boatDeckFrom: number;
  boatDeckTo: number;
  /** The A deck promenade is enclosed (windows) from here forward. */
  promenadeEnclosedFrom: number;
  /** Inset of the A deck house walls from the ship's side. */
  aHouseInset: number;
  loadWaterline: number;
  bootTop: number;
}

/**
 * A ship's paint, where it differs from the Titanic's (sRGB hex). A recipe
 * without one is painted as the Titanic: buff funnels with black tops, the
 * gilt line, "TITANIC".
 */
export interface ShipPaint {
  funnel: number;
  /** The top and the thin bands. */
  funnelTop: number;
  /** The line just under the sheer (a gilt or gold band), or null. */
  sheerLine: number | null;
  /** The name on the bows and the counter (with "LIVERPOOL" there). */
  name: string;
  /** Masts and derricks (default the Titanic's varnished brown). */
  mast?: number;
  /** The inside of the cowl ventilators' mouths (default near black). */
  ventLining?: number;
  /** The port of registry on the counter (default "LIVERPOOL"). */
  port?: string;
  /**
   * The names' lettering (default gilt serif): painted letters, one colour
   * on the bows and another on the counter.
   */
  letters?: {
    bow: number;
    stern: number;
    font: "serif" | "sans";
    /** "heavy": big black-weight capitals, condensed to fit the board. */
    weight?: "heavy";
  };
  /**
   * The hull's colours where they are not the liners' black topsides over
   * red antifouling: `topsides` to the sheer, `bottom` below the paint line,
   * and how strongly the plating's seams show (default 1; a welded hull
   * less).
   */
  hull?: { topsides: number; bottom: number; relief?: number; boot?: number };
  /** Lifeboats: topsides and bottom (default white, varnished gunwale). */
  boat?: { hull: number; bottom: number; cover?: number };
  /**
   * Dazzle camouflage (the Carpathia's 1918 paint): the hull's topsides and
   * every wall marked `dazzle` drawn from one dazzle texture.
   */
  dazzle?: boolean;
  /**
   * Davits, the masts' collars and crow's nests, cranes (default white),
   * and the cowl ventilators' outsides (default white).
   */
  fittings?: number;
  vent?: number;
  /** A band along the topsides broken by crosses (a hospital ship's). */
  band?: HullBand;
}

/**
 * A hospital ship's band along both sides from stem to stern, broken by
 * crosses (painted in the hull's shader; `bandPaintAt` in
 * `britannicRecipe.ts` is the same rule in code).
 */
export interface HullBand {
  color: number;
  crossColor: number;
  /** The band's middle amidships (x = 0), m above the keel. */
  z: number;
  /** How much of the sheer's rise it follows (1: parallel to the deck). */
  follow: number;
  height: number;
  /** Each cross's x (the same on both sides). */
  crosses: number[];
  /** Arm tip to arm tip, an arm's width, and the band's gap round it. */
  crossSize: number;
  crossArm: number;
  gap: number;
}

/**
 * A set of gantry davits (the Britannic's): two lattice arms standing on
 * pedestals at the deck edge, leaning inboard over the boats stowed in
 * the bay between them, their heads joined by a spar.
 */
export interface GantryRecipe {
  /** The middle of the bay, and the x of each arm. */
  x: number;
  arms: [number, number];
  side: "port" | "starboard";
  /** The pedestals' y (the deck edge) and the boat deck's height there. */
  footY: number;
  deckZ: number;
  /** Height of the arms' heads over the deck, and how far inboard. */
  height: number;
  reach: number;
  color: number;
}

/**
 * A length of superstructure, flush with the side or set in from it, that
 * follows the sheer: the Lusitania's tiers (the Titanic's are built by
 * hand in `buildShip.ts`).
 */
export interface Block {
  id: string;
  x0: number;
  x1: number;
  /** Floor: this deck's height (it follows the sheer) plus `dz`. */
  deck: string;
  dz?: number;
  h: number;
  /** Side walls this far in from the deck edge (default 0). */
  inset?: number;
  /** Or at this fixed half-width. */
  halfWidth?: number;
  /** Only a strip this wide inboard of each side wall (a bulwark). */
  strip?: number;
  /** The forward end rounded in plan over this length, m. */
  roundFwd?: number;
  /** plating: the hull's own black plates; shade: a wall in a promenade. */
  wall: "white" | "plating" | "shade";
  /** Paint the walls this colour instead (not for "plating"). */
  wallColor?: number;
  /** Walls in the dazzle paint (the recipe's `paint.dazzle`). */
  dazzle?: boolean;
  roof: "pine" | "pitch" | "paint" | "skylight" | "none";
  /** A painted roof's colour (default the grey canvas). */
  roofColor?: number;
  /** A painted roof rises this much higher on the centre line (camber). */
  camber?: number;
  /** Draw the underside (a deck seen from below). */
  under?: boolean;
  /** Close the ends (default true). */
  ends?: boolean;
  /**
   * Hidden while walking on her (its own mesh, "walk-hidden"): the room
   * kit draws what is there instead (the Concordia's pool hall). A deck
   * roof ("pine", "pitch") stays in the decks list.
   */
  walkHidden?: true;
  /**
   * A painted roof's cells whose middle lies in this box (x0..x1, |y| under
   * halfWidth) hidden while walking on her (in "walk-hidden"): the room
   * kit's floor is over them, and its pool's basin goes down through them.
   */
  walkHiddenRoof?: { x0: number; x1: number; halfWidth: number };
}

/** A painted box: stanchions, the bridge wings, a breakwater, derricks. */
export interface BoxPart {
  c: V3;
  size: V3;
  color: number;
  yaw?: number;
  pitch?: number;
}

export interface ShipRecipe {
  spec: ShipSpec;
  hull: HullSurface;
  layout: ShipLayout;
  deckIndex(name: string): number;
  deckZ(name: string, x: number): number;
  houses: House[];
  domes: Dome[];
  funnels: FunnelRecipe[];
  masts: MastRecipe[];
  boats: BoatRecipe[];
  davits: DavitRecipe[];
  lights: LightSpot[];
  vents: Placement[];
  benches: Placement[];
  bollards: Placement[];
  capstans: Placement[];
  cranes: Placement[];
  hatches: Hatch[];
  rails: RailRun[];
  wires: Wire[];
  /** Guy wires of each funnel (index as `funnels`). */
  funnelGuys: Wire[][];
  propellers: Propeller[];
  /** The rudder's outline in (x, z), and its thickness. */
  rudder: {
    outline: [number, number][];
    thickness: number;
    /** Inside the blade, for which half holds it (default the Titanic's). */
    centre?: V3;
    /** Stock and heel boxes (default the Titanic's post and sole piece). */
    posts?: { c: V3; size: V3 }[];
    /** Thickness at the leading and trailing edges (default `thickness`). */
    taper?: { lead: number; trail: number };
    /** A round stock up the leading edge, faired into the blade. */
    stock?: { x: number; z0: number; z1: number; r: number };
    /**
     * One rudder at each of these y (twin rudders behind twin screws, the
     * Concordia's); default one on the centre line.
     */
    ys?: number[];
  };
  /** Shaft bossings: from inside the hull aft to the wing propellers. */
  bossings: { from: V3; to: V3; r0: number; r1: number }[];
  /**
   * Anchors in their recesses; with `pocket` (w × h, m), a laker's square
   * pocket centred on `p` with the anchor housed inside it.
   */
  anchors: {
    p: V3;
    side: "port" | "starboard";
    pocket?: { w: number; h: number };
    /**
     * A stockless anchor drawn in full, `size` m from the hawse pipe's lip
     * at `p` to the crown (the Carpathia's, the Britannic's): the lip with
     * its dark mouth, the shank, the crown and two flukes with their palms,
     * no dark recess round it. Without it, the Titanic's.
     */
    stockless?: { size: number };
  }[];
  names: NameBoard[];
  // Optional: a recipe without them is built as the Titanic.
  paint?: ShipPaint;
  /** Superstructure tiers; when given, they replace the Titanic's. */
  blocks?: Block[];
  boxes?: BoxPart[];
  /**
   * Painted boxes that only some liveries carry (the Carpathia's 1918
   * stern gun): their own small list (`ShipPartData.variant`), so a livery
   * without them hides its mesh instead of rebuilding the paint list.
   */
  variantBoxes?: BoxPart[];
  /** Drum ("oil-drum") ventilators, flat-topped. */
  drums?: Placement[];
  /** Decks torn open at a break (default the Titanic's C to Orlop). */
  ledgeDecks?: string[];
  /** Jack and ensign staffs (default on B deck at the stem and stern). */
  staffs?: { foot: V3; top: V3 }[];
  /**
   * Height the line under the sheer is painted from at x (default the
   * sheer); far above the hull where the line stops.
   */
  sheerLineZ?: (x: number) => number;
  /**
   * Bells (bronze), each hung with its mouth at `p`, `r` its mouth's
   * radius, from a yoke on two posts standing at `footZ`.
   */
  bells?: { p: V3; r: number; footZ: number }[];
  /** Gantry davit sets (the Britannic's). */
  gantries?: GantryRecipe[];
  /**
   * Where the bow bends on a hard landing (R12): everything forward of `x`
   * is built in its own group, hinged about the line across the ship at
   * height `z` (`bowBend.ts`).
   */
  hinge?: { x: number; z: number };
  // A cruise ship's parts (the Concordia's).
  /** Water slides: a tube along `points` (painted). */
  slides?: { points: V3[]; r: number; color: number }[];
  /** Radar domes: a white ball of radius `r` centred at `p`, on a cone. */
  radomes?: { p: V3; r: number }[];
  /** Liferaft canisters lying fore and aft, centred at `c`. */
  canisters?: { c: V3; r: number; len: number }[];
  /**
   * A bulbous bow drawn on the hull (the model only: the sim's offsets
   * stay as they are): an ellipsoid centred at (x, 0, z), half-length
   * `a`, half-breadth `b`, half-height `c`, in the hull's paint.
   */
  bulb?: { x: number; z: number; a: number; b: number; c: number };
  /**
   * A round room under a glass dome (the Poseidon's ballroom): a drum of
   * tall windows between piers, `radius` m, `drumH` tall from `z`, under a
   * lat-long glass dome `domeH` high of `rows` × `cols` panes, ribbed along
   * every meridian and parallel (ribs dropped at low quality).
   */
  ballrooms?: {
    x: number;
    z: number;
    radius: number;
    drumH: number;
    domeH: number;
    rows: number;
    cols: number;
    glass: number;
    rib: number;
    drum: number;
  }[];
  /** Thruster tunnels through the hull: dark discs on both sides. */
  thrusters?: { x: number; z: number; r: number }[];
  /**
   * The rock torn off by the strike and stuck in her side (R21): centre
   * and size, shown by the scene from `fromT` (s after the strike) in a
   * run that opens `compartmentId` (where it stuck).
   */
  rock?: { p: V3; r: number; fromT: number; compartmentId: string };
}

const TO_RAD = Math.PI / 180;

/** The Titanic's detail recipe. Build once per spec (it samples the hull). */
export function titanicRecipe(spec: ShipSpec): ShipRecipe {
  // The poop runs nearly full width to a broad elliptical counter (the
  // offsets narrow from the engine room aft, which is right below the
  // water but too pointed above it).
  const hull = createHullSurface(spec, {
    fromX: -62,
    halfBreadth: spec.beam / 2,
    exponent: 2.6,
    zFrom: 11.2,
    zTo: 16,
  });
  const halfLbp = spec.lbp / 2;
  const deckByName = new Map(spec.decks.map((d, i) => [d.name, i]));
  const deckIndex = (name: string): number => {
    const i = deckByName.get(name);
    if (i === undefined) throw new Error(`no deck ${name}`);
    return i;
  };
  const deckZ = (name: string, x: number): number =>
    spec.decks[deckIndex(name)].z + (spec.sheerZ(x) - spec.depth);
  const edge = (x: number): number => hull.topHalfBreadth(x);

  const bridgeX = halfLbp - 190 * FT;
  const layout: ShipLayout = {
    sternX: hull.xMin,
    stemX: hull.xMax,
    forecastleFrom: halfLbp - 125 * FT,
    poopTo: hull.xMin + 105 * FT,
    bridgeDeckFrom: halfLbp - 175 * FT - 550 * FT,
    bridgeDeckTo: halfLbp - 175 * FT,
    boatDeckFrom: bridgeX - 500 * FT,
    boatDeckTo: bridgeX,
    promenadeEnclosedFrom: -4,
    aHouseInset: 3.0,
    loadWaterline: 10.54,
    bootTop: 0.2,
  };
  const L = layout;

  // -------------------------------------------------------------------------
  // Boat deck houses (from the profile and boat deck plans).
  const boatZ = (x: number) => deckZ("Boat", x);
  function house(
    id: string,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    h: number,
    roof: House["roof"] = "flat"
  ): House {
    return { id, x0, x1, y0, y1, z0: boatZ(x0), z1: boatZ(x1), h, roof };
  }
  const funnelX = spec.funnels.map((f) => f.x);
  const houses: House[] = [
    house("wheelhouse", 66.4, 70.9, -4.6, 4.6, 2.9),
    house("bridge-cab-starboard", 69.6, 72.2, -14.0, -11.9, 2.5),
    house("bridge-cab-port", 69.6, 72.2, 11.9, 14.0, 2.5),
    house("officers-quarters", 41.6, 66.4, -7.0, 7.0, 2.7),
    house("grand-staircase", 33.2, 41.6, -5.0, 5.0, 2.2),
    house("gymnasium", 24.0, 33.2, -10.6, -4.2, 3.1),
    house("first-class-entrance", 25.5, 33.2, 4.2, 8.4, 2.6),
    house("lounge-roof", -8.5, 7.5, -4.6, 4.6, 1.7, "skylight"),
    house("compass-platform", 9.6, 12.0, -1.2, 1.2, 4.2),
    house("aft-staircase", -31.5, -22.5, -4.6, 4.6, 2.0),
    house("engine-skylight", -45.0, -33.5, -3.2, 3.2, 1.7, "skylight"),
    house("smoke-room-roof", -63.0, -55.5, -5.2, 5.2, 1.5, "skylight"),
    house("second-class-entrance", -79.6, -70.5, -5.6, 5.6, 2.7),
  ];
  // A casing round each funnel's foot.
  funnelX.forEach((x, i) =>
    houses.push(house(`funnel-casing-${i}`, x - 5.2, x + 5.2, -4.3, 4.3, 2.4))
  );
  const domes: Dome[] = [
    { x: 37.4, z: boatZ(37.4) + 2.2, a: 3.4, b: 3.0, c: 1.5 },
    { x: -27.0, z: boatZ(-27) + 2.0, a: 3.0, b: 2.8, c: 1.3 },
  ];

  // -------------------------------------------------------------------------
  // Funnels: White Star buff, black tops, elliptical (24 ft 6 in by 19 ft),
  // raked aft about 2 degrees. The fourth is a dummy (ventilation only).
  const funnels: FunnelRecipe[] = spec.funnels.map((f, i) => ({
    index: i,
    x: f.x,
    baseZ: f.baseZ,
    topZ: f.topZ,
    dummy: f.dummy,
    semiA: (24.5 * FT) / 2,
    semiB: (19 * FT) / 2,
    rake: 2 * TO_RAD,
    blackTop: 5.4,
    bands: [0.42, 0.69],
    pipes: f.dummy
      ? [{ y: 0, r: 0.22 }]
      : [
          { y: -0.75, r: 0.32 },
          { y: 0.75, r: 0.32 },
          { y: 0, r: 0.2 },
        ],
    hasWhistle: !f.dummy,
  }));

  // -------------------------------------------------------------------------
  // Masts: the foremast in the forward well (crow's nest about 95 ft above
  // the water), the mainmast in the after well; both raked like the funnels.
  const masts: MastRecipe[] = [
    {
      id: "fore",
      x: 85.4,
      baseZ: spec.sheerZ(85.4),
      topZ: 68,
      r0: 0.5,
      r1: 0.17,
      rake: 2 * TO_RAD,
      crowsNest: { z: 38.5, r: 0.95, h: 1.5 },
    },
    {
      id: "main",
      x: -96.4,
      baseZ: spec.sheerZ(-96.4),
      topZ: 68,
      r0: 0.48,
      r1: 0.17,
      rake: 2 * TO_RAD,
    },
  ];
  const mastAt = (m: MastRecipe, z: number): V3 => [
    m.x - Math.tan(m.rake) * (z - m.baseZ),
    0,
    z,
  ];

  // -------------------------------------------------------------------------
  // Lifeboats: 14 wooden lifeboats (30 ft) and 2 emergency cutters (25 ft)
  // under Welin davits, 4 Engelhardt collapsibles (27 ft). Odd numbers to
  // starboard, even to port; 1–8 forward (1 and 2 the cutters), 9–16 aft.
  const pairX = [59.6, 49.7, 39.3, 28.9, -38.2, -48.6, -58.8, -69.2];
  const boats: BoatRecipe[] = TITANIC_BOATS.map((label, index) => {
    const n = Number(label);
    if (Number.isFinite(n)) {
      const side = n % 2 === 1 ? "starboard" : "port";
      const s = side === "port" ? 1 : -1;
      const x = pairX[Math.ceil(n / 2) - 1];
      const isCutter = n <= 2;
      const e = edge(x);
      const beam = isCutter ? 7.17 * FT : 9.08 * FT;
      return {
        index,
        label,
        kind: isCutter ? "cutter" : "lifeboat",
        side,
        x,
        y: s * (e - 2.1),
        z: boatZ(x) + 0.45,
        length: isCutter ? 25 * FT : 30 * FT,
        beam,
        depth: isCutter ? 3 * FT : 4 * FT,
        hasDavits: true,
        edgeY: s * (e - 0.35),
        deckZ: boatZ(x),
      } satisfies BoatRecipe;
    }
    // Collapsibles: A and B on the officers' quarters roof beside the first
    // funnel, C and D on the deck inboard of the cutters.
    const onRoof = label === "A" || label === "B";
    const side = label === "A" || label === "C" ? "starboard" : "port";
    const s = side === "port" ? 1 : -1;
    const x = onRoof ? 61.2 : 59.6;
    const z = onRoof ? boatZ(x) + 2.7 + 0.25 : boatZ(x) + 0.25;
    return {
      index,
      label,
      kind: "collapsible",
      side,
      x,
      y: s * (onRoof ? 5.6 : edge(x) - 5.1),
      z,
      length: 27.4 * FT,
      beam: 8 * FT,
      depth: 3 * FT,
      hasDavits: false,
      edgeY: s * (edge(x) - 0.35),
      deckZ: boatZ(x),
    } satisfies BoatRecipe;
  });
  const davits: DavitRecipe[] = [];
  for (const b of boats) {
    if (!b.hasDavits) continue;
    for (const dx of [-1, 1]) {
      const x = b.x + dx * (b.length / 2 - 0.45);
      davits.push({
        boat: b.index,
        x,
        footY: b.edgeY,
        headY: b.y,
        z: boatZ(x),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Lights.
  const lights: LightSpot[] = [];
  let serial = 0;
  const seed = () => hash01(serial++, 7919);

  /** A porthole on the hull plating at (x, z), oriented to the surface. */
  function hullPort(x: number, z: number, s: 1 | -1, deck: number): void {
    const at = hullPortAt(hull, x, z, s);
    if (!at) return;
    lights.push({
      kind: "porthole",
      ...at,
      w: 0.42,
      h: 0.42,
      deck,
      seed: seed(),
    });
  }
  /** A light on a wall that follows the deck edge (flush with the hull). */
  function edgeLight(
    kind: LightSpot["kind"],
    x: number,
    z: number,
    s: 1 | -1,
    inset: number,
    w: number,
    h: number,
    deck: number
  ): void {
    const e = edge(x) - inset;
    if (e < 1.5) return;
    const d = 0.4;
    const slope = (edge(x + d) - edge(x - d)) / (2 * d);
    const n = normalize([-slope, s, 0]);
    lights.push({
      kind,
      p: [x + n[0] * 0.03, s * e + n[1] * 0.03, z],
      n,
      w,
      h,
      deck,
      seed: seed(),
    });
  }
  /** A light on a flat wall facing `n` (a house side or end). */
  function wallLight(
    kind: LightSpot["kind"],
    p: V3,
    n: V3,
    w: number,
    h: number,
    deck: number
  ): void {
    lights.push({
      kind,
      p: [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03],
      n,
      w,
      h,
      deck,
      seed: seed(),
    });
  }
  /** Evenly spaced spots from x0 to x1, some left out (cabin layouts). */
  function row(
    x0: number,
    x1: number,
    step: number,
    gap: number,
    rowId: number,
    at: (x: number) => void
  ): void {
    const n = Math.floor((x1 - x0) / step);
    for (let i = 0; i <= n; i += 1) {
      if (hash01(i, rowId) < gap) continue;
      at(x0 + i * step);
    }
  }
  const sides: (1 | -1)[] = [1, -1];

  // The hull's portholes: D and E decks nearly end to end, F and G decks
  // only forward and aft of the machinery spaces.
  const hullRows: { deck: string; ranges: [number, number][]; gap: number }[] =
    [
      { deck: "D", ranges: [[-121, 114]], gap: 0.1 },
      { deck: "E", ranges: [[-121, 117]], gap: 0.1 },
      {
        deck: "F",
        ranges: [
          [-117, -42],
          [44, 117],
        ],
        gap: 0.18,
      },
      {
        deck: "G",
        ranges: [
          [-112, -76],
          [70, 113],
        ],
        gap: 0.3,
      },
    ];
  hullRows.forEach((r, ri) => {
    const deck = deckIndex(r.deck);
    for (const s of sides)
      for (const [x0, x1] of r.ranges)
        row(x0, x1, 1.08, r.gap, ri * 2 + (s > 0 ? 0 : 1), (x) => {
          // Clear of the anchors and the bow name.
          if (x > 116 && r.deck === "D") return;
          hullPort(x, deckZ(r.deck, x) + 1.3, s, deck);
        });
  });

  // C deck: portholes in the white band above the black hull.
  const deckC = deckIndex("C");
  const cRanges: [number, number][] = [
    [L.bridgeDeckFrom + 1, L.bridgeDeckTo - 1],
    [L.forecastleFrom + 1.5, 119],
    [-131, L.poopTo - 1.5],
  ];
  for (const s of sides)
    for (const [x0, x1] of cRanges)
      row(x0, x1, 1.08, 0.15, 20 + (s > 0 ? 0 : 1), (x) =>
        edgeLight("porthole", x, deckZ("C", x) + 1.35, s, 0, 0.42, 0.42, deckC)
      );

  // B deck: rectangular windows, flush with the side.
  const deckB = deckIndex("B");
  for (const s of sides)
    row(
      L.boatDeckFrom + 1,
      L.bridgeDeckTo - 1.2,
      1.6,
      0.1,
      30 + (s > 0 ? 0 : 1),
      (x) =>
        edgeLight("window", x, deckZ("B", x) + 1.45, s, 0, 0.7, 0.95, deckB)
    );

  // A deck: the enclosed forward promenade's big windows, and the house
  // windows behind the open after promenade.
  const deckA = deckIndex("A");
  for (const s of sides) {
    row(L.promenadeEnclosedFrom + 0.9, L.boatDeckTo - 0.9, 1.84, 0, 40, (x) =>
      edgeLight("window", x, deckZ("A", x) + 1.6, s, 0.05, 1.45, 1.2, deckA)
    );
    row(
      L.boatDeckFrom + 1.5,
      L.promenadeEnclosedFrom - 1,
      2.0,
      0.12,
      41 + (s > 0 ? 0 : 1),
      (x) =>
        edgeLight(
          "window",
          x,
          deckZ("A", x) + 1.45,
          s,
          L.aHouseInset,
          0.75,
          0.95,
          deckA
        )
    );
  }

  // Forward faces over the forward well: C deck portholes, B and A deck
  // windows, and the wheelhouse front.
  const fwd: V3 = [1, 0, 0];
  for (let y = -11; y <= 11.01; y += 2.2) {
    wallLight(
      "porthole",
      [L.bridgeDeckTo, y, deckZ("C", L.bridgeDeckTo) + 1.35],
      fwd,
      0.42,
      0.42,
      deckC
    );
    wallLight(
      "window",
      [L.bridgeDeckTo, y, deckZ("B", L.bridgeDeckTo) + 1.45],
      fwd,
      0.7,
      0.95,
      deckB
    );
  }
  for (let y = -9.6; y <= 9.61; y += 1.6)
    wallLight(
      "window",
      [L.boatDeckTo, y, deckZ("A", L.boatDeckTo) + 1.5],
      fwd,
      0.8,
      1.0,
      deckA
    );
  const deckBoat = deckIndex("Boat");
  for (let y = -3.6; y <= 3.61; y += 0.9)
    wallLight(
      "window",
      [70.9, y, boatZ(70.9) + 1.75],
      fwd,
      0.62,
      0.75,
      deckBoat
    );
  // After faces over the after well and the poop.
  const aft: V3 = [-1, 0, 0];
  for (let y = -11; y <= 11.01; y += 2.2) {
    wallLight(
      "porthole",
      [L.bridgeDeckFrom, y, deckZ("C", L.bridgeDeckFrom) + 1.35],
      aft,
      0.42,
      0.42,
      deckC
    );
    wallLight(
      "porthole",
      [L.forecastleFrom, y * 0.9, deckZ("C", L.forecastleFrom) + 1.35],
      aft,
      0.42,
      0.42,
      deckC
    );
  }
  for (let y = -9; y <= 9.01; y += 3)
    wallLight(
      "porthole",
      [L.poopTo, y, deckZ("C", L.poopTo) + 1.35],
      fwd,
      0.42,
      0.42,
      deckC
    );

  // Boat deck houses: cabin windows on the long sides, the gymnasium's tall
  // windows, the domes' glass, the skylights' clerestories.
  for (const h of houses) {
    const kind = h.id;
    if (kind.startsWith("funnel-casing") || kind.startsWith("bridge-cab"))
      continue;
    if (kind === "compass-platform" || kind === "wheelhouse") continue;
    const big = kind === "gymnasium";
    const sky = h.roof === "skylight";
    const step = big ? 1.3 : sky ? 1.6 : 2.1;
    const w = big ? 1.0 : sky ? 1.1 : 0.62;
    const ht = big ? 1.55 : sky ? 0.5 : 0.75;
    const zOff = big ? 1.55 : sky ? h.h - 0.55 : 1.45;
    for (const [y, ny] of [
      [h.y1, 1],
      [h.y0, -1],
    ] as const) {
      // Only the outward-facing sides of side houses.
      if (h.y0 > 0 && ny < 0) continue;
      if (h.y1 < 0 && ny > 0) continue;
      const n = Math.floor((h.x1 - h.x0 - 1) / step);
      for (let i = 0; i <= n; i += 1) {
        const x = h.x0 + 0.5 + (h.x1 - h.x0 - 1 - n * step) / 2 + i * step;
        wallLight(
          "window",
          [x, y, boatZ(x) + zOff],
          [0, ny, 0],
          w,
          ht,
          deckBoat
        );
      }
    }
  }
  for (const d of domes) {
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const el = 0.55;
      const n = normalize([
        (Math.cos(a) * Math.cos(el)) / d.a,
        (Math.sin(a) * Math.cos(el)) / d.b,
        Math.sin(el) / d.c,
      ]);
      wallLight(
        "window",
        [
          d.x + d.a * Math.cos(a) * Math.cos(el),
          d.b * Math.sin(a) * Math.cos(el),
          d.z + d.c * Math.sin(el),
        ],
        n,
        0.95,
        0.6,
        deckBoat
      );
    }
  }

  // -------------------------------------------------------------------------
  // Deck fittings.
  const vents: Placement[] = [];
  funnelX.forEach((x, i) => {
    for (const s of sides) {
      vents.push({
        p: [x + 6.6, s * 3.3, boatZ(x + 6.6)],
        yaw: 0,
        scale: 1.15,
      });
      vents.push({
        p: [x - 6.6, s * 3.3, boatZ(x - 6.6)],
        yaw: Math.PI,
        scale: 1.15,
      });
      if (i < 3)
        vents.push({
          p: [x + 2.2, s * 6.0, boatZ(x + 2.2)],
          yaw: 0,
          scale: 0.8,
        });
    }
  });
  for (const s of sides) {
    vents.push({ p: [99, s * 3.2, deckZ("B", 99)], yaw: 0, scale: 0.9 });
    vents.push({
      p: [-117, s * 3.6, deckZ("B", -117)],
      yaw: Math.PI,
      scale: 0.9,
    });
    vents.push({ p: [88.6, s * 4.4, deckZ("C", 88.6)], yaw: 0, scale: 0.8 });
    vents.push({
      p: [-104, s * 4.4, deckZ("C", -104)],
      yaw: Math.PI,
      scale: 0.8,
    });
    vents.push({
      p: [-86, s * 5.0, deckZ("B", -86)],
      yaw: Math.PI,
      scale: 0.85,
    });
  }

  const benches: Placement[] = [];
  for (const s of sides) {
    for (const x of [22, 16, 4, -2, -9, -20, -33, -66, -74])
      benches.push({
        p: [x, s * 8.2, boatZ(x)],
        yaw: s > 0 ? Math.PI : 0,
        scale: 1,
      });
    for (const x of [-112, -118, -124])
      benches.push({
        p: [x, s * 8.5, deckZ("B", x)],
        yaw: s > 0 ? Math.PI : 0,
        scale: 1,
      });
  }

  const bollards: Placement[] = [];
  for (const s of sides) {
    for (const x of [96, 104, 112, 120])
      bollards.push({
        p: [x, s * (edge(x) - 1.1), deckZ("B", x)],
        yaw: 0,
        scale: 1,
      });
    for (const x of [79, 88])
      bollards.push({
        p: [x, s * (edge(x) - 1.0), deckZ("C", x)],
        yaw: 0,
        scale: 1,
      });
    for (const x of [-101, -94])
      bollards.push({
        p: [x, s * (edge(x) - 1.0), deckZ("C", x)],
        yaw: 0,
        scale: 1,
      });
    for (const x of [-110, -120, -130])
      bollards.push({
        p: [x, s * (edge(x) - 1.1), deckZ("B", x)],
        yaw: 0,
        scale: 1,
      });
  }

  const capstans: Placement[] = [
    { p: [122.6, 1.6, deckZ("B", 122.6)], yaw: 0, scale: 1 },
    { p: [122.6, -1.6, deckZ("B", 122.6)], yaw: 0, scale: 1 },
    { p: [117.8, 0, deckZ("B", 117.8)], yaw: 0, scale: 1.1 },
    { p: [94.5, 3.6, deckZ("B", 94.5)], yaw: 0, scale: 0.85 },
    { p: [94.5, -3.6, deckZ("B", 94.5)], yaw: 0, scale: 0.85 },
    { p: [-125, 4.2, deckZ("B", -125)], yaw: 0, scale: 0.85 },
    { p: [-125, -4.2, deckZ("B", -125)], yaw: 0, scale: 0.85 },
  ];

  // Electric cargo cranes in both wells, on the poop and at the after end
  // of the bridge deck; the anchor crane for the centre anchor at the bow.
  const cranes: Placement[] = [
    { p: [121.4, 0, deckZ("B", 121.4)], yaw: 0, scale: 0.7 },
  ];
  for (const s of sides) {
    cranes.push({
      p: [78.6, s * 5.6, deckZ("C", 78.6)],
      yaw: s * 0.4,
      scale: 1,
    });
    cranes.push({
      p: [-99.2, s * 5.6, deckZ("C", -99.2)],
      yaw: Math.PI - s * 0.4,
      scale: 1,
    });
    cranes.push({
      p: [-110.6, s * 4.2, deckZ("B", -110.6)],
      yaw: Math.PI - s * 0.5,
      scale: 1,
    });
    cranes.push({
      p: [-87.0, s * 6.0, deckZ("B", -87)],
      yaw: Math.PI - s * 0.4,
      scale: 0.9,
    });
  }

  const hatches: Hatch[] = [
    { x0: 104.5, x1: 108.6, hw: 2.4, z: deckZ("B", 106), h: 0.75 },
    { x0: 80.6, x1: 84.2, hw: 2.6, z: deckZ("C", 82), h: 0.8 },
    { x0: -104.6, x1: -100.8, hw: 2.6, z: deckZ("C", -102), h: 0.8 },
    { x0: -116.6, x1: -113.2, hw: 2.2, z: deckZ("B", -115), h: 0.7 },
  ];

  // -------------------------------------------------------------------------
  // Railings along every open deck edge.
  const rails: RailRun[] = [];
  function edgeRun(x0: number, x1: number, deck: string, inset: number): void {
    for (const s of sides) {
      const pts: V3[] = [];
      const n = Math.max(2, Math.ceil((x1 - x0) / 1.6));
      for (let i = 0; i <= n; i += 1) {
        const x = x0 + ((x1 - x0) * i) / n;
        pts.push([x, s * Math.max(0, edge(x) - inset), deckZ(deck, x)]);
      }
      rails.push({ points: pts });
    }
  }
  function acrossRun(x: number, deck: string, inset: number): void {
    const e = edge(x) - inset;
    const pts: V3[] = [];
    const n = Math.ceil((2 * e) / 1.6);
    for (let i = 0; i <= n; i += 1)
      pts.push([x, -e + (2 * e * i) / n, deckZ(deck, x)]);
    rails.push({ points: pts });
  }
  edgeRun(L.forecastleFrom, L.stemX - 0.4, "B", 0.08);
  acrossRun(L.forecastleFrom + 0.08, "B", 0.08);
  edgeRun(L.bridgeDeckTo, L.forecastleFrom, "C", 0.08);
  edgeRun(L.poopTo, L.bridgeDeckFrom, "C", 0.08);
  edgeRun(L.sternX + 0.4, L.poopTo, "B", 0.08);
  acrossRun(L.poopTo - 0.08, "B", 0.08);
  edgeRun(L.bridgeDeckFrom, L.boatDeckFrom, "B", 0.08);
  acrossRun(L.bridgeDeckFrom + 0.08, "B", 0.08);
  edgeRun(L.boatDeckFrom, L.boatDeckTo, "Boat", 0.1);
  acrossRun(L.boatDeckFrom + 0.1, "Boat", 0.1);
  edgeRun(L.boatDeckFrom, L.promenadeEnclosedFrom, "A", 0.08);

  // -------------------------------------------------------------------------
  // Rigging: stays and shrouds, the wireless aerial between the mastheads,
  // its lead down to the Marconi room, the funnels' guys.
  const wires: Wire[] = [];
  const [fore, main] = masts;
  const foreTop = mastAt(fore, fore.topZ - 0.6);
  const mainTop = mastAt(main, main.topZ - 0.6);
  wires.push({
    a: mastAt(fore, fore.topZ - 3),
    b: [L.stemX - 0.6, 0, deckZ("B", L.stemX - 0.6) + 1],
    kind: "rig",
  });
  wires.push({
    a: mastAt(fore, 40),
    b: [L.forecastleFrom + 6, 0, deckZ("B", L.forecastleFrom + 6)],
    kind: "rig",
  });
  for (const s of sides) {
    for (const dx of [-2.2, -4.2, -6.2]) {
      const x = fore.x + dx;
      wires.push({
        a: mastAt(fore, 40),
        b: [x, s * (edge(x) - 0.15), deckZ("C", x) + 0.9],
        kind: "rig",
      });
    }
    wires.push({
      a: mastAt(fore, fore.topZ - 4),
      b: [
        fore.x - 8,
        s * (edge(fore.x - 8) - 0.15),
        deckZ("C", fore.x - 8) + 0.9,
      ],
      kind: "rig",
    });
    for (const dx of [2.2, 4.2, 6.2]) {
      const x = main.x + dx;
      wires.push({
        a: mastAt(main, 40),
        b: [x, s * (edge(x) - 0.15), deckZ("C", x) + 0.9],
        kind: "rig",
      });
    }
    for (const x of [-112, -118]) {
      wires.push({
        a: mastAt(main, main.topZ - 4),
        b: [x, s * (edge(x) - 0.15), deckZ("B", x) + 0.9],
        kind: "rig",
      });
    }
  }
  // Four aerial wires on spreaders, sagging between the masts.
  const aerialY = [-1.5, -0.5, 0.5, 1.5];
  const sag = 2.4;
  const aerialAt = (t: number, y: number): V3 => [
    foreTop[0] + (mainTop[0] - foreTop[0]) * t,
    y,
    foreTop[2] + (mainTop[2] - foreTop[2]) * t - sag * 4 * t * (1 - t),
  ];
  for (const y of aerialY) {
    const segs = 12;
    for (let i = 0; i < segs; i += 1)
      wires.push({
        a: aerialAt(i / segs, y),
        b: aerialAt((i + 1) / segs, y),
        kind: "aerial",
      });
  }
  const leadFrom = aerialAt((foreTop[0] - 30) / (foreTop[0] - mainTop[0]), 0);
  wires.push({ a: leadFrom, b: [44, 0, boatZ(44) + 2.7], kind: "aerial" });
  // Signal halyards from the foremast to the bridge wings.
  for (const s of sides)
    wires.push({
      a: mastAt(fore, 44),
      b: [71.8, s * 13.5, boatZ(71.8) + 2.6],
      kind: "rig",
    });

  const funnelGuys: Wire[][] = funnels.map((f) => {
    const guys: Wire[] = [];
    const H = f.topZ - f.baseZ;
    const zBand = f.baseZ + H * f.bands[1];
    const lean = Math.tan(f.rake);
    for (const s of sides) {
      for (const [ang, dx] of [
        [0.35, 7.5],
        [0.95, 2.5],
        [Math.PI - 0.95, -2.5],
        [Math.PI - 0.35, -7.5],
      ] as const) {
        const ax = f.x - lean * (zBand - f.baseZ) + f.semiA * Math.cos(ang);
        const ay = s * f.semiB * Math.sin(ang);
        const x = f.x + dx;
        guys.push({
          a: [ax, ay, zBand],
          b: [x, s * (edge(x) - 0.6), boatZ(x) + 0.3],
          kind: "rig",
        });
      }
    }
    return guys;
  });

  // -------------------------------------------------------------------------
  // Under water: the centre four-blade propeller in the aperture between
  // the sternpost and the rudder, the two three-blade wing propellers on
  // their shaft bossings, and the rudder (78 ft 8 in by 15 ft 3 in).
  const propellers: Propeller[] = [
    { hub: [-130.75, 0, 4.4], radius: (16.5 * FT) / 2, blades: 4, phase: 0.4 },
    { hub: [-120.9, 6.4, 5.4], radius: (23.5 * FT) / 2, blades: 3, phase: 0.2 },
    {
      hub: [-120.9, -6.4, 5.4],
      radius: (23.5 * FT) / 2,
      blades: 3,
      phase: 1.1,
    },
  ];
  const rudder = {
    outline: [
      [-132.0, 0.55],
      [-135.2, 0.55],
      [-136.1, 0.85],
      [-136.55, 1.6],
      [-136.7, 4.0],
      [-136.7, 8.6],
      [-136.45, 10.6],
      [-135.8, 11.9],
      [-134.6, 12.6],
      [-132.0, 12.6],
    ] as [number, number][],
    thickness: 0.62,
  };
  const bossings = [1, -1].map((s) => ({
    from: [-96, s * 6.0, 5.4] as V3,
    to: [-120.2, s * 6.4, 5.4] as V3,
    r0: 1.7,
    r1: 0.66,
  }));

  const anchors = (["port", "starboard"] as const).map((side) => {
    const s = side === "port" ? 1 : -1;
    const x = 122.2;
    const z = spec.sheerZ(x) - 2.7;
    return { p: [x, s * hull.halfBreadth(x, z), z] as V3, side };
  });

  const names: NameBoard[] = [
    {
      where: "bow",
      x: 112.5,
      z: spec.sheerZ(112.5) - 0.78,
      side: "port",
      width: 6.2,
      height: 0.62,
    },
    {
      where: "bow",
      x: 112.5,
      z: spec.sheerZ(112.5) - 0.78,
      side: "starboard",
      width: 6.2,
      height: 0.62,
    },
    {
      where: "stern",
      x: L.sternX,
      z: spec.sheerZ(L.sternX) - 1.7,
      side: "aft",
      // On the flatter middle of the counter, where it reads from astern.
      width: 7.8,
      height: 1.6,
    },
  ];

  return {
    spec,
    hull,
    layout,
    deckIndex,
    deckZ,
    houses,
    domes,
    funnels,
    masts,
    boats,
    davits,
    lights,
    vents,
    benches,
    bollards,
    capstans,
    cranes,
    hatches,
    rails,
    wires,
    funnelGuys,
    propellers,
    rudder,
    bossings,
    anchors,
    names,
  };
}

/**
 * Where a porthole on the hull plating at (x, z) sits, side `s` (+1 port),
 * and its outward normal; null where the hull is too narrow for one.
 */
export function hullPortAt(
  hull: HullSurface,
  x: number,
  z: number,
  s: 1 | -1
): { p: V3; n: V3 } | null {
  const hb = hull.halfBreadth(x, z);
  if (hb < 2.4) return null;
  const d = 0.25;
  const hx =
    (hull.halfBreadth(x + d, z) - hull.halfBreadth(x - d, z)) / (2 * d);
  const hz =
    (hull.halfBreadth(x, z + d) - hull.halfBreadth(x, z - d)) / (2 * d);
  const n = normalize([-hx, s, -hz]);
  return {
    p: [x + n[0] * 0.03, s * hb + n[1] * 0.03, z + n[2] * 0.03],
    n,
  };
}

export function normalize(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
