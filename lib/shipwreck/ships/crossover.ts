import { whatIfOpenings } from "../sim/run";
import {
  hullOpenings,
  type Compartment,
  type DeckOpening,
  type Opening,
  type ScriptedEvent,
  type ShipSpec,
  type TorpedoSpec,
} from "./types";

/**
 * Any ship in any wreck (1.14): `crossover(host, story)` is the host ship
 * (her hull, rooms, mass, paint, model, decks, portholes and doors) put
 * into another ship's story (its sea, place, time, weather and what opened
 * the hull). The story's damage is moved onto her by where it was along
 * the hull (the same share of her length from midships), the same side,
 * and the same height measured from her waterline (under water: as a
 * share of her draught; above it: of her freeboard). Areas stay as they
 * were (a torpedo's hole is the same size in any ship). From there the
 * sim is the same physics as every ship's: she may sink faster, slower or
 * not at all.
 *
 * Rules a story carries that were fitted to its own ship (a wreck's rest
 * on the floor, the Poseidon's box flood, the Fitzgerald's stern roll)
 * stay with that ship: a crossover's wreck keeps the pose it lands in.
 */
export function crossover(host: ShipSpec, story: ShipSpec): ShipSpec {
  if (host.id === story.id) return host;
  const map = mapper(host, story);
  const boxed = host.superstructure.map((b, k) =>
    b.id ? b : { ...b, id: `box-${k + 1}` }
  );
  const withBoxes: ShipSpec = { ...host, superstructure: boxed };
  const moveOpening = (o: Opening): Opening =>
    map.opening(o, withBoxes.superstructure);

  // The grounding strips first (a storm's real run names some of them by
  // identity: `whatIfRealIds`).
  const shoalMap = new Map<Opening, Opening>();
  for (const o of story.shoalOpenings ?? []) shoalMap.set(o, moveOpening(o));
  // A mine's hole goes into her main room there (a What if offers only
  // main rooms, and her real spot must be one: `mineOpenings`).
  const realNight = story.realNight.map(
    (o) =>
      shoalMap.get(o) ??
      (story.cause === "mine"
        ? map.opening(o, withBoxes.superstructure, true)
        : moveOpening(o))
  );

  const spec: ShipSpec = {
    ...withBoxes,
    story: story.id,
    // The story's sea, place and time.
    seaDepthM: story.seaDepthM,
    clockStartS: story.clockStartS,
    cause: story.cause,
    realNight,
    scripted: scriptedFor(host, story),
    preRollS: story.preRollS,
    timelineTail: story.timelineTail,
    waterDensity: story.waterDensity,
    storm: story.storm,
    seabed: story.seabed,
    shelter: story.shelter,
    descentTimeScale: story.descentTimeScale,
    pivotDrag: story.pivotDrag,
    scriptedFromFirstHit: story.scriptedFromFirstHit,
    aground: story.aground,
    agroundTimeScale: story.agroundTimeScale,
    capsizeTimeScale: story.capsizeTimeScale,
    rideOut: story.rideOut,
    endS: story.endS,
    boxWaterAtSide:
      host.boxWaterAtSide || story.boxWaterAtSide ? true : undefined,
    // Air caught in her (physics, stated leaks by kind): her own rules,
    // else the story's (the wave's: a hull turned over floats on it).
    trappedAir: host.trappedAir ?? story.trappedAir,
    shoalOpenings: story.shoalOpenings
      ? story.shoalOpenings.map((o) => shoalMap.get(o)!)
      : undefined,
    // Her own deck openings (a laker's hatches) and the story's topside
    // damage (broken vents, a split), lifted onto her deck.
    deckOpenings: deckOpeningsFor(host, story, map),
    // Her own doors, less the tears of her own wreck (the Britannic's
    // mine tore her bulkheads): a story's tears were its own ship's, so
    // neither comes along (the mine's hole alone is moved onto her).
    doors: host.doors?.filter((d) => d.kind !== "damage"),
    headway: story.headway ? headwayFor(story.headway, map) : undefined,
    heel: story.heel ? heelFor(host, story, map) : undefined,
    gash: story.gash
      ? {
          ...story.gash,
          zLow: map.z(story.gash.zLow),
          zHigh: map.z(story.gash.zHigh),
        }
      : undefined,
    blackout: story.blackout
      ? {
          ...story.blackout,
          compartmentId: map.compartmentId(story.blackout.compartmentId),
        }
      : host.blackout,
    torpedo: story.torpedo ? torpedoFor(story.torpedo, map) : undefined,
    wave: story.wave
      ? {
          ...story.wave,
          spots: story.wave.spots.map((s) => ({
            ...s,
            openings: s.openings.map(moveOpening),
          })),
          // Fitted to the Poseidon's own boxes (a rule): hers alone.
          boxFlood: undefined,
        }
      : undefined,
    // Her wreck keeps the pose it lands in (no survey to lay it over); a
    // wave's keeps the wave's keel-up rules (a hull turned over stays
    // over: `wave.ts`, the keel-under rule).
    wreck:
      story.cause === "wave" && story.wreck
        ? story.wreck
        : { restDeg: 0, minListDeg: 360 },
    wreckParts: undefined,
  };
  // A torpedo story without its own hits (the Lusitania's 1.1 rule reads
  // her bunkers): one torpedo of the same size where hers struck.
  if (story.cause === "torpedo" && !story.torpedo)
    spec.torpedo = lusitaniaStyleTorpedo(story, map);
  if (spec.torpedo) spec.realNight = torpedoRealNight(spec, spec.torpedo);
  return spec;
}

