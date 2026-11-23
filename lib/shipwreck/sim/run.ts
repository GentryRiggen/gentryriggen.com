import {
  type BulkheadDoor,
  type Compartment,
  type DeckOpening,
  type Opening,
  type RunOpening,
  type ShipSpec,
  type TorpedoSpec,
  hullOpenings,
  isDeckOpening,
} from "../ships/types";
import {
  BOX_PERMEABILITY,
  BREAK_DAMAGE_M,
  BREAK_OPEN_FRACTION,
  BREAK_SNAP_M,
  CROSS_DOOR_Z_M,
  DESCENT_TIME_SCALE,
  DRIFT_MPS,
  END_T,
  FAST_FRAME_S,
  FAST_STEP_S,
  FLOOR_SINK_M,
  GRAV,
  PERMEABILITY,
  PORTHOLE_HEIGHT_M,
  PORTHOLE_PIECE_M,
  PUMP_DEPTH_M,
  PUMP_M3S,
  RHO,
  SIM_STEP_S,
  SLOW_FRAME_S,
  STERN_CAPSIZE_DEG_S,
  DECK_SAMPLE_S,
  STORM_SCALE,
} from "./constants";
import {
  type Body,
  type CrossLink,
  type SpillLink,
  earthZ,
  stepFloat,
  turnTo,
  upOf,
  updateBounds,
} from "./body";
import { type DeckWater, makeDeckWater } from "./deckWater";
import { stepFall, stepLanding, sternDown } from "./descent";
import { doorLinks, openDoors } from "./doors";
import {
  DYNAMO_FLOOD_M,
  FUNNEL_STAY_LIMIT_DEG,
  FUNNEL_STAY_STEP_DEG,
  FUNNEL_UNDER_M,
  HATCH_TIGHT_FAIL_FACTOR,
  LIGHTS_FLICKER_TRIM_DEG,
  STEADY_HOLD_S,
  STEADY_INFLOW_M3S,
  STEADY_MINE_ROLL_RADS,
  STEADY_POSE_DEG,
  STEADY_POSE_M,
  STEADY_POSE_S,
  type SimEvent,
  type SimEventKind,
} from "./events";
import {
  type Cell,
  type DeckCellOpening,
  type DeckSea,
  makeCell,
} from "./flooding";
import {
  type HullModel,
  type Span,
  boxSlice,
  buildHull,
  hullHalfBreadth,
  hullSlice,
  sectionAt,
} from "./geometry";
import { type GirderState, girder, strengthProfile } from "./girder";
import { R_SIZE, R_VOL, integrateSlice, upInShip } from "./hydrostatics";
import { headingAt, headwayOf, headwayRun, speedAt } from "./headway";
import { type MassModel, buildMass, massOf } from "./mass";
import { holdsRealMine, mineOpenings } from "./mine";
import type { BodyPose, SimFrame, SimTrack } from "./track";
import { GROUP_RELOCK_S, lockGroups, stormOf } from "./waves";
import { rideWeight, waveRide } from "./waveRide";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, cos, floor, max, min, sin } = Math;

/**
 * Running the night: build the ship, settle her, open the holes at t = 0
 * and step until both parts rest on the floor or 6:00 AM comes.
 */

export interface SimProbe {
  t: number;
  bodies: readonly Body[];
  /** Highest bending moment over strength (0 after the break), where. */
  girderUse: number;
  girderX: number;
  girderHogNm: number;
  /** Bending moment per hull station (N·m, + hogging) and the stations. */
  girderHog: Float64Array;
  stationX: Float64Array;
  /** Earth z of the lowest hull vertex of any body (m). */
  lowestZ: number;
}

export interface SimOptions {
  /** Stop at this shown time if she still floats (default 6:00 AM). */
  endT?: number;
  /** Called after every step (tools and calibration only). */
  probe?: (p: SimProbe) => void;
  /** Whether `spec.portholes` are open (default true). */
  portholesOpen?: boolean;
  /** The storm's heights (`spec.storm`): as it was, or scaled by
   *  STORM_SCALE (calmer 0.6, worse 1.25). Default "real". */
  storm?: "real" | "calmer" | "worse";
  /** Hatch covers properly clamped: no leak while intact, and they hold
   *  HATCH_TIGHT_FAIL_FACTOR times the head. Default false. */
  hatchesTight?: boolean;
  /**
   * Her topside damage: the deck openings of kind "vent" and "split" (the
   * Fitzgerald's broken vents and the split at her deck edge). Default
   * true; false leaves them out. Hull openings the run is given are not
   * touched: her real run's graze on Six Fathom Shoal (R14) is hull damage
   * and stays unless the run's openings drop it.
   */
  topsideDamage?: boolean;
  /** A grounding: adds each of `spec.shoalOpenings` the run's openings do
   *  not already hold (a real run may: the Fitzgerald's, R14). Default
   *  false. */
  shoal?: boolean;
  /** Every `kind: "door"` door shut (default false). */
  doorsClosed?: boolean;
  /** Engines stopped at the first event: no profile, no turn; she coasts
   *  with HEADWAY_STOP_HALF_LIFE_S (default false). */
  enginesStopped?: boolean;
}

const DEG = Math.PI / 180;
const SETTLE_S = 300;

/** A storm ship's What-if spot for her topside damage (the broken vents
 *  and the split at her deck edge). */
export const VENTS_SPOT = "vents";
/** A storm ship's What-if spot for grounding strip k (from 1) of `shoalOpenings`. */
export function shoalSpot(k: number): string {
  return `shoal-${k}`;
}

/** A torpedo ship's What-if spot for her later torpedo (`TorpedoSpec.finisher`). */
export const FINISHER_SPOT = "finisher";

/**
 * The spots a What-if offers. An iceberg ship: every compartment. A
 * torpedo ship: the main spaces along her length (a hit at a boiler room
 * also opens its starboard side bunker), aft to forward, then her later
 * torpedo (`FINISHER_SPOT`) if she has one (`spec.torpedo.finisher`). A
 * storm ship: each hatch (its deck opening's id, No. 1 first), her topside
 * damage (`VENTS_SPOT`) and each grounding strip (`shoalSpot(k)`).
 */
export function whatIfSpots(spec: ShipSpec): string[] {
  if (spec.cause === "storm") {
    const deck = spec.deckOpenings ?? [];
    const spots = deck.filter((d) => d.kind === "hatch").map((d) => d.id);
    if (deck.some(isTopsideDamage) || spec.realNight.length > 0)
      spots.push(VENTS_SPOT);
    (spec.shoalOpenings ?? []).forEach((_, k) => spots.push(shoalSpot(k + 1)));
    return spots;
  }
  const spots = spec.compartments
    .filter(
      (c) =>
        (spec.cause !== "torpedo" && spec.cause !== "mine") ||
        !c.span ||
        c.span.side === "centre"
    )
    .map((c) => c.id);
  if (spec.cause === "torpedo" && spec.torpedo?.finisher)
    spots.push(FINISHER_SPOT);
  return spots;
}

/**
 * The openings of a What-if run: the real damage where there was some.
 * Any number of spots may be chosen for every ship.
 */
export function whatIfOpenings(
  spec: ShipSpec,
  ids: readonly string[]
): RunOpening[] {
  if (spec.cause === "storm") return stormOpenings(spec, ids);
  if (spec.cause === "torpedo")
    return spec.torpedo
      ? specOpenings(spec, spec.torpedo, ids)
      : torpedoOpenings(spec, ids);
  if (spec.cause === "mine") return mineOpenings(spec, whatIfSpots(spec), ids);
  const out: Opening[] = [];
  for (const id of ids) {
    const comp = spec.compartments.find((c) => c.id === id);
    if (!comp) continue;
    const real = spec.realNight.filter((o) => o.compartmentId === id);
    if (real.length > 0) out.push(...real);
    else
      out.push({
        compartmentId: id,
        areaM2: 0.2,
        zLow: 2.5,
        zHigh: 3.5,
        x: (comp.fromX + comp.toX) / 2,
        side: "starboard",
      });
  }
  return out;
}

/**
 * A storm What-if: every deck opening of hers, in her order, a chosen
 * hatch as it was (leaking) and the rest `tight` (clamped: no leak, and
 * they hold `HATCH_TIGHT_FAIL_FACTOR` times the head); her topside damage
 * (vents and splits) and any hull damage of hers (`realNight`) if
 * `VENTS_SPOT` is chosen; and each chosen grounding strip. So her real ids give exactly
 * her real run, and none at all is her with every hatch tight and no
 * damage (`hatchesTight` and `topsideDamage: false`).
 */
/** Is a deck opening topside damage (a broken vent, a split)? */
function isTopsideDamage(d: DeckOpening): boolean {
  return d.kind === "vent" || d.kind === "split";
}

