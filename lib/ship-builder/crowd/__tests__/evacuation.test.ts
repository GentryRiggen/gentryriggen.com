import { analyzeShip } from "../../model/analysis";
import { resolveAttachPoint } from "../../model/attach";
import { compartmentSpecsOf } from "../../sim/compartments";
import { gridLength } from "../../model/grid";
import type { PlacedPart, Ship } from "../../model/types";
import { simShipFromStats } from "../../sim/simShip";
import {
  buildTimeline,
  extendWithDescent,
  stateAt,
  timelineEnd,
} from "../../sim/timeline";
import { trialFunnelsOf } from "../../sim/trialFunnels";
import { poseWorldPoint } from "../../sim/funnelFall";
import type { BreakMode, SimState, TrialInput } from "../../sim/types";
import { DECK_Y, LEVEL_HEIGHT } from "../../model/worldFrame";
import type { WalkGrid } from "../../walk/types";
import { findTemplate } from "../../templates";
import { attachPart, gridPart, testShip } from "../../testing";
import { walkGridOf, walkHalfOf } from "../../walk";
import {
  BOAT_SHOWN_MAX,
  type EvacuationPlan,
  LAUNCH_WAIT_S,
  LOWER_S,
  ROW_OUT,
  ROW_S,
  planEvacuation,
} from "../evacuation";
import { crowdGraphOf, planCrowd } from "../plan";
import type { CrowdPlan } from "../types";
import { getPartDef } from "../../model/catalog";

/** Where the store's "Hit with an iceberg" strikes: sinks the Titanic. */
const SINK_FRACTION = 0.2;
/** Well aft, where the Titanic stays afloat. */
const AFLOAT_FRACTION = 0.7;

function titanic(): Ship {
  return findTemplate("titanic")!.build();
}

function inputOf(
  ship: Ship,
  impactFraction: number | null,
  breakMode: BreakMode = "never"
): TrialInput {
  const length = gridLength(ship);
  return {
    ship: simShipFromStats(analyzeShip(ship).stats, ship.hull.beam),
    sea: "calm",
    length,
    funnels: trialFunnelsOf(ship),
    ...(impactFraction === null
      ? {}
      : {
          iceberg: {
            compartments: compartmentSpecsOf(ship.hull),
            length,
            impactX: Math.round(length * impactFraction),
            breakMode,
          },
        }),
  };
}

/** The timeline the scene plays: an iceberg trial goes on to the sea floor. */
function timelineOf(input: TrialInput) {
  const timeline = extendWithDescent(buildTimeline(input), input);
  return {
    input,
    stateAt: (t: number) => stateAt(timeline, t),
    end: timelineEnd(timeline),
    states: timeline.states,
  };
}

interface Setup {
  ship: Ship;
  crowd: CrowdPlan;
  plan: EvacuationPlan;
  grid: WalkGrid;
  stateAt: (t: number) => SimState;
  length: number;
  doomAt: number;
  end: number;
  breakAtX: number | null;
}

function setup(ship: Ship, breakMode: BreakMode = "never"): Setup {
  const grid = walkGridOf(ship);
  const crowd = planCrowd(ship, grid, analyzeShip(ship).stats);
  const timeline = timelineOf(inputOf(ship, SINK_FRACTION, breakMode));
  const plan = planEvacuation(ship, grid, crowd, timeline);
  if (!plan) throw new Error("expected an evacuation");
  const last = timeline.states[timeline.states.length - 1];
  // Doom is the iceberg strike: the first water in.
  const doom = last.events.find((e) => e.kind === "flooding")!.at;
  return {
    ship,
    crowd,
    plan,
    grid,
    stateAt: timeline.stateAt,
    length: timeline.input.length,
    doomAt: doom,
    end: timeline.end,
    breakAtX: last.breakup?.atX ?? null,
  };
}

function shownCap(ship: Ship, boatId: string): number {
  const boat = ship.parts.find((p) => p.id === boatId)!;
  return Math.min(BOAT_SHOWN_MAX, getPartDef(boat.type).seats ?? 0);
}

/**
 * A long block of cabins whose roof is one open boat deck, with a davit and
 * lifeboat every third cell along both edges: every boat can be walked to.
 * With `lonely`, the starboard davits at x 13 to 19 make way for a side
 * davit on the cabin wall at x 16, under three cabins stacked on the deck, so
 * the deck beside it is solid: its boat ("lonely") cannot be boarded.
 */