/** Moves story positions onto the host. */
interface Mapper {
  x(x: number): number;
  y(y: number): number;
  z(z: number): number;
  /** A story compartment's middle (story x). */
  storyMid(id: string): number;
  /** The host compartment where a story compartment's middle lands. */
  compartmentId(id: string): string;
  /** The host compartment holding x (a wing on `side` first). */
  compartmentAt(
    x: number,
    side?: "port" | "starboard",
    mainOnly?: boolean
  ): Compartment;
  /** `mainOnly`: into her main room there, never a wing. */
  opening(
    o: Opening,
    boxes: ShipSpec["superstructure"],
    mainOnly?: boolean
  ): Opening;
}

function mapper(host: ShipSpec, story: ShipSpec): Mapper {
  const fx = host.lbp / story.lbp;
  const fy = host.beam / story.beam;
  const x = (v: number) => v * fx;
  const y = (v: number) => v * fy;
  const z = (v: number) => {
    if (v <= story.draught) return (v / story.draught) * host.draught;
    const free = (v - story.draught) / Math.max(1, story.depth - story.draught);
    return host.draught + free * (host.depth - host.draught);
  };
  const comps = host.compartments;
  const compartmentAt = (
    at: number,
    side?: "port" | "starboard",
    mainOnly = false
  ): Compartment => {
    const lo = comps[0].fromX;
    const hi = comps[comps.length - 1].toX;
    const v = Math.min(hi - 0.01, Math.max(lo + 0.01, at));
    const inside = comps.filter((c) => c.fromX <= v && v < c.toX);
    const wing =
      !mainOnly && side ? inside.find((c) => c.span?.side === side) : undefined;
    const main =
      inside.find((c) => !c.span) ??
      inside.find((c) => c.span?.side === "centre");
    const found = wing ?? main ?? inside[0];
    if (found) return found;
    // Between rooms (a gap in her list): the nearest.
    return comps
      .slice()
      .sort(
        (a, b) =>
          Math.abs((a.fromX + a.toX) / 2 - v) -
          Math.abs((b.fromX + b.toX) / 2 - v)
      )[0];
  };
  const storyComp = (id: string) => story.compartments.find((c) => c.id === id);
  const compartmentId = (id: string) => {
    const c = storyComp(id);
    if (!c) return host.compartments[0].id;
    return compartmentAt(x((c.fromX + c.toX) / 2)).id;
  };
  const opening = (
    o: Opening,
    boxes: ShipSpec["superstructure"],
    mainOnly = false
  ): Opening => {
    const sBox = story.superstructure.find((b) => b.id === o.compartmentId);
    const hx = x(o.x);
    if (sBox) {
      // A smashed window or door in a deckhouse: the same share up its
      // side in her house there.
      const base = sBox.baseZ ?? story.sheerZ((sBox.fromX + sBox.toX) / 2);
      const share = (v: number) =>
        Math.min(1, Math.max(0, (v - base) / Math.max(0.1, sBox.topZ - base)));
      const hBox = boxAt(boxes, hx, share((o.zLow + o.zHigh) / 2), host);
      const hBase = hBox.baseZ ?? host.sheerZ((hBox.fromX + hBox.toX) / 2);
      const hz = (v: number) => hBase + share(v) * (hBox.topZ - hBase);
      return {
        ...o,
        compartmentId: hBox.id!,
        x: Math.min(hBox.toX - 0.5, Math.max(hBox.fromX + 0.5, hx)),
        zLow: hz(o.zLow),
        zHigh: hz(o.zHigh),
      };
    }
    const c = compartmentAt(hx, o.side, mainOnly);
    return {
      ...o,
      compartmentId: c.id,
      x: Math.min(c.toX - 0.5, Math.max(c.fromX + 0.5, hx)),
      zLow: z(o.zLow),
      zHigh: z(o.zHigh),
    };
  };
  const storyMid = (id: string) => {
    const c = storyComp(id);
    return c ? (c.fromX + c.toX) / 2 : 0;
  };
  return { x, y, z, storyMid, compartmentId, compartmentAt, opening };
}