function stormOpenings(spec: ShipSpec, ids: readonly string[]): RunOpening[] {
  const chosen = new Set(ids);
  const vents = chosen.has(VENTS_SPOT);
  const out: RunOpening[] = [];
  for (const d of spec.deckOpenings ?? []) {
    if (d.kind === "hatch")
      out.push(chosen.has(d.id) ? d : { ...d, tight: true });
    else if (!isTopsideDamage(d) || vents) out.push(d);
  }
  const shoal = spec.shoalOpenings ?? [];
  // Her hull damage that is not a grounding strip comes with the vents;
  // each strip is its own spot (a real run may hold them: R14).
  if (vents) out.push(...spec.realNight.filter((o) => !shoal.includes(o)));
  shoal.forEach((o, k) => {
    if (chosen.has(shoalSpot(k + 1))) out.push(o);
  });
  return out;
}

/**
 * The What-if spots that give a ship's real damage: an iceberg ship's
 * compartments the iceberg opened; for a torpedo ship her own
 * `torpedo.realSpots`, else the one spot where the real hit lands (the hit
 * moved there is the real afternoon); for a storm ship every hatch (none
 * was tight) and her topside damage.
 */
export function whatIfRealIds(spec: ShipSpec): string[] {
  if (spec.cause === "storm") {
    // Every hatch, her topside damage, and each grounding strip her real
    // run holds.
    const shoal = spec.shoalOpenings ?? [];
    return whatIfSpots(spec).filter((id) => {
      if (!id.startsWith("shoal-")) return true;
      const o = shoal[Number(id.slice(6)) - 1];
      return o !== undefined && spec.realNight.includes(o);
    });
  }
  if (spec.cause !== "torpedo" && spec.cause !== "mine")
    return [...new Set(spec.realNight.map((o) => o.compartmentId))];
  if (spec.torpedo) return [...spec.torpedo.realSpots];
  const real = JSON.stringify(spec.realNight);
  const spot = whatIfSpots(spec).find(
    (id) => JSON.stringify(whatIfOpenings(spec, [id])) === real
  );
  return spot ? [spot] : [];
}

/** Seconds between a torpedo ship's hits (several chosen spots). */
export const HIT_STAGGER_S = 3;

/**
 * Shown time hit k of n lands (aft first): the first at the first event,
 * the rest a few seconds apart after it, and the sim opens hit k's holes
 * then (`whatIfOpenings`). Deterministic; one hit lands at 0.
 */
export function hitTimeS(k: number, n: number): number {
  return n > 1 ? k * HIT_STAGGER_S : 0;
}

/**
 * Where each torpedo of a torpedo ship's run strikes (the ship-frame x of
 * its own hole in her side, the first opening of its hit), one per chosen
 * spot that lands one, aft first. Not a torpedo ship: none. The real
 * spot's is her real hit's (`realNight`'s first hole). A ship with her own
 * hits (`spec.torpedo`): each hit's x (`torpedoHits`), aft first.
 */
export function torpedoHitXs(spec: ShipSpec, ids: readonly string[]): number[] {
  if (spec.cause !== "torpedo" && spec.cause !== "mine") return [];
  if (spec.torpedo)
    return plannedHits(spec, spec.torpedo, ids)
      .map((h) => h.x)
      .sort((a, b) => a - b);
  const xs: number[] = [];
  for (const id of whatIfSpots(spec)) {
    if (!ids.includes(id)) continue;
    const hole = hullOpenings(whatIfOpenings(spec, [id])).find(
      (o) => o.side === "starboard" && (o.t ?? 0) === 0
    );
    if (hole) xs.push(hole.x);
  }
  return xs.sort((a, b) => a - b);
}

/** One torpedo of a run: where it strikes (ship-frame x) and when (shown s). */
export interface TorpedoHit {
  x: number;
  t: number;
  side: "port" | "starboard";
  /** Her later torpedo (`FINISHER_SPOT`). */
  finisher: boolean;
}

/**
 * Every torpedo of a run, in landing order. A ship with her own hits
 * (`spec.torpedo`): one per chosen spot, on her side, at its time. Else
 * (the Lusitania): `torpedoHitXs`, aft first, hit k at `hitTimeS(k, n)`
 * on her starboard side. Not a torpedo ship: none.
 */
export function torpedoHits(
  spec: ShipSpec,
  ids: readonly string[]
): TorpedoHit[] {
  if (spec.cause !== "torpedo") return [];
  if (spec.torpedo) {
    const side = spec.torpedo.side;
    return plannedHits(spec, spec.torpedo, ids).map((h) => ({
      x: h.x,
      t: h.t,
      side,
      finisher: h.finisher,
    }));
  }
  const xs = torpedoHitXs(spec, ids);
  return xs.map((x, k) => ({
    x,
    t: hitTimeS(k, xs.length),
    side: "starboard",
    finisher: false,
  }));
}

interface PlannedHit {
  /** The compartment it strikes. */
  comp: Compartment;
  x: number;
  t: number;
  finisher: boolean;
}

/**
 * A `spec.torpedo` ship's hits for chosen spots, in landing order: one per
 * chosen compartment spot (repeats and unknown ids add none) at
 * `hitX[id]`, else the compartment's middle, ordered along her length by
 * `order` and hit k landing k·staggerS after the first; then her later
 * torpedo if `FINISHER_SPOT` is chosen, at `finisher.spotId` and
 * `finisher.t`. Sorted by time (stable), so a finisher that came early
 * would still land in its turn.
 */
function plannedHits(
  spec: ShipSpec,
  torpedo: TorpedoSpec,
  ids: readonly string[]
): PlannedHit[] {
  const chosen = new Set(ids);
  const spots = whatIfSpots(spec);
  const xOf = (c: Compartment) => torpedo.hitX?.[c.id] ?? (c.fromX + c.toX) / 2;
  const comps: Compartment[] = [];
  for (const id of spots) {
    if (id === FINISHER_SPOT || !chosen.has(id)) continue;
    const c = spec.compartments.find((k) => k.id === id);
    if (c) comps.push(c);
  }
  const along = comps.map((comp) => ({ comp, x: xOf(comp) }));
  along.sort((a, b) => (torpedo.order === "fwd-first" ? b.x - a.x : a.x - b.x));
  const hits: PlannedHit[] = along.map((h, k) => ({
    ...h,
    t: k * torpedo.staggerS,
    finisher: false,
  }));
  const fin = torpedo.finisher;
  const finComp =
    fin && chosen.has(FINISHER_SPOT)
      ? spec.compartments.find((c) => c.id === fin.spotId)
      : undefined;
  if (fin && finComp)
    hits.push({ comp: finComp, x: xOf(finComp), t: fin.t, finisher: true });
  return hits.sort((a, b) => a.t - b.t);
}

/**
 * A `spec.torpedo` ship's What-if openings: each hit's hole (`hole`), its
 * `lengthM` centred on the hit's x and split across every compartment on
 * her struck side it overlaps, the area shared by overlap length (a hole
 * across a bulkhead opens both spaces). A compartment is on her struck
 * side if it spans her full breadth or is a wing on that side; each piece
 * sits at the middle of its overlap, at least 0.5 m inside its
 * compartment. A hole that overlaps none (off her ends) opens the hit's own
 * compartment. Each piece opens at its hit's time (none at 0).
 */
function specOpenings(
  spec: ShipSpec,
  torpedo: TorpedoSpec,
  ids: readonly string[]
): Opening[] {
  const { areaM2, zLow, zHigh, lengthM } = torpedo.hole;
  const side = torpedo.side;
  const struck = spec.compartments.filter(
    (c) => !c.span || c.span.side === side
  );
  const out: Opening[] = [];
  for (const h of plannedHits(spec, torpedo, ids)) {
    const lo = h.x - lengthM / 2;
    const hi = h.x + lengthM / 2;
    const pieces: { comp: Compartment; from: number; to: number }[] = [];
    for (const c of struck) {
      const from = max(lo, c.fromX);
      const to = min(hi, c.toX);
      if (to - from > X_EPS) pieces.push({ comp: c, from, to });
    }
    if (pieces.length === 0) pieces.push({ comp: h.comp, from: lo, to: hi });
    const total = pieces.reduce((s, p) => s + (p.to - p.from), 0);
    for (const p of pieces) {
      const c = p.comp;
      const mid = (p.from + p.to) / 2;
      const o: Opening = {
        compartmentId: c.id,
        areaM2: (areaM2 * (p.to - p.from)) / total,
        zLow,
        zHigh,
        x: min(c.toX - 0.5, max(c.fromX + 0.5, mid)),
        side,
      };
      out.push(h.t > 0 ? { ...o, t: h.t } : o);
    }
  }
  return out;
}

/**
 * A torpedo What-if: the real hit moved to each chosen compartment. The
 * real hit is read relative to its own compartment (the one beside the
 * first side bunker it opened): each opening keeps its area, heights and
 * time and goes as many compartments forward or aft of the chosen one as
 * it was of the real one. There it goes into the starboard side bunker, if
 * that compartment has one and the opening was in a bunker or is the
 * torpedo's own hole in the side shell (t = 0: it cannot reach a room
 * behind a bunker without opening the bunker); else into the compartment
 * itself (the second explosion, inside). So the real compartment gives the
 * real afternoon, and a hit in a boiler room always opens its starboard
 * bunker and the room behind it.
 */