function boatDeckShip(lonely = false): Ship {
  const segments = 12;
  const length = segments * 3;
  const parts: PlacedPart[] = [];
  for (let x = 2; x < length - 2; x++) {
    for (let z = 0; z < 4; z++) {
      parts.push(gridPart(`c${x}_${z}`, "cabin-3rd", 0, x, z));
    }
  }
  for (let x = 4; x < length - 4; x += 3) {
    for (const z of [0, 3]) {
      if (lonely && z === 0 && x >= 13 && x <= 19) continue;
      parts.push(
        attachPart(`d${x}_${z}`, "davit", `c${x}_${z}`, `davit:${x}:${z}`),
        attachPart(`b${x}_${z}`, "lifeboat-standard", `d${x}_${z}`, "boat")
      );
    }
  }
  if (lonely) {
    for (let x = 15; x <= 17; x++) {
      for (const z of [0, 1]) {
        parts.push(gridPart(`u${x}_${z}`, "cabin-3rd", 1, x, z));
      }
    }
    parts.push(
      attachPart("sd", "davit-side", "c16_0", "side-davit:16:0"),
      attachPart("lonely", "lifeboat-standard", "sd", "boat")
    );
  }
  return { ...testShip(parts, segments, 4), name: "Boat deck" };
}

/** Whether anyone is ever boarding a boat (sampled from doom). */
function boardingSeen(s: Setup): number {
  let seen = 0;
  for (let i = 0; i < s.crowd.people.length; i++) {
    for (let t = s.doomAt; t < s.doomAt + LAUNCH_WAIT_S; t += 0.05) {
      if (s.plan.fateAt(i, t).kind === "boarding") {
        seen++;
        break;
      }
    }
  }
  return seen;
}

/**
 * Every boarding or seated fate of a person who stood on the stern half at
 * doom names a stern-half boat. Returns how many such fates were checked.
 */
function checkSternRouting(s: Setup): number {
  expect(s.breakAtX).not.toBeNull();
  const atX = s.breakAtX!;
  const boatHalf = new Map<string, string>();
  for (const launch of s.plan.launches) {
    const boat = s.ship.parts.find((p) => p.id === launch.boatId)!;
    if (boat.anchor.kind !== "attach") continue;
    const point = resolveAttachPoint(s.ship, boat.anchor)!;
    boatHalf.set(launch.boatId, walkHalfOf(point.position.x, atX));
  }
  let checked = 0;
  for (let i = 0; i < s.crowd.people.length; i++) {
    const start = s.crowd.poseAt(i, s.doomAt);
    if (walkHalfOf(start.x, atX) !== "stern") continue;
    for (let t = s.doomAt; t <= s.end; t += 0.1) {
      const fate = s.plan.fateAt(i, t);
      if (fate.kind !== "boarding" && fate.kind !== "in-boat") continue;
      checked++;
      expect(boatHalf.get(fate.boatId)).toBe("stern");
    }
  }
  return checked;
}