/** Her deckhouse box at x whose height range best holds `share` (0..1 of
 *  the story box's height): with stacked tiers, the one at that height. */
function boxAt(
  boxes: ShipSpec["superstructure"],
  x: number,
  share: number,
  host: ShipSpec
): ShipSpec["superstructure"][number] {
  const over = boxes.filter((b) => b.fromX <= x && x <= b.toX);
  const pool = over.length > 0 ? over : boxes;
  const lo = Math.min(
    ...pool.map((b) => b.baseZ ?? host.sheerZ((b.fromX + b.toX) / 2))
  );
  const hi = Math.max(...pool.map((b) => b.topZ));
  const want = lo + share * (hi - lo);
  const dist = (b: ShipSpec["superstructure"][number]) => {
    const base = b.baseZ ?? host.sheerZ((b.fromX + b.toX) / 2);
    const dz = want < base ? base - want : want > b.topZ ? want - b.topZ : 0;
    const dx = x < b.fromX ? b.fromX - x : x > b.toX ? x - b.toX : 0;
    return dz + dx;
  };
  return pool.slice().sort((a, b) => dist(a) - dist(b))[0];
}

/**
 * The story's rockets, radio calls and explosions at their own times, and
 * her own lifeboats lowered over the story's boat-lowering time (spread
 * as hers were). A story with no boats lowered (the storm, the wave)
 * lowers none of hers.
 */