function torpedoOpenings(
  spec: ShipSpec,
  compartmentIds: readonly string[]
): Opening[] {
  const comps = spec.compartments;
  const spots = whatIfSpots(spec);
  const byId = new Map(comps.map((c) => [c.id, c]));
  const wingOf = (main: Compartment) =>
    comps.find(
      (c) =>
        c.span?.side === "starboard" &&
        c.fromX < main.toX - X_EPS &&
        c.toX > main.fromX + X_EPS
    );
  /** The main compartment a compartment is part of (a bunker's room). */
  const spotOf = (id: string): number => {
    const c = byId.get(id);
    if (!c) return -1;
    if (!c.span || c.span.side === "centre") return spots.indexOf(id);
    return spots.findIndex((m) => {
      const k = byId.get(m) as Compartment;
      return k.fromX < c.toX - X_EPS && k.toX > c.fromX + X_EPS;
    });
  };
  const real = spec.realNight;
  const firstWing =
    real.find(
      (o) =>
        (o.t ?? 0) <= 0 && byId.get(o.compartmentId)?.span?.side === "starboard"
    ) ?? real[0];
  if (!firstWing) return [];
  const anchor = spotOf(firstWing.compartmentId);
  const anchorComp = byId.get(spots[anchor]) as Compartment;
  /** The real hit moved to spot `id` (its openings at their own times). */
  const movedTo = (id: string): Opening[] => {
    const out: Opening[] = [];
    const at = spots.indexOf(id);
    if (at < 0) return out;
    const shift =
      ((byId.get(id) as Compartment).fromX +
        (byId.get(id) as Compartment).toX -
        anchorComp.fromX -
        anchorComp.toX) /
      2;
    for (const o of real) {
      const k = at + spotOf(o.compartmentId) - anchor;
      if (k < 0 || k >= spots.length) continue;
      const main = byId.get(spots[k]) as Compartment;
      const inWing = byId.get(o.compartmentId)?.span?.side === "starboard";
      const shell = (o.t ?? 0) <= 0;
      const into = ((inWing || shell) && wingOf(main)) || main;
      const x = min(into.toX - 0.5, max(into.fromX + 0.5, o.x + shift));
      out.push({ ...o, compartmentId: into.id, x, side: "starboard" });
    }
    return out;
  };
  const hits = compartmentIds.map((id) => {
    const open = movedTo(id);
    const hole = open.find((o) => o.side === "starboard" && (o.t ?? 0) === 0);
    return { open, x: hole ? hole.x : null };
  });
  // Hit k of n (aft first) lands hitTimeS(k, n) after the first: each of
  // its openings that much later (one hit: its own times, untouched).
  const xs = hits
    .flatMap((h) => (h.x === null ? [] : [h.x]))
    .sort((a, b) => a - b);
  const out: Opening[] = [];
  for (const h of hits) {
    const lag = h.x === null ? 0 : hitTimeS(xs.indexOf(h.x), xs.length);
    for (const o of h.open)
      out.push(lag > 0 ? { ...o, t: (o.t ?? 0) + lag } : o);
  }
  return out;
}

interface World {
  spec: ShipSpec;
  hull: HullModel;
  mass: MassModel;
  bodies: Body[];
  compCapacity: number[];
  realT: number;
  t: number;
  nextFrameT: number;
  fast: boolean;
  broken: boolean;
  breakX: number | null;
  brokeAtT: number | null;
  sankAtT: number | null;
  flickerAtT: number | null;
  lightsOut: boolean;
  steadyFor: number;
  steady: boolean;
  scriptedNext: number;
  /** Her scripted events play this much later (`scriptedFromFirstHit`). */
  scriptedShift: number;
  funnelFallen: boolean[];
  fired: Set<string>;
  events: SimEvent[];
  frames: SimFrame[];
  done: boolean;
  outcome: "sank" | "floated";
  endT: number;
  girderState: GirderState;
  strength: Float64Array;
  forecastle: { x: number; z: number } | null;
  bridge: { x: number; z: number } | null;
  probe?: (p: SimProbe) => void;
  /** Settling before the collision (s left), and the holes to open then. */
  settleLeft: number;
  pending: { i: number; o: Cell["openings"][number] }[];
  /** Openings that open later (shown seconds), soonest first. */
  timed: { t: number; i: number; o: Cell["openings"][number] }[];
  /** A `spec.torpedo` ship's later hits (shown s, soonest first) still to
   *  land, and the next one's number (`torpedo-hit` index). */
  hitTimes: number[];
  nextHit: number;
  /** Forward way (none for the Titanic), lost for good at the first touch. */
  headway: ShipSpec["headway"];
  wayLost: boolean;
  /** Steady way: real time she went under (her way decays from then). */
  wayLostAt: number | null;
  /** Density of the water (kg/m³). */
  rho: number;
  /** Deck openings: the storm they see, and every one (for the events). */
  sea: DeckSea | null;
  deck: DeckCellOpening[];
  pendingDeck: { i: number; o: DeckCellOpening }[];
  /** Wave groups (index in spec.storm.groups) still to re-lock on her. */
  relock: number[];
  /** Real time her bow went under (her ride fades from then), or null. */
  bowUnderRealT: number | null;
  /** The way down plays this many times faster than real (`descentTimeScale`). */
  descentScale: number;
  /** The pumps (m³/s) and the depth in a space past which they stop (m). */
  pumps: number;
  pumpDepth: number;
  /** Bulkhead doors open this run (`doorsClosed` shuts the watertight ones). */
  doors: readonly BulkheadDoor[];
}

/** Settle her level before the collision, then open the holes at t = 0. */
function settle(w: World): void {
  const body = w.bodies[0];
  stepFloat(body, SIM_STEP_S, false, 0);
  w.settleLeft -= SIM_STEP_S;
  if (w.settleLeft > 0) return;
  body.vx = 0;
  body.vz = 0;
  body.wp = 0;
  body.wr = 0;
  body.x = 0;
  body.y = 0;
  for (const c of body.cells.concat(body.boxes)) c.water = 0;
  for (const p of w.pending) body.cells[p.i].openings.push(p.o);
  for (const p of w.pendingDeck) body.cells[p.i].deck.push(p.o);
  if (body.deckWater) body.deckWater.vol.fill(0);
  updateBounds(body);
  // Replace the placeholder frame with the settled ship at t = 0.
  w.frames[0] = frame(w);
  w.nextFrameT = SLOW_FRAME_S;
}

function cellOpening(hull: HullModel, o: Opening): Cell["openings"][number] {
  const zMid = (o.zLow + o.zHigh) / 2;
  const hb = hullHalfBreadth(hull, o.x, zMid);
  return {
    x: o.x,
    y: (o.side === "port" ? 1 : -1) * hb,
    zLow: o.zLow,
    zHigh: o.zHigh,
    area: o.areaM2,
  };
}

const X_EPS = 1e-6;

/** The cell's transverse range at a height where the hull is hb wide. */
function yRange(span: Span | undefined, hb: number): [number, number] {
  if (!span) return [-hb, hb];
  if (span.side === "centre") {
    const h = min(hb, span.y);
    return [-h, h];
  }
  if (span.side === "port") return [span.y, max(hb, span.y)];
  return [-max(hb, span.y), -span.y];
}

/**
 * Bulkhead tops water can spill over: every pair of cells end to end (a's
 * forward end on b's after end, a bulkhead at both), over the breadth they
 * share at the top (all of it for two full-breadth cells).
 */
function linksOf(hull: HullModel, cells: Cell[]): SpillLink[] {
  const links: SpillLink[] = [];
  for (let i = 0; i < cells.length; i += 1)
    for (let j = i + 1; j < cells.length; j += 1) {
      for (const [ia, ib] of [
        [i, j],
        [j, i],
      ]) {
        const a = cells[ia];
        const b = cells[ib];
        if (abs(a.slice.xTo - b.slice.xFrom) > X_EPS) continue;
        if (!a.fwdWall || !b.aftWall) continue;
        const hb = hullHalfBreadth(hull, a.slice.xTo, a.fwdTopZ - 0.05);
        let breadth: number;
        let y = 0;
        if (!a.slice.span && !b.slice.span) breadth = 2 * hb;
        else {
          const ra = yRange(a.slice.span, hb);
          const rb = yRange(b.slice.span, hb);
          const lo = max(ra[0], rb[0]);
          const hi = min(ra[1], rb[1]);
          breadth = hi - lo;
          y = (lo + hi) / 2;
        }
        if (breadth <= 0) continue;
        links.push({
          a: ia,
          b: ib,
          x: a.slice.xTo,
          topZ: a.fwdTopZ,
          y,
          breadth,
        });
      }
    }
  return links;
}

/** Where two spans meet across a longitudinal bulkhead (y), or null. */
function boundary(a: Span, b: Span): number | null {
  const one = (p: Span, q: Span): number | null => {
    if (p.side === "centre" && q.side === "port" && p.y === q.y) return p.y;
    if (p.side === "centre" && q.side === "starboard" && p.y === q.y)
      return -p.y;
    if (p.side === "port" && q.side === "starboard" && p.y === 0 && q.y === 0)
      return 0;
    return null;
  };
  return one(a, b) ?? one(b, a);
}

/**
 * Cells side by side (overlapping in x, their spans meeting at a
 * longitudinal bulkhead) with coal doors between them. The area is the
 * larger of what either cell declares, for the length they share.
 */