describe("planEvacuation", () => {
  it("is null when she stays afloat, and for a weather trial", () => {
    const ship = titanic();
    const grid = walkGridOf(ship);
    const crowd = planCrowd(ship, grid, analyzeShip(ship).stats);
    const afloat = timelineOf(inputOf(ship, AFLOAT_FRACTION));
    expect(afloat.states[afloat.states.length - 1].outcome).toBe("afloat");
    expect(planEvacuation(ship, grid, crowd, afloat)).toBeNull();
    const weather = timelineOf(inputOf(ship, null));
    expect(planEvacuation(ship, grid, crowd, weather)).toBeNull();
  });

  describe("on the sinking Titanic", () => {
    const s = setup(titanic());
    const count = s.crowd.people.length;

    it("has people and boats", () => {
      expect(count).toBeGreaterThan(0);
      expect(s.plan.launches.length).toBeGreaterThan(0);
      expect(s.plan.launches.some((launch) => launch.riders.length > 0)).toBe(
        true
      );
    });

    it("matches the crowd plan before doom", () => {
      for (let i = 0; i < count; i++) {
        for (let t = 0; t < s.doomAt; t += s.doomAt / 23) {
          expect(s.plan.poseAt(i, t)).toEqual(s.crowd.poseAt(i, t));
          expect(s.plan.fateAt(i, t)).toEqual({ kind: "aboard" });
        }
      }
    });

    it("never overfills a boat or seats anyone twice", () => {
      const seen = new Set<string>();
      for (const launch of s.plan.launches) {
        expect(launch.riders.length).toBeLessThanOrEqual(
          shownCap(s.ship, launch.boatId)
        );
        for (const id of launch.riders) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
    });

    it("launches every boat by LAUNCH_WAIT_S after doom", () => {
      for (const launch of s.plan.launches) {
        expect(launch.at).toBeGreaterThanOrEqual(s.doomAt);
        expect(launch.at).toBeLessThanOrEqual(s.doomAt + LAUNCH_WAIT_S + 1e-9);
      }
    });

    it("leaves everyone in a boat or floating by the end", () => {
      for (let i = 0; i < count; i++) {
        const fate = s.plan.fateAt(i, s.end);
        expect(["in-boat", "floating"]).toContain(fate.kind);
      }
    });

    it("seats each rider in the boat that carries them", () => {
      for (const launch of s.plan.launches) {
        launch.riders.forEach((id, seat) => {
          const i = s.crowd.people.findIndex((p) => p.id === id);
          expect(s.plan.fateAt(i, launch.at + 1)).toEqual({
            kind: "in-boat",
            boatId: launch.boatId,
            seat,
          });
        });
      }
    });

    it("lowers each boat to the water and rows it out", () => {
      for (const launch of s.plan.launches) {
        const start = s.plan.boatPoseAt(launch, launch.at);
        expect(start.position.x).toBeCloseTo(launch.origin.x, 9);
        expect(start.position.y).toBeCloseTo(launch.origin.y, 9);
        expect(start.position.z).toBeCloseTo(launch.origin.z, 9);
        expect(start.rotation.x).toBeCloseTo(launch.roll, 9);
        expect(start.rotation.z).toBeCloseTo(launch.pitch, 9);
        const out = s.plan.boatPoseAt(launch, launch.at + LOWER_S + ROW_S);
        expect(Math.abs(out.position.y)).toBeLessThan(0.1);
        expect(
          Math.abs(
            out.position.z - (launch.origin.z + ROW_OUT * launch.outward)
          )
        ).toBeLessThan(0.1);
      }
    });

    it("is pure in t: scrubbing back gives the same fate", () => {
      const ship = titanic();
      const a = setup(ship);
      const b = setup(ship);
      for (let i = 0; i < count; i++) {
        a.plan.fateAt(i, 50 + a.doomAt);
        a.plan.poseAt(i, 50 + a.doomAt);
      }
      for (let i = 0; i < count; i++) {
        for (const t of [10, a.doomAt + 3, a.doomAt + 10]) {
          expect(a.plan.fateAt(i, t)).toEqual(b.plan.fateAt(i, t));
          expect(a.plan.poseAt(i, t)).toEqual(b.plan.poseAt(i, t));
        }
      }
    });

    it("fills the boats with people who walked there", () => {
      // 24 figures can never fill most of the 18 boats' shown seats, and
      // the Titanic's decks are joined only by jumps (she has no stairs), so
      // only people on the boat deck at the strike can reach a boat. Most of
      // those must get a seat, and most of the shown seats they could fill.
      const graph = crowdGraphOf(s.ship, s.grid);
      const spots = new Set<number>();
      for (const launch of s.plan.launches) {
        for (const id of launch.riders) {
          const i = s.crowd.people.findIndex((p) => p.id === id);
          const at = s.plan.poseAt(i, launch.at);
          spots.add(
            graph.nodeAt(Math.floor(at.x), Math.floor(at.z), at.level)!
          );
        }
      }
      let canReach = 0;
      for (let i = 0; i < count; i++) {
        const start = s.crowd.poseAt(i, s.doomAt);
        const node = graph.nodeAt(
          Math.floor(start.x),
          Math.floor(start.z),
          start.level
        );
        if (node === undefined) continue;
        if ([...spots].some((spot) => graph.reachFrom(spot).dist[node] >= 0)) {
          canReach++;
        }
      }
      const shown = s.plan.launches.reduce(
        (n, launch) => n + shownCap(s.ship, launch.boatId),
        0
      );
      const riders = s.plan.launches.flatMap((launch) => launch.riders);
      expect(riders.length).toBeGreaterThanOrEqual(
        Math.ceil(0.75 * Math.min(shown, canReach))
      );
      expect(riders.length).toBeGreaterThanOrEqual(6);
    });

    it("seats someone who walked more than 3 steps to their boat", () => {
      const graph = crowdGraphOf(s.ship, s.grid);
      let longest = 0;
      for (const launch of s.plan.launches) {
        for (const id of launch.riders) {
          const i = s.crowd.people.findIndex((p) => p.id === id);
          const at = s.plan.poseAt(i, launch.at);
          const from = s.crowd.poseAt(i, s.doomAt);
          const spot = graph.nodeAt(
            Math.floor(at.x),
            Math.floor(at.z),
            at.level
          )!;
          const start = graph.nodeAt(
            Math.floor(from.x),
            Math.floor(from.z),
            from.level
          )!;
          longest = Math.max(longest, graph.reachFrom(spot).dist[start]);
        }
      }
      expect(longest).toBeGreaterThan(3);
    });

    it("lowers every boat before the water reaches its deck", () => {
      for (const launch of s.plan.launches) {
        expect(launch.origin.y).toBeGreaterThan(0);
        const state = s.stateAt(launch.at);
        for (const id of launch.riders) {
          // A rider waits on the boat's deck spot.
          const i = s.crowd.people.findIndex((p) => p.id === id);
          const spot = s.plan.poseAt(i, launch.at);
          const world = poseWorldPoint(state.pose, s.length, {
            x: s.length / 2 - spot.x,
            y: DECK_Y + spot.level * LEVEL_HEIGHT,
            z: s.ship.hull.beam / 2 - spot.z,
          });
          expect(world.y).toBeGreaterThan(0);
        }
        // And the lowering is done before she is under.
        expect(launch.at + LOWER_S).toBeLessThan(s.end);
      }
    });
  });

  it("still launches a boat nobody can reach, empty", () => {
    const ship = boatDeckShip(true);
    expect(
      resolveAttachPoint(ship, {
        kind: "attach",
        parentId: "sd",
        pointId: "boat",
      })
    ).toBeDefined();
    const s = setup(ship);
    // Others board their boats; nobody ever heads for this one.
    expect(boardingSeen(s)).toBeGreaterThan(0);
    const launch = s.plan.launches.find((l) => l.boatId === "lonely");
    expect(launch).toBeDefined();
    expect(launch!.riders).toEqual([]);
    expect(launch!.at).toBeGreaterThanOrEqual(s.doomAt);
    expect(launch!.at).toBeLessThanOrEqual(s.doomAt + LAUNCH_WAIT_S + 1e-9);
    for (let i = 0; i < s.crowd.people.length; i++) {
      for (let t = s.doomAt; t <= s.end; t += 0.1) {
        const fate = s.plan.fateAt(i, t);
        if (fate.kind === "boarding" || fate.kind === "in-boat") {
          expect(fate.boatId).not.toBe("lonely");
        }
      }
    }
  });

  it("keeps stern-half people to stern-half boats once she breaks", () => {
    expect(checkSternRouting(setup(titanic(), "always"))).toBeGreaterThan(0);
    expect(checkSternRouting(setup(boatDeckShip(), "always"))).toBeGreaterThan(
      0
    );
  });

  describe("on a ship whose boats can all be walked to", () => {
    const s = setup(boatDeckShip());

    it("walks boarders to their boat, then seats them or sends them off", () => {
      expect(boardingSeen(s)).toBeGreaterThan(0);
      for (let i = 0; i < s.crowd.people.length; i++) {
        let prev = s.plan.fateAt(i, s.doomAt);
        for (let t = s.doomAt; t <= s.end; t += 0.05) {
          const fate = s.plan.fateAt(i, t);
          if (prev.kind === "boarding" && fate.kind !== "boarding") {
            expect(["in-boat", "aboard", "floating"]).toContain(fate.kind);
            if (fate.kind === "in-boat") expect(fate.boatId).toBe(prev.boatId);
          }
          if (fate.kind === "boarding") {
            expect(fate.until).toBeGreaterThan(t);
            expect(["walk", "idle"]).toContain(s.plan.poseAt(i, t).activity);
          }
          // Nobody leaves a boat or climbs out of the water.
          if (prev.kind === "in-boat") expect(fate.kind).toBe("in-boat");
          if (prev.kind === "floating") expect(fate.kind).toBe("floating");
          prev = fate;
        }
      }
    });

    it("keeps every rider within the boat's shown seats", () => {
      for (const launch of s.plan.launches) {
        expect(launch.riders.length).toBeLessThanOrEqual(
          shownCap(s.ship, launch.boatId)
        );
        expect(launch.at).toBeLessThanOrEqual(s.doomAt + LAUNCH_WAIT_S + 1e-9);
      }
      for (let i = 0; i < s.crowd.people.length; i++) {
        expect(["in-boat", "floating"]).toContain(s.plan.fateAt(i, s.end).kind);
      }
    });

    it("moves people smoothly from the crowd plan into the evacuation", () => {
      for (let i = 0; i < s.crowd.people.length; i++) {
        const before = s.crowd.poseAt(i, s.doomAt);
        const after = s.plan.poseAt(i, s.doomAt);
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.z).toBeCloseTo(before.z, 9);
        expect(after.level).toBe(before.level);
      }
    });
  });
});