function scriptedFor(host: ShipSpec, story: ShipSpec): ScriptedEvent[] {
  const isBoat = (e: ScriptedEvent) => e.kind === "boat-lowered";
  const storyBoats = story.scripted.filter(isBoat);
  const hostBoats = host.scripted.filter(isBoat);
  const out = story.scripted.filter((e) => !isBoat(e));
  if (storyBoats.length > 0 && hostBoats.length > 0) {
    const s0 = storyBoats[0].t;
    const s1 = storyBoats[storyBoats.length - 1].t;
    const h0 = hostBoats[0].t;
    const h1 = hostBoats[hostBoats.length - 1].t;
    for (const e of hostBoats) {
      const u = h1 > h0 ? (e.t - h0) / (h1 - h0) : 0;
      out.push({ ...e, t: Math.round(s0 + u * (s1 - s0)) });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function deckOpeningsFor(
  host: ShipSpec,
  story: ShipSpec,
  map: Mapper
): DeckOpening[] | undefined {
  const own = host.deckOpenings ?? [];
  const damage = (story.deckOpenings ?? [])
    .filter((d) => d.kind === "vent" || d.kind === "split")
    .map((d): DeckOpening => {
      const hx = map.x(d.x);
      const lip = d.z - story.sheerZ(d.x);
      return {
        ...d,
        id: `story-${d.id}`,
        compartmentId: map.compartmentAt(hx).id,
        x: hx,
        y: map.y(d.y),
        z: host.sheerZ(hx) + lip,
      };
    });
  const all = [...own, ...damage];
  return all.length > 0 ? all : undefined;
}

function headwayFor(
  h: NonNullable<ShipSpec["headway"]>,
  map: Mapper
): NonNullable<ShipSpec["headway"]> {
  return {
    ...h,
    ram: h.ram ? { ...h.ram, fromX: map.x(h.ram.fromX) } : undefined,
    pathWhenOpen: h.pathWhenOpen
      ? [...new Set(h.pathWhenOpen.map(map.compartmentId))]
      : undefined,
  };
}

/** Her side above the water (m²) and its centre's height over the
 *  waterline (m): the wind's area and lever, from her own data. */
function windage(spec: ShipSpec): { area: number; height: number } {
  let area = 0;
  let moment = 0;
  const st = spec.stations;
  for (let i = 1; i < st.length; i++) {
    const dx = st[i].x - st[i - 1].x;
    const h =
      (spec.sheerZ(st[i].x) + spec.sheerZ(st[i - 1].x)) / 2 - spec.draught;
    if (h <= 0) continue;
    area += h * dx;
    moment += h * dx * (h / 2);
  }
  for (const b of spec.superstructure) {
    const base = b.baseZ ?? spec.sheerZ((b.fromX + b.toX) / 2);
    const h = b.topZ - base;
    const a = h * (b.toX - b.fromX);
    area += a;
    moment += a * (base - spec.draught + h / 2);
  }
  return { area, height: area > 0 ? moment / area : 0 };
}

function heelFor(
  host: ShipSpec,
  story: ShipSpec,
  map: Mapper
): NonNullable<ShipSpec["heel"]> {
  const h = story.heel!;
  const out: NonNullable<ShipSpec["heel"]> = {};
  if (h.wind) {
    const mine = windage(host);
    const theirs = windage(story);
    out.wind = {
      ...h.wind,
      areaM2: Math.round(h.wind.areaM2 * (mine.area / theirs.area)),
      // The lever is from the middle of the side under water.
      leverM:
        h.wind.leverM +
        (mine.height + host.draught / 2) -
        (theirs.height + story.draught / 2),
    };
  }
  if (h.rock)
    out.rock = {
      ...h.rock,
      x: map.x(h.rock.x),
      y: map.y(h.rock.y),
      z: map.z(h.rock.z),
    };
  if (h.muster) out.muster = { ...h.muster, y: map.y(h.muster.y) };
  return out;
}

/** The story's torpedoes on her: the same side, hole, order and times, each
 *  at the same share of her length (a spot is her main room there). */
function torpedoFor(t: TorpedoSpec, map: Mapper): TorpedoSpec {
  const hitX: Record<string, number> = {};
  const used = new Set<string>();
  const spotFor = (id: string, x: number) => {
    let c = map.compartmentAt(x, undefined, true);
    // Two hits in one room of a shorter ship: the next room along.
    if (used.has(c.id)) c = nextMain(map, c, x) ?? c;
    used.add(c.id);
    hitX[c.id] = Math.min(c.toX - 0.5, Math.max(c.fromX + 0.5, x));
    return c.id;
  };
  const xOf = (id: string) => map.x(t.hitX?.[id] ?? map.storyMid(id));
  const realSpots: string[] = [];
  let finisher: TorpedoSpec["finisher"];
  for (const id of t.realSpots) {
    if (id === "finisher") continue;
    realSpots.push(spotFor(id, xOf(id)));
  }
  if (t.finisher) {
    const fx = xOf(t.finisher.spotId);
    const id = spotFor(t.finisher.spotId, fx);
    finisher = { spotId: id, t: t.finisher.t };
    if (t.realSpots.includes("finisher")) realSpots.push("finisher");
  }
  return {
    ...t,
    hole: { ...t.hole, zLow: map.z(t.hole.zLow), zHigh: map.z(t.hole.zHigh) },
    hitX,
    finisher,
    realSpots,
  };
}

/** The main room next to `c`, toward x's side of its middle first. */
function nextMain(map: Mapper, c: Compartment, x: number) {
  const fwdFirst = x >= (c.fromX + c.toX) / 2;
  for (const fwd of fwdFirst ? [true, false] : [false, true]) {
    const n = map.compartmentAt(
      fwd ? c.toX + 0.5 : c.fromX - 0.5,
      undefined,
      true
    );
    if (n.id !== c.id) return n;
  }
  return null;
}

/** The Lusitania's afternoon as one torpedo of her total hole where hers
 *  struck (the 1.1 rule reads her own bunkers, so it cannot move). */
function lusitaniaStyleTorpedo(story: ShipSpec, map: Mapper): TorpedoSpec {
  const first = story.realNight.filter((o) => (o.t ?? 0) <= 0);
  const all = story.realNight;
  const xs = all.map((o) => o.x);
  const x = map.x(first.length > 0 ? first[0].x : (xs[0] ?? 0));
  const spot = map.compartmentAt(x, undefined, true);
  return {
    side: all[0]?.side ?? "starboard",
    order: "aft-first",
    staggerS: 3,
    hole: {
      areaM2: all.reduce((a, o) => a + o.areaM2, 0),
      zLow: map.z(Math.min(...all.map((o) => o.zLow))),
      zHigh: map.z(Math.max(...all.map((o) => o.zHigh))),
      lengthM: Math.max(6, (Math.max(...xs) - Math.min(...xs)) * 1.2),
    },
    hitX: {
      [spot.id]: Math.min(spot.toX - 0.5, Math.max(spot.fromX + 0.5, x)),
    },
    realSpots: [spot.id],
  };
}

function torpedoRealNight(spec: ShipSpec, t: TorpedoSpec): Opening[] {
  return hullOpenings(whatIfOpenings(spec, t.realSpots));
}