function crossesOf(hull: HullModel, cells: Cell[]): CrossLink[] {
  const out: CrossLink[] = [];
  for (let i = 0; i < cells.length; i += 1)
    for (let j = i + 1; j < cells.length; j += 1) {
      const a = cells[i];
      const b = cells[j];
      if (a.cross <= 0 && b.cross <= 0) continue;
      const sa = a.slice.span;
      const sb = b.slice.span;
      if (!sa || !sb) continue;
      const y = boundary(sa, sb);
      if (y === null) continue;
      const x0 = max(a.slice.xFrom, b.slice.xFrom);
      const x1 = min(a.slice.xTo, b.slice.xTo);
      if (x1 - x0 <= X_EPS) continue;
      const lenA = a.slice.xTo - a.slice.xFrom;
      const lenB = b.slice.xTo - b.slice.xFrom;
      const area = max(
        (a.cross * (x1 - x0)) / lenA,
        (b.cross * (x1 - x0)) / lenB
      );
      if (area <= 0) continue;
      const x = (x0 + x1) / 2;
      out.push({
        a: i,
        b: j,
        area,
        x,
        y,
        z: sectionAt(hull, x).zb + CROSS_DOOR_Z_M,
      });
    }
  return out;
}

/**
 * Full-breadth stand-ins over every stretch of wing and centre cells (for
 * the cut quantities that do not add up across a longitudinal bulkhead).
 */
function cutsOf(hull: HullModel, cells: Cell[]): Cell[] {
  const spanned = cells.filter((c) => c.slice.span);
  if (spanned.length === 0) return [];
  const xs = Array.from(
    new Set(spanned.flatMap((c) => [c.slice.xFrom, c.slice.xTo]))
  ).sort((p, q) => p - q);
  const out: Cell[] = [];
  for (let k = 0; k < xs.length - 1; k += 1) {
    const m = (xs[k] + xs[k + 1]) / 2;
    if (!spanned.some((c) => c.slice.xFrom < m && c.slice.xTo > m)) continue;
    out.push(
      makeCell(
        hullSlice(hull, xs[k], xs[k + 1]),
        -2,
        false,
        0,
        0,
        false,
        false,
        1
      )
    );
  }
  return out;
}

/** Every hull vertex of [xFrom, xTo] with the length of hull it stands for. */
function floorPoints(
  hull: HullModel,
  xFrom: number,
  xTo: number
): Float64Array {
  const s = hullSlice(hull, xFrom, xTo);
  const out: number[] = [];
  for (let i = 0; i < s.n; i += 1) {
    if (s.fullA[i] <= 0) continue;
    const dx =
      ((i < s.n - 1 ? s.xs[i + 1] : s.xs[i]) -
        (i > 0 ? s.xs[i - 1] : s.xs[i])) /
      2;
    if (dx <= 0) continue;
    for (let v = 0; v < s.nv; v += 1)
      out.push(s.xs[i], s.ys[i * s.nv + v], s.zs[i * s.nv + v], dx);
  }
  return Float64Array.from(out);
}

/** Earth z of the body's lowest hull vertex. */
function lowestZ(b: Body): number {
  const [nx, ny, nz] = upOf(b);
  const p = b.floorPts;
  let lo = Infinity;
  for (let k = 0; k < p.length; k += 4)
    lo = min(lo, b.z + nx * p[k] + ny * p[k + 1] + nz * p[k + 2]);
  return lo;
}

function makeBody(
  w: {
    spec: ShipSpec;
    hull: HullModel;
    mass: MassModel;
    doors?: readonly BulkheadDoor[];
  },
  part: Body["part"],
  cells: Cell[],
  boxes: Cell[]
): Body {
  let xFrom = Infinity;
  let xTo = -Infinity;
  for (const c of cells) {
    xFrom = min(xFrom, c.slice.xFrom);
    xTo = max(xTo, c.slice.xTo);
  }
  const light = massOf(w.mass, xFrom, xTo);
  // Her wreck's rest rule: per part after a break (`wreckParts`), else
  // `wreck`, else none (the 1.0 rest).
  const parts = w.spec.wreckParts;
  const rule =
    part === "bow" && parts?.bow
      ? parts.bow
      : part === "stern" && parts?.stern
        ? null
        : w.spec.wreck;
  return {
    part,
    xFrom,
    xTo,
    cells,
    boxes,
    all: cells.concat(boxes),
    links: linksOf(w.hull, cells),
    crosses: crossesOf(w.hull, cells),
    doors: doorLinks(w.doors, w.spec.compartments, cells),
    cuts: cutsOf(w.hull, cells),
    lightMass: light.mass,
    lightCx: light.cx,
    lightCy: w.spec.tcg ?? 0,
    lightCz: w.spec.kg,
    lightIyy: light.iyy,
    beam: w.spec.beam,
    depth: w.spec.depth,
    rho: w.spec.waterDensity ?? RHO,
    x: 0,
    y: 0,
    z: -w.spec.draught,
    pitch: 0,
    roll: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    wp: 0,
    wr: 0,
    wy: 0,
    gx: light.cx,
    gy: 0,
    gz: w.spec.kg,
    mass: light.mass,
    an: 0,
    alpha: 0,
    inflow: 0,
    netFlow: 0,
    flowAvg: Infinity,
    mode: "float",
    top: 0,
    bottom: 0,
    steadyFor: 0,
    frozen: false,
    contactP: [0, 0, 0],
    contactE: [0, 0, 0],
    contactT: 0,
    contactPitch: 0,
    restPitch: 0,
    restRoll: 0,
    contactD0: 0,
    seated: false,
    sternFirst: false,
    pivotDrag: w.spec.pivotDrag === true,
    floorPts: floorPoints(w.hull, xFrom, xTo),
    floorK: (light.mass * GRAV) / (2 * max(1, xTo - xFrom) * FLOOR_SINK_M),
    grounded: false,
    touchBow: false,
    touchStern: false,
    wreck: rule
      ? {
          rest: rule.restDeg * DEG,
          min: rule.minListDeg * DEG,
        }
      : null,
    capsize:
      part === "stern" && parts?.stern?.capsize
        ? parts.stern.restDeg * DEG
        : null,
    capsizeRate: (parts?.stern?.rollDegS ?? STERN_CAPSIZE_DEG_S) * DEG,
    floorN: 0,
    floorX: new Float64Array(0),
    floorF: new Float64Array(0),
    deckWater: null,
  };
}

/** A compartment's own walls: a bulkhead at an end unless it is the hull's. */
function wallAt(
  comps: readonly Compartment[],
  i: number,
  end: "aft" | "fwd"
): boolean {
  const c = comps[i];
  return comps.some((o, k) =>
    k === i
      ? false
      : end === "aft"
        ? abs(o.toX - c.fromX) < X_EPS
        : abs(o.fromX - c.toX) < X_EPS
  );
}

/**
 * Portholes as openings: each row in pieces at most PORTHOLE_PIECE_M long,
 * each piece in the outermost cell on its side at that x (the wing, if
 * there is one; the portholes are in its shell).
 */
function portholeOpenings(
  spec: ShipSpec,
  hull: HullModel
): { i: number; o: Cell["openings"][number] }[] {
  const out: { i: number; o: Cell["openings"][number] }[] = [];
  const comps = spec.compartments;
  for (const row of spec.portholes ?? []) {
    const sign = row.side === "port" ? 1 : -1;
    const cuts = new Set<number>([row.fromX, row.toX]);
    for (const c of comps)
      for (const x of [c.fromX, c.toX])
        if (x > row.fromX && x < row.toX) cuts.add(x);
    const xs = Array.from(cuts).sort((p, q) => p - q);
    for (let k = 0; k < xs.length - 1; k += 1) {
      const len = xs[k + 1] - xs[k];
      const parts = Math.ceil(len / PORTHOLE_PIECE_M - 1e-9);
      for (let p = 0; p < parts; p += 1) {
        const x = xs[k] + (len * (p + 0.5)) / parts;
        let best = -1;
        comps.forEach((c, ci) => {
          if (x < c.fromX || x > c.toX) return;
          if (!c.span) {
            if (best < 0) best = ci;
          } else if (c.span.side === row.side && !row.inboard) best = ci;
          else if (c.span.side === "centre" && (best < 0 || !comps[best].span))
            best = ci;
        });
        if (best < 0) continue;
        const z = row.followsSheer
          ? row.z + spec.sheerZ(x) - spec.sheerZ((row.fromX + row.toX) / 2)
          : row.z;
        out.push({
          i: best,
          o: {
            x,
            y: sign * hullHalfBreadth(hull, x, z),
            zLow: z - PORTHOLE_HEIGHT_M / 2,
            zHigh: z + PORTHOLE_HEIGHT_M / 2,
            area: (row.openM2PerM * len) / parts,
          },
        });
      }
    }
  }
  return out;
}

/**
 * The run's deck openings as cells' openings, by the What-if's options:
 * tight hatch covers (`tight`, or every hatch with `hatchesTight`) leak
 * nothing and hold HATCH_TIGHT_FAIL_FACTOR times the head; without
 * topside damage the vents and splits are left out. A hatch is numbered by its place
 * among the ship's own hatches (No. 1 first).
 */
