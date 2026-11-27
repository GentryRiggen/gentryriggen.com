import { titanic } from "@/lib/shipwreck/ships/titanic";
import { TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { floorZ, walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import { doorGlowGeometry } from "../doorGlow";
import {
  buildInterior,
  edgeKinds,
  rampTreads,
  RISER_M,
  zonesSeen,
  ZONE_TRIANGLE_BUDGET,
} from "../kit";

/**
 * The blockout kit: each zone's merged shell is finite and non-empty (its
 * triangle count is printed for the report), a flight's treads stand on
 * the walker's ramp, and the zones drawn together follow the doorways.
 */

const spec = titanic;
const interior = TITANIC_INTERIOR;
const map = walkMapFor("titanic") as WalkMap;
const built = buildInterior(interior, spec);

afterAll(() => {
  for (const g of built.zones.values()) g.dispose();
});

function triangles(g: import("three").BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute("position").count) / 3;
}

describe("the blockout kit", () => {
  it("builds one shell per zone: finite, non-empty, under budget", () => {
    const zones = new Set(interior.rooms.map((r) => r.zone));
    expect(new Set(built.zones.keys())).toEqual(zones);
    const counts: Record<string, number> = {};
    for (const [zone, g] of built.zones) {
      const pos = g.getAttribute("position");
      const col = g.getAttribute("color");
      expect(pos.count).toBeGreaterThan(0);
      expect(col.count).toBe(pos.count);
      for (const a of [pos.array, col.array])
        for (let i = 0; i < a.length; i += 1)
          expect(Number.isFinite(a[i])).toBe(true);
      // Colours stay under 1 (bloom's threshold): a shell never glows.
      for (let i = 0; i < col.array.length; i += 1)
        expect(col.array[i]).toBeLessThan(1);
      counts[zone] = triangles(g);
      expect(counts[zone]).toBeLessThan(ZONE_TRIANGLE_BUDGET);
      g.computeBoundingBox();
      expect(g.boundingBox!.isEmpty()).toBe(false);
    }
    // Recorded for the report.
    console.log(`interior triangles per zone: ${JSON.stringify(counts)}`);
  });

  it("sits in her frame (three-local x, z, −y) round each room", () => {
    // The Grand Staircase zone's box covers the well and the foyers.
    const g = built.zones.get("gs")!;
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.min.x).toBeLessThanOrEqual(31.01);
    expect(b.max.x).toBeGreaterThanOrEqual(43.39);
    // y up: from below B deck's floor to the Boat deck's ceiling.
    expect(b.min.y).toBeLessThan(floorZ(map, "gs-b", 36, spec));
    expect(b.max.y).toBeGreaterThan(floorZ(map, "gs-boat", 36, spec) + 4);
    // z is −y: the B foyer's ±8 m.
    expect(b.min.z).toBeLessThanOrEqual(-7.99);
    expect(b.max.z).toBeGreaterThanOrEqual(7.99);
  });

  it("a flight's treads stand on the walker's ramp (nosings on floorZ)", () => {
    const flights = interior.rooms.filter((r) => r.ramp);
    expect(flights.length).toBeGreaterThan(5);
    for (const room of flights) {
      const treads = rampTreads(room, spec);
      const risers = Math.max(1, Math.round(room.ramp!.dropM / RISER_M));
      expect(treads.length).toBe(risers);
      let onRamp = 0;
      for (const tread of treads) {
        for (const [x, y, z] of tread) {
          const f = floorZ(map, room.id, x, spec, y);
          // At or one riser under the ramp the walker's feet follow.
          expect(z).toBeLessThanOrEqual(f + 1e-6);
          expect(z).toBeGreaterThanOrEqual(
            f - room.ramp!.dropM / risers - 1e-6
          );
          if (Math.abs(z - f) < 1e-6) onRamp += 1;
        }
      }
      // Each tread's nosing (two corners) is exactly on the ramp.
      expect(onRamp).toBeGreaterThanOrEqual(2 * treads.length);
      // The bottom tread is level with the floor at the foot (within her
      // sheer over one tread).
      const last = treads[treads.length - 1];
      const [bx, by] = room.ramp!.to;
      for (const [, , z] of last)
        expect(Math.abs(z - floorZ(map, room.id, bx, spec, by))).toBeLessThan(
          0.02
        );
    }
  });

  it("draws a zone with the zones it has doorways to", () => {
    const seen = zonesSeen(interior);
    expect([...seen.get("gs")!].sort()).toEqual(["b-deck", "gs"]);
    expect([...seen.get("b-deck")!].sort()).toEqual(["b-deck", "gs"]);
    expect([...seen.get("e-deck")!].sort()).toEqual(["e-deck", "third-stairs"]);
    // The lift is no doorway: B and E decks are drawn apart.
    expect(seen.get("gs")!.has("e-deck")).toBe(false);
    expect(built.roomZone.get("scotland-road")).toBe("e-deck");
  });

  it("the door glows: one merged mesh, a lit doorway per deck door", () => {
    const g = doorGlowGeometry(interior, map, spec);
    const doors = interior.links.filter((l) => l.kind === "door");
    const pos = g.getAttribute("position");
    expect(triangles(g)).toBeGreaterThanOrEqual(2 * doors.length);
    for (let i = 0; i < pos.array.length; i += 1)
      expect(Number.isFinite(pos.array[i])).toBe(true);
    // Each doorway stands on the deck at its door's outside end.
    for (const d of doors) {
      const [x, y] = d.from.at;
      const deck = floorZ(map, d.from.area, x, spec, y);
      let found = false;
      for (let i = 0; i < pos.count; i += 1)
        if (
          Math.abs(pos.getX(i) - x) < 1.2 &&
          Math.abs(-pos.getZ(i) - y) < 1.2 &&
          Math.abs(pos.getY(i) - deck) < 0.05
        )
          found = true;
      expect(found).toBe(true);
    }
    // Warm and bright enough to bloom.
    const col = g.getAttribute("color");
    let brightest = 0;
    for (let i = 0; i < col.count; i += 1)
      brightest = Math.max(brightest, col.getX(i));
    expect(brightest).toBeGreaterThan(1);
    g.dispose();
  });

  it("walls where rooms are stacked or level, balustrades beside a stair", () => {
    const kinds = edgeKinds(interior, spec);
    const edgeAt = (id: string, p: [number, number], q: [number, number]) => {
      const room = interior.rooms.find((r) => r.id === id)!;
      const o = room.outline;
      const i = o.findIndex((a, k) => {
        const b = o[(k + 1) % o.length];
        const on = (v: readonly number[], w: [number, number]) =>
          Math.abs(v[0] - w[0]) < 1e-3 && Math.abs(v[1] - w[1]) < 1e-3;
        return (on(a, p) && on(b, q)) || (on(a, q) && on(b, p));
      });
      expect(i).toBeGreaterThanOrEqual(0);
      return kinds.get(id)![i].kind;
    };
    // The half landing's forward wall: the landing below is stacked under
    // it, not beside it.
    expect(edgeAt("gs-flight-boat-a-landing", [41.4, -3], [41.4, 3])).toBe(
      "wall"
    );
    // The A foyer's forward wall beside the lift a deck below: a wall.
    expect(edgeAt("gs-a", [41.4, -7], [41.4, -3])).toBe("wall");
    // A twin flight looks over the foyer beside it.
    expect(edgeAt("gs-flight-boat-a-port", [35, 3], [39, 3])).toBe("rail");
    // A suite and the corridor are level: a wall either side of the door.
    const suite = interior.rooms.find((r) => r.id === "suite-1")!;
    const kindsSuite = kinds.get("suite-1")!;
    expect(kindsSuite.filter((k) => k.kind === "rail")).toHaveLength(0);
    expect(kindsSuite.filter((k) => k.kind === "seam")).toHaveLength(1);
    expect(suite.outline.length).toBe(kindsSuite.length);
  });
});