/** The deck bay at ship x, or −1. */
function bay(deck: DeckWater | null, x: number): number {
  if (!deck) return -1;
  for (let i = 0; i < deck.n; i += 1)
    if (x >= deck.x0[i] && x < deck.x1[i]) return i;
  return -1;
}

function deckOpenings(
  spec: ShipSpec,
  list: readonly DeckOpening[],
  opts: SimOptions,
  deck: DeckWater | null
): { i: number; o: DeckCellOpening }[] {
  const out: { i: number; o: DeckCellOpening }[] = [];
  const hatchIds = (spec.deckOpenings ?? [])
    .filter((d) => d.kind === "hatch")
    .map((d) => d.id);
  let hatch = 0;
  for (const d of list) {
    if (d.kind === "hatch") hatch += 1;
    if (isTopsideDamage(d) && opts.topsideDamage === false) continue;
    const i = spec.compartments.findIndex((c) => c.id === d.compartmentId);
    if (i < 0) continue;
    const tight =
      d.kind === "hatch" && (d.tight === true || opts.hatchesTight === true);
    const failHead =
      d.failHeadM === undefined
        ? Infinity
        : d.failHeadM * (tight ? HATCH_TIGHT_FAIL_FACTOR : 1);
    const own = hatchIds.indexOf(d.id);
    out.push({
      i,
      o: {
        x: d.x,
        y: d.y,
        z: d.z,
        area: tight ? 0 : d.areaM2,
        failHead,
        failedArea: d.failedAreaM2 ?? d.areaM2,
        failed: false,
        openT: d.t ?? 0,
        hatch: d.kind === "hatch" ? (own >= 0 ? own + 1 : hatch) : 0,
        // A split is in the side shell, under the deck edge: the deck's
        // water runs past it; hatches and vents stand in it.
        onDeck: d.kind !== "split",
        bay: bay(deck, d.x),
        row:
          deck !== null &&
          abs(d.y) < 1e-6 &&
          bay(deck, d.x) >= 0 &&
          abs(deck.xm[bay(deck, d.x)] - d.x) < 0.02,
      },
    });
  }
  return out;
}

function buildWorld(
  spec: ShipSpec,
  given: readonly RunOpening[],
  opts: SimOptions
): World {
  // Hull openings, and deck openings: the run's own if it has any, else
  // the ship's.
  const openings: Opening[] = [];
  const deckGiven: DeckOpening[] = [];
  for (const o of given)
    if (isDeckOpening(o)) deckGiven.push(o);
    else openings.push(o);
  const deckList = deckGiven.length > 0 ? deckGiven : (spec.deckOpenings ?? []);
  const hull = buildHull(spec);
  const whole = hullSlice(hull, hull.xMin, hull.xMax);
  const fullArea = new Float64Array(hull.n);
  for (let i = 0; i < hull.n; i += 1) {
    // Stations of the whole slice are the hull's own (plus none between).
    let k = 0;
    let best = Infinity;
    for (let j = 0; j < whole.n; j += 1) {
      const d = abs(whole.xs[j] - hull.xs[i]);
      if (d < best) {
        best = d;
        k = j;
      }
    }
    fullArea[i] = whole.fullA[k];
  }
  const boxSlices = spec.superstructure.map((s) =>
    boxSlice(hull, spec.sheerZ, s.fromX, s.toX, s.topZ, s.halfBreadthM)
  );
  const mass = buildMass(spec, hull, fullArea, boxSlices);
  const cells = spec.compartments.map((c, i) =>
    makeCell(
      hullSlice(hull, c.fromX, c.toX, c.span),
      i,
      false,
      c.aftBulkheadTopZ,
      c.fwdBulkheadTopZ,
      wallAt(spec.compartments, i, "aft"),
      wallAt(spec.compartments, i, "fwd"),
      c.permeability ?? PERMEABILITY[c.kind],
      c.crossFlowM2 ?? 0
    )
  );
  // The pumps: her own (`pumpsM3s`, every hull space, any depth) or the
  // 1.0 ones (the machinery spaces, under PUMP_DEPTH_M).
  const ownPumps = spec.pumpsM3s !== undefined;
  spec.compartments.forEach((c, i) => {
    cells[i].pumped =
      c.pumped ?? (ownPumps || c.kind === "boiler" || c.kind === "engine");
    if (c.burstM2 !== undefined) cells[i].burst = c.burstM2;
  });
  const boxes = boxSlices.map((s) =>
    makeCell(s, -1, true, 0, 0, false, false, BOX_PERMEABILITY)
  );
  const doors = openDoors(
    spec.doors,
    opts.doorsClosed === true,
    spec.cause !== "mine" || holdsRealMine(spec, openings)
  );
  const ctx = { spec, hull, mass, doors };
  const body = makeBody(ctx, "whole", cells, boxes);
  // Green water on her open deck: the whole hull's (a break ends it).
  body.deckWater = makeDeckWater(spec, hull);

  // The grounding's strips, each once (a ship's real run may hold them).
  const hullOpenings = opts.shoal
    ? openings.concat(
        (spec.shoalOpenings ?? []).filter((o) => !openings.includes(o))
      )
    : openings;
  const all = hullOpenings
    .map((o) => ({
      t: o.t ?? 0,
      i: spec.compartments.findIndex((c) => c.id === o.compartmentId),
      o: cellOpening(hull, o),
    }))
    .filter((p) => p.i >= 0);
  const pending = all.filter((p) => p.t <= 0).map((p) => ({ i: p.i, o: p.o }));
  const timed = all.filter((p) => p.t > 0).sort((a, b) => a.t - b.t);
  // A ship with her own hits: each later time her holes open is a torpedo
  // (each hit's pieces share its time), numbered on from the first event's.
  const hitTimes = spec.torpedo
    ? [...new Set(timed.map((p) => p.t))].sort((a, b) => a - b)
    : [];
  const nextHit = all.some((p) => p.t <= 0) ? 2 : 1;
  if (opts.portholesOpen ?? true) pending.push(...portholeOpenings(spec, hull));
  // Hull openings and portholes at or forward of `ram.fromX` see the ram head.
  const ramX = spec.headway?.ram?.fromX;
  if (ramX !== undefined)
    for (const p of pending.concat(timed)) if (p.o.x >= ramX) p.o.ram = true;
  const pendingDeck = deckOpenings(spec, deckList, opts, body.deckWater);
  const storm = stormOf(spec) ?? null;

  // Landmarks for the geometric events.
  const fwdBox = spec.superstructure
    .filter((s) => s.toX >= hull.xMax - 1)
    .sort((a, b) => b.toX - a.toX)[0];
  const longest = spec.superstructure
    .slice()
    .sort((a, b) => b.toX - b.fromX - (a.toX - a.fromX))[0];
  const boat = spec.decks.find((d) => d.name === "Boat");
  const sheerAt = (x: number) => spec.sheerZ(x) - spec.depth;
  const w: World = {
    spec,
    hull,
    mass,
    bodies: [body],
    compCapacity: cells.map((c) => c.cap),
    realT: 0,
    t: 0,
    nextFrameT: 0,
    fast: false,
    broken: false,
    breakX: null,
    brokeAtT: null,
    sankAtT: null,
    flickerAtT: null,
    lightsOut: false,
    steadyFor: 0,
    steady: false,
    scriptedNext: 0,
    // Counted from her first hit when it comes late (the U-boat alone).
    scriptedShift:
      spec.scriptedFromFirstHit && all.length > 0
        ? min(...all.map((p) => p.t))
        : 0,
    funnelFallen: spec.funnels.map(() => false),
    fired: new Set(),
    events: [{ t: 0, realT: 0, kind: "collision" }],
    frames: [],
    done: false,
    outcome: "floated",
    endT: opts.endT ?? END_T,
    girderState: { hog: new Float64Array(0), worst: 0, worstX: 0, worstHog: 0 },
    strength: strengthProfile(hull.xs, spec.compartments),
    settleLeft: SETTLE_S,
    pending,
    timed,
    hitTimes,
    nextHit,
    headway: headwayOf(spec.headway, opts),
    wayLost: false,
    wayLostAt: null,
    rho: spec.waterDensity ?? RHO,
    sea:
      pendingDeck.length > 0
        ? { storm, scale: STORM_SCALE[opts.storm ?? "real"], t: 0 }
        : null,
    deck: pendingDeck.map((p) => p.o),
    pendingDeck,
    relock: (spec.storm?.groups ?? []).flatMap((g, i) =>
      g.x === undefined || g.y === undefined ? [i] : []
    ),
    bowUnderRealT: null,
    descentScale: spec.descentTimeScale ?? DESCENT_TIME_SCALE,
    pumps: spec.pumpsM3s ?? PUMP_M3S,
    pumpDepth: ownPumps ? Infinity : PUMP_DEPTH_M,
    doors,
    probe: opts.probe,
    forecastle: fwdBox
      ? { x: (fwdBox.fromX + fwdBox.toX) / 2, z: fwdBox.topZ }
      : null,
    bridge:
      longest && boat
        ? { x: longest.toX, z: boat.z + sheerAt(longest.toX) }
        : null,
  };
  // A placeholder until she has settled, so a track is never empty.
  w.frames.push(frame(w));
  return w;
}

function emit(w: World, kind: SimEventKind, index?: number): void {
  w.events.push(
    index === undefined
      ? { t: w.t, realT: w.realT, kind }
      : { t: w.t, realT: w.realT, kind, index }
  );
}

function once(w: World, key: string, kind: SimEventKind, index?: number): void {
  if (w.fired.has(key)) return;
  w.fired.add(key);
  emit(w, kind, index);
}

/** Flickering lights: a fixed pattern of dips, from a hash of the time. */
function flicker(t: number): number {
  const k = floor(t * 6);
  const h = (((k * 2654435761) >>> 0) % 1000) / 1000;
  return h < 0.3 ? 0.15 + h : 0.85 + 0.15 * h;
}

function power(w: World): number {
  if (w.lightsOut) return 0;
  if (w.flickerAtT === null) return 1;
  return flicker(w.t);
}

function poseOf(b: Body): BodyPose {
  return {
    part: b.part,
    x: b.x,
    y: b.y,
    z: b.z,
    pitch: b.pitch,
    roll: b.roll,
    yaw: b.yaw,
  };
}

function frame(w: World): SimFrame {
  const water = w.compCapacity.map(() => 0);
  let total = 0;
  for (const b of w.bodies) {
    for (const c of b.cells) {
      water[c.comp] += c.water;
      total += c.water;
    }
    for (const c of b.boxes) total += c.water;
  }
  const lead = w.bodies.find((b) => b.part === "stern") ?? w.bodies[0];
  // Her deck's green water while she is whole (the liners have none).
  const deck = w.broken ? null : w.bodies[0].deckWater;
  return {
    t: w.t,
    realT: w.realT,
    bodies: w.bodies.map(poseOf),
    water: water.map((v, i) =>
      w.compCapacity[i] > 0 ? min(1, v / w.compCapacity[i]) : 0
    ),
    waterAboardT: (w.rho * total) / 1000,
    trimDeg: lead.pitch / DEG,
    listDeg: lead.roll / DEG,
    power: power(w),
    groundedParts: w.bodies
      .filter((b) => b.grounded || b.mode === "landing" || b.mode === "landed")
      .map((b) => b.part),
    ...(deck ? { deckWater: Array.from(deck.vol) } : {}),
  };
}

const splitBuf = new Float64Array(R_SIZE);

/** Split the whole ship at x into stern and bow. */
function breakUp(w: World, xRaw: number): void {
  const whole = w.bodies[0];
  let x = xRaw;
  for (const c of whole.cells) {
    if (abs(c.slice.xTo - x) < BREAK_SNAP_M && c.fwdWall) x = c.slice.xTo;
  }
  const [nx, ny, nz] = upInShip(whole.pitch, whole.roll);
  const sternCells: Cell[] = [];
  const bowCells: Cell[] = [];
  for (const c of whole.cells) {
    if (c.slice.xTo <= x + 1e-6) sternCells.push(c);
    else if (c.slice.xFrom >= x - 1e-6) bowCells.push(c);
    else {
      const len = c.slice.xTo - c.slice.xFrom;
      const aft = makeCell(
        hullSlice(w.hull, c.slice.xFrom, x, c.slice.span),
        c.comp,
        false,
        c.aftTopZ,
        c.fwdTopZ,
        c.aftWall,
        false,
        c.perm,
        (c.cross * (x - c.slice.xFrom)) / len
      );
      const fwd = makeCell(
        hullSlice(w.hull, x, c.slice.xTo, c.slice.span),
        c.comp,
        false,
        c.aftTopZ,
        c.fwdTopZ,
        false,
        c.fwdWall,
        c.perm,
        (c.cross * (c.slice.xTo - x)) / len
      );
      if (c.water > 0) {
        let aftWater: number;
        if (c.water >= c.cap) aftWater = aft.cap;
        else {
          integrateSlice(aft.slice, nx, ny, nz, whole.z - c.level, splitBuf);
          aftWater = min(c.water, splitBuf[R_VOL] * c.perm, aft.cap);
        }
        aft.water = aftWater;
        fwd.water = min(fwd.cap, c.water - aftWater);
        aft.level = c.level;
        fwd.level = c.level;
      }
      aft.burst = c.burst;
      fwd.burst = c.burst;
      for (const o of c.openings) (o.x < x ? aft : fwd).openings.push(o);
      for (const o of c.deck) (o.x < x ? aft : fwd).deck.push(o);
      sternCells.push(aft);
      bowCells.push(fwd);
    }
  }
  const sternBoxes: Cell[] = [];
  const bowBoxes: Cell[] = [];
  w.spec.superstructure.forEach((s, i) => {
    const c = whole.boxes[i];
    if (s.toX <= x) sternBoxes.push(c);
    else if (s.fromX >= x) bowBoxes.push(c);
    else {
      const aft = makeCell(
        boxSlice(w.hull, w.spec.sheerZ, s.fromX, x, s.topZ, s.halfBreadthM),
        -1,
        true,
        0,
        0,
        false,
        false,
        BOX_PERMEABILITY
      );
      const fwd = makeCell(
        boxSlice(w.hull, w.spec.sheerZ, x, s.toX, s.topZ, s.halfBreadthM),
        -1,
        true,
        0,
        0,
        false,
        false,
        BOX_PERMEABILITY
      );
      const f = c.cap > 0 ? c.water / c.cap : 0;
      aft.water = f * aft.cap;
      fwd.water = f * fwd.cap;
      sternBoxes.push(aft);
      bowBoxes.push(fwd);
    }
  });
  // The broken face is open to the sea, and the hull either side of it is
  // torn (shell, decks, bulkheads as the halves hinge and grind): every cell
  // with an end within BREAK_DAMAGE_M gets an opening there, the nearer the
  // larger, the cells at the face the whole BREAK_OPEN_FRACTION.
  const faceArea = (at: number) => {
    const tmp = hullSlice(w.hull, at - 0.5, at + 0.5);
    return tmp.fullA[0] * BREAK_OPEN_FRACTION;
  };
  const tear = (cell: Cell, end: number, stern: boolean) => {
    const d = abs(end - x);
    if (d > BREAK_DAMAGE_M) return;
    const sec = sectionAt(w.hull, end);
    let area = faceArea(end) * (1 - d / BREAK_DAMAGE_M);
    const sl = cell.slice;
    if (sl.span) {
      // A wing or centre cell: its share of the section at that end.
      const own = stern ? sl.fullA[sl.n - 1] : sl.fullA[0];
      const full = hullSlice(w.hull, end - 0.5, end + 0.5).fullA[0];
      area *= full > 0 ? min(1, own / full) : 0;
    }
    cell.openings.push({
      // Half a metre inside the cell (stern cells lie aft of their end).
      x: end + (stern ? -0.5 : 0.5),
      y: sl.cy,
      zLow: sec.zb,
      zHigh: sec.zt,
      area,
    });
  };
  for (const c of sternCells) tear(c, c.slice.xTo, true);
  for (const c of bowCells) tear(c, c.slice.xFrom, false);
  // No bulkhead at the broken face.
  for (const c of sternCells)
    if (abs(c.slice.xTo - x) < X_EPS) c.fwdWall = false;
  for (const c of bowCells)
    if (abs(c.slice.xFrom - x) < X_EPS) c.aftWall = false;

  const ctx = { spec: w.spec, hull: w.hull, mass: w.mass, doors: w.doors };
  const parts = [
    makeBody(ctx, "stern", sternCells, sternBoxes),
    makeBody(ctx, "bow", bowCells, bowBoxes),
  ];
  const c = cos(whole.pitch);
  const s = sin(whole.pitch);
  for (const p of parts) {
    p.x = whole.x;
    p.y = whole.y;
    p.z = whole.z;
    p.pitch = whole.pitch;
    p.roll = whole.roll;
    p.yaw = whole.yaw;
    p.wp = whole.wp;
    p.wr = whole.wr;
    // Velocity of the part's own centre: v + ω × r in the x–z plane.
    const dx = p.lightCx - whole.gx;
    const dz = p.lightCz - whole.gz;
    const rx = c * dx + s * dz;
    const rz = -s * dx + c * dz;
    p.vx = whole.vx + whole.wp * rz;
    p.vz = whole.vz - whole.wp * rx;
    updateBounds(p);
  }
  w.bodies = parts;
  w.broken = true;
  w.breakX = x;
  w.brokeAtT = w.t;
}

function landmarkUnder(
  b: Body,
  mark: { x: number; z: number } | null
): boolean {
  return mark !== null && earthZ(b, mark.x, 0, mark.z) < 0;
}

/** Events that read the ship's pose and water. */
function watch(w: World): void {
  const spec = w.spec;
  const wholeAfloat =
    !w.broken && w.bodies[0].mode === "float" && w.bodies[0].top > -0.5;
  // Historical events while she is afloat and in one piece.
  if (wholeAfloat) {
    const scripted = spec.scripted;
    while (
      w.scriptedNext < scripted.length &&
      scripted[w.scriptedNext].t + w.scriptedShift <= w.t
    ) {
      const e = scripted[w.scriptedNext];
      emit(w, e.kind, e.index);
      w.scriptedNext += 1;
      if (
        e.kind === "boat-lowered" &&
        !scripted.slice(w.scriptedNext).some((n) => n.kind === "boat-lowered")
      )
        emit(w, "last-boat", e.index);
    }
    const whole = w.bodies[0];
    if (landmarkUnder(whole, w.forecastle)) once(w, "fc", "forecastle-under");
    if (landmarkUnder(whole, w.bridge)) once(w, "br", "bridge-under");
    if (
      w.flickerAtT === null &&
      (whole.pitch / DEG >= LIGHTS_FLICKER_TRIM_DEG ||
        w.funnelFallen.some(Boolean))
    ) {
      w.flickerAtT = w.t;
      emit(w, "lights-flicker");
    }
    // The dynamos: the aftmost engine space flooded deep enough.
    const comps = spec.compartments;
    let dyn = -1;
    for (let i = 0; i < comps.length; i += 1)
      if (comps[i].kind === "engine") {
        dyn = i;
        break;
      }
    if (dyn >= 0 && !w.lightsOut) {
      const cell = whole.cells[dyn];
      if (cell.water > 0 && cell.level - cell.zMin >= DYNAMO_FLOOD_M) {
        w.lightsOut = true;
        emit(w, "lights-out");
      }
    }
  }
  // Funnels: base well under, or the body too steep for the stays.
  spec.funnels.forEach((f, i) => {
    if (w.funnelFallen[i] || f.falls === false) return;
    const b = w.bodies.find((p) => f.x >= p.xFrom && f.x <= p.xTo);
    if (!b || b.mode !== "float") return;
    if (
      earthZ(b, f.x, 0, f.baseZ) < -FUNNEL_UNDER_M ||
      abs(b.pitch) / DEG > FUNNEL_STAY_LIMIT_DEG + FUNNEL_STAY_STEP_DEG * i
    ) {
      w.funnelFallen[i] = true;
      emit(w, "funnel-falls", i);
    }
  });
}

function under(w: World, b: Body): void {
  if (b.part === "bow") once(w, "bow-under", "bow-under");
  else if (b.part === "stern") once(w, "stern-under", "stern-under");
  else {
    once(w, "bow-under", "bow-under");
    once(w, "stern-under", "stern-under");
  }
  if (w.bodies.every((p) => p.mode !== "float")) w.sankAtT = w.t;
}

/** The cell that now holds compartment i at ship-frame x (after a break too). */
function cellAt(w: World, i: number, x: number): Cell | null {
  let best: Cell | null = null;
  for (const b of w.bodies)
    for (const c of b.cells) {
      if (c.comp !== i) continue;
      if (x >= c.slice.xFrom - X_EPS && x <= c.slice.xTo + X_EPS) return c;
      best = best ?? c;
    }
  return best;
}

/** Floor contact afloat: the first touch of each end is its landing. */
function touched(w: World, b: Body): void {
  if (!b.grounded) return;
  w.fast = true;
  w.wayLost = true;
  const bow = b.part === "bow" || (b.part === "whole" && b.touchBow);
  const stern = b.part === "stern" || (b.part === "whole" && b.touchStern);
  if (bow) once(w, "bow-lands", "bow-lands");
  if (stern) once(w, "stern-lands", "stern-lands");
}

/** R22 (`spec.pivotDrag`): a whole hull landing on its bow swings down. */
function swingsDown(b: Body): boolean {
  return b.pivotDrag && b.part === "whole" && !b.sternFirst;
}

function step(w: World): void {
  if (w.settleLeft > 0) {
    settle(w);
    return;
  }
  const spec = w.spec;
  while (w.timed.length > 0 && w.timed[0].t <= w.t) {
    const p = w.timed.shift() as World["timed"][number];
    cellAt(w, p.i, p.o.x)?.openings.push(p.o);
  }
  // A torpedo that lands while some part of her still floats.
  while (w.hitTimes.length > 0 && w.hitTimes[0] <= w.t) {
    w.hitTimes.shift();
    if (w.bodies.some((b) => b.mode === "float"))
      emit(w, "torpedo-hit", w.nextHit);
    w.nextHit += 1;
  }
  const compressed = w.bodies.every((b) => b.mode !== "float");
  const dt = w.steady
    ? SIM_STEP_S
    : compressed
      ? FAST_STEP_S * w.descentScale
      : w.fast
        ? FAST_STEP_S
        : SIM_STEP_S;
  // Steady way lasts until she goes under (the bow first).
  if (w.wayLostAt === null && w.fired.has("bow-under")) w.wayLostAt = w.realT;
  const way = headwayRun(w.headway, w.realT, w.realT + dt, w.wayLostAt);
  // Along her heading (`turn`, 1.4), held once she has gone under.
  const mid = w.realT + dt / 2;
  const psi = headingAt(
    w.headway,
    w.wayLostAt === null ? mid : min(mid, w.wayLostAt)
  );
  const wayX = psi === 0 ? way : way * cos(psi);
  const wayY = psi === 0 ? 0 : way * sin(psi);
  // The ram head on her forward openings (1.4): her speed now.
  const ram = w.headway?.ram;
  if (ram) {
    const u = w.wayLost ? 0 : speedAt(w.headway, w.realT, {}, w.wayLostAt);
    for (const b of w.bodies) b.ramHead = (ram.cp * u * u) / (2 * GRAV);
  }
  if (w.bowUnderRealT === null && w.fired.has("bow-under"))
    w.bowUnderRealT = w.realT;
  if (w.sea) {
    w.sea.t = w.realT;
    relockGroups(w);
    rideFor(w, dt);
  }
  // Steady way carries a hull that has settled too (her engine still
  // turns); decaying way (1.1) never needed it.
  if (
    way !== 0 &&
    !w.wayLost &&
    w.headway !== undefined &&
    w.headway.halfLifeS === undefined
  )
    for (const b of w.bodies)
      if (b.mode === "float" && (b.frozen || w.steady)) {
        b.x += wayX;
        b.y += wayY;
      }
  if (!w.steady) {
    for (const b of w.bodies) {
      if (b.mode === "float" && b.frozen) continue;
      // Her way through the water, until she touches the floor.
      if (
        way !== 0 &&
        !w.wayLost &&
        (b.mode === "float" || b.mode === "fall")
      ) {
        b.x += wayX;
        b.y += wayY;
      }
      if (b.mode === "float") {
        const girderNow = !w.broken;
        stepFloat(
          b,
          dt,
          girderNow,
          DRIFT_MPS,
          w.lightsOut ? 0 : w.pumps,
          -spec.seaDepthM,
          w.sea,
          w.pumpDepth
        );
        touched(w, b);
        updateBounds(b);
        if (girderNow) {
          girder(
            b,
            w.mass,
            spec.girder.hogMaxNm,
            spec.girder.sagMaxNm,
            w.strength,
            w.girderState
          );
        }
        if (
          b.part === "whole" &&
          b.cells.filter((c) => c.slice.xFrom >= 0).every((c) => c.zMax < 0)
        )
          once(w, "bow-under", "bow-under");
        if (b.top < -0.5) {
          b.mode = "fall";
          under(w, b);
        }
      } else if (b.mode === "fall") {
        if (stepFall(b, dt, -spec.seaDepthM)) {
          w.wayLost = true;
          // An intact hull is both: it lands as one (unless an end already
          // touched while she was afloat).
          if (b.part !== "stern") once(w, "bow-lands", "bow-lands");
          // R22: a hull swinging down about its bow lands its stern later.
          if (b.part !== "bow" && !swingsDown(b))
            once(w, "stern-lands", "stern-lands");
        }
      } else if (b.mode === "landing") {
        stepLanding(b, dt);
        if (swingsDown(b) && sternDown(b, -spec.seaDepthM))
          once(w, "stern-lands", "stern-lands");
      }
    }
  }
  // Her heading while she floats (1.4), held from when she went under, as
  // her way's; a body under turns by the descent's own yaw from there.
  if (w.headway?.turn) {
    const end = w.realT + dt;
    const yaw = headingAt(
      w.headway,
      w.wayLostAt === null ? end : min(end, w.wayLostAt)
    );
    for (const b of w.bodies) if (b.mode === "float") turnTo(b, yaw);
  }
  w.realT += dt;
  w.t += compressed ? dt / w.descentScale : dt;
  if (!w.broken && w.girderState.worst >= 1 && w.bodies[0].mode === "float") {
    breakUp(w, w.girderState.worstX);
    emit(w, "breakup");
    if (!w.lightsOut) {
      w.lightsOut = true;
      emit(w, "lights-out");
    }
  }
  watch(w);
  for (const o of w.deck)
    if (o.failed && o.hatch > 0 && !w.fired.has(`hatch${o.hatch}`))
      once(w, `hatch${o.hatch}`, "hatch-fails", o.hatch);
  const whole = w.bodies[0];
  if (
    !w.fast &&
    (w.broken ||
      w.flickerAtT !== null ||
      abs(whole.pitch) > 8 * DEG ||
      (w.t > 120 && abs(whole.wp) > 0.003))
  )
    w.fast = true;
  // Floating steady? Each floating body freezes once it has stopped moving
  // and taking water; when nothing is left moving the run holds its pose
  // to the end.
  // Not in a storm: the next wave over her deck can always come. Not while
  // a torpedo is still to come (`spec.torpedo.finisher`): a frozen hull
  // would never take its water.
  if (
    !w.steady &&
    w.t > 1800 &&
    !(w.sea && w.sea.storm) &&
    w.timed.length === 0
  ) {
    for (const b of w.bodies) {
      if (b.mode !== "float" || b.frozen) continue;
      // A torpedo's holes (tens of m²) trade water with the sea in a slow
      // cycle of tiny steps around her level: for a torpedo ship the
      // average also counts (the iceberg ships keep the 1.0 test exactly).
      const still =
        (abs(b.netFlow) < STEADY_INFLOW_M3S ||
          ((w.spec.cause === "torpedo" || w.spec.cause === "mine") &&
            abs(b.flowAvg) < STEADY_INFLOW_M3S)) &&
        abs(b.wp) < 1e-5 &&
        abs(b.wr) < (w.spec.cause === "mine" ? STEADY_MINE_ROLL_RADS : 1e-5) &&
        abs(b.vz) < 1e-3;
      b.steadyFor = still ? b.steadyFor + dt : 0;
      if (b.steadyFor >= STEADY_HOLD_S) b.frozen = true;
      // Settled (1.5): only a ship whose U-boat comes back (the Carpathia's
      // forward peak trades water in a cycle too slow for the rate test);
      // every other ship keeps the rate test exactly.
      else if (w.spec.torpedo?.finisher && settled(b, w.t)) b.frozen = true;
    }
    if (
      w.bodies.some((b) => b.frozen) &&
      w.bodies.every((b) => b.frozen || b.mode === "landed")
    ) {
      w.steady = true;
      emit(w, "floating-steady");
    }
  }
  if (w.t + 1e-9 >= w.nextFrameT) {
    w.frames.push(frame(w));
    const interval = w.fast && !w.steady ? FAST_FRAME_S : SLOW_FRAME_S;
    while (w.nextFrameT <= w.t + 1e-9) w.nextFrameT += interval;
  }
  if (w.probe)
    w.probe({
      t: w.t,
      bodies: w.bodies,
      girderUse: w.broken ? 0 : w.girderState.worst,
      girderX: w.girderState.worstX,
      girderHogNm: w.girderState.worstHog,
      girderHog: w.girderState.hog,
      stationX: w.hull.xs,
      lowestZ: w.bodies.reduce((lo, b) => min(lo, lowestZ(b)), Infinity),
    });
  if (w.bodies.every((b) => b.mode === "landed")) {
    w.done = true;
    w.outcome = "sank";
  } else if (
    spec.shelter &&
    w.t >= spec.shelter.t &&
    !w.broken &&
    whole.mode === "float"
  ) {
    // Still afloat and whole when she would reach shelter: she made it.
    emit(w, "sheltered");
    w.done = true;
    w.outcome = "floated";
  } else if (w.t >= w.endT) {
    w.done = true;
    w.outcome = w.bodies.some((b) => b.mode === "float") ? "floated" : "sank";
  }
  if (w.done && w.frames[w.frames.length - 1].t < w.t) w.frames.push(frame(w));
}

export interface SimRunner {
  /** Step for up to `budgetMs` of wall time; true once the run is done. */
  advance(budgetMs: number): boolean;
  readonly done: boolean;
  /** 0..1, roughly how far the run has got. */
  progress(): number;
  /** The track so far (complete once done). */
  track(): SimTrack;
}

/**
 * Re-lock each wave group of hers onto the crest where she really is,
 * `GROUP_RELOCK_S` before its time: her own path from here (her position,
 * her way and surge, the drift), not the prediction `stormOf` made before
 * the run. Only while she floats whole; else the prediction stands.
 */
function relockGroups(w: World): void {
  const sea = w.sea;
  const raw = w.spec.storm?.groups;
  if (!sea || !sea.storm || !raw || w.relock.length === 0) return;
  const b = w.bodies[0];
  const now = w.realT;
  const due = w.relock.filter((i) => raw[i].t - GROUP_RELOCK_S <= now);
  if (due.length === 0) return;
  w.relock = w.relock.filter((i) => !due.includes(i));
  if (w.broken || b.mode !== "float") return;
  const x0 = b.x;
  const y0 = b.y;
  const vx = b.vx;
  const path = (t: number): readonly [number, number] => [
    x0 + vx * (t - now) + headwayRun(w.headway, now, t, w.wayLostAt),
    y0 + DRIFT_MPS * (t - now),
  ];
  const groups = (sea.storm.groups ?? []).slice();
  for (const i of due)
    groups[i] = (lockGroups({ ...sea.storm, groups: [raw[i]] }, path).groups ??
      [])[0];
  sea.storm = { ...sea.storm, groups };
}

/** Ride samples per step: heave, pitch, roll for each deck sample. */
const rideBuf = new Float64Array(3 * 64);
const rideOne = new Float64Array(3);

/**
 * Her ride on the waves (`waveRide`) at each of this step's deck samples,
 * for the deck openings (`DeckSea.ride`): only while she floats whole,
 * weighted by `rideWeight` (fading once her bow is under).
 */
function rideFor(w: World, dt: number): void {
  const sea = w.sea as DeckSea;
  sea.rideN = 0;
  const b = w.bodies[0];
  const storm = sea.storm;
  if (!storm || w.broken || b.mode !== "float") return;
  const n = max(1, Math.round(dt / DECK_SAMPLE_S));
  if (3 * n > rideBuf.length) return;
  for (let j = 0; j < n; j += 1) {
    const ts = w.realT + ((j + 0.5) * dt) / n;
    const k = rideWeight(ts, w.bowUnderRealT);
    if (k <= 0) {
      rideBuf[3 * j] = 0;
      rideBuf[3 * j + 1] = 0;
      rideBuf[3 * j + 2] = 0;
      continue;
    }
    waveRide(storm, sea.scale, b.x, b.y, w.spec, ts, rideOne);
    rideBuf[3 * j] = k * rideOne[0];
    rideBuf[3 * j + 1] = k * rideOne[1];
    rideBuf[3 * j + 2] = k * rideOne[2];
  }
  sea.ride = rideBuf;
  sea.rideN = n;
}

function trackOf(w: World): SimTrack {
  return {
    frames: w.frames,
    events: w.events,
    outcome: w.outcome,
    sankAtT: w.sankAtT,
    brokeAtT: w.brokeAtT,
    breakX: w.breakX,
    endT: w.t,
    ...(w.sea?.storm ? { storm: w.sea.storm, stormScale: w.sea.scale } : {}),
  };
}

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function createSimRunner(
  spec: ShipSpec,
  openings: readonly RunOpening[],
  opts: SimOptions = {}
): SimRunner {
  let world: World | null = null;
  const runner: SimRunner = {
    advance(budgetMs: number) {
      const start = now();
      if (!world) {
        world = buildWorld(spec, openings, opts);
        if (now() - start >= budgetMs) return false;
      }
      const w = world;
      while (!w.done) {
        step(w);
        if (now() - start >= budgetMs) break;
      }
      return w.done;
    },
    get done() {
      return world?.done ?? false;
    },
    progress() {
      if (!world) return 0;
      if (world.done) return 1;
      // A run that ends in shelter ends then.
      return min(0.99, world.t / min(world.endT, spec.shelter?.t ?? Infinity));
    },
    track() {
      if (!world) world = buildWorld(spec, openings, opts);
      return trackOf(world);
    },
  };
  return runner;
}

/**
 * The steady test's second way (1.5): her pose has stayed inside a tiny
 * box (STEADY_POSE_DEG, STEADY_POSE_M) for STEADY_POSE_S with the averaged
 * inflow small, though the step-by-step rates still flicker (a small
 * flooded peak trading water with the sea in a slow cycle).
 */
function settled(b: Body, t: number): boolean {
  if (!(abs(b.flowAvg) < STEADY_INFLOW_M3S)) {
    b.poseBox = undefined;
    return false;
  }
  const pose: [number, number, number] = [b.pitch, b.roll, b.z];
  const box = b.poseBox;
  if (box) {
    for (let i = 0; i < 3; i += 1) {
      box.lo[i] = min(box.lo[i], pose[i]);
      box.hi[i] = max(box.hi[i], pose[i]);
    }
  }
  const deg = STEADY_POSE_DEG * DEG;
  if (
    !box ||
    box.hi[0] - box.lo[0] >= deg ||
    box.hi[1] - box.lo[1] >= deg ||
    box.hi[2] - box.lo[2] >= STEADY_POSE_M
  ) {
    b.poseBox = { t, lo: [...pose], hi: [...pose] };
    return false;
  }
  return t - box.t >= STEADY_POSE_S;
}

/** The whole run at once. */
export function simulate(
  spec: ShipSpec,
  openings: readonly RunOpening[],
  opts: SimOptions = {}
): SimTrack {
  const runner = createSimRunner(spec, openings, opts);
  runner.advance(Infinity);
  return runner.track();
}
