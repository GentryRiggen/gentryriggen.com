import { titanic } from "@/lib/shipwreck/ships/titanic";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { CONCORDIA_INTERIOR } from "@/lib/shipwreck/interior/concordia";
import { CONCORDIA_POOL_DOME } from "@/lib/shipwreck/ships/concordiaLayout";
import { floorZ, walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import { doorGlowGeometry } from "../doorGlow";
import {
  addPiece,
  buildInterior,
  edgeKinds,
  rampTreads,
  RISER_M,
  GS_TRIANGLE_BUDGET,
  INTERIOR_TRIANGLE_BUDGET,
  zonesSeen,
  ZONE_MESH_BUDGET,
  ZONE_TRIANGLE_BUDGET,
  DECK_ROOM_FLOOR_M,
  DECK_ROOM_TRIANGLE_BUDGET,
  FROSTED_TILE,
  DOOR_HEAD_M,
  liftGlassWalls,
} from "../kit";
import { buildLiftCars, CAR_END_INSET_M, disposeLiftCars } from "../liftCar";
import { MeshBasicMaterial } from "three";
import { deckZAt } from "@/lib/shipwreck/places";
import { MODERN_TILE } from "../modernTextures";
import { Layers, TILE } from "../pieces";
import { MAX_ROOM_SLOTS } from "../materials";
import { lightSegments, segmentAt } from "@/lib/shipwreck/interior";

/**
 * The room kit: each zone's layers are finite, tagged and lit, within the
 * budgets (triangle counts and the build time printed with
 * SHIPWRECK_PRINT_TRIANGLES=1), a flight's treads stand on
 * the walker's ramp, and the zones drawn together follow the doorways.
 */

const spec = titanic;
const interior = TITANIC_INTERIOR;
const map = walkMapFor("titanic") as WalkMap;
const built = buildInterior(interior, spec);

afterAll(() => {
  for (const z of built.zones.values())
    for (const g of Object.values(z)) g?.dispose();
});

function triangles(g: import("three").BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute("position").count) / 3;
}

const ATTRS: [string, number][] = [
  ["position", 3],
  ["normal", 3],
  ["color", 3],
  ["uv", 2],
  ["aTile", 1],
  ["aRoom", 1],
  ["aGlow", 1],
  ["aLight", 1],
];

describe("the room kit", () => {
  it("builds each zone's layers: finite, tagged, lit, within budget", () => {
    const zones = new Set(interior.rooms.map((r) => r.zone));
    expect(new Set(built.zones.keys())).toEqual(zones);
    const counts: Record<string, number> = {};
    let total = 0;
    for (const [zone, layers] of built.zones) {
      let tris = 0;
      let meshes = 0;
      for (const [layer, g] of Object.entries(layers)) {
        if (!g) continue;
        meshes += 1;
        const n = g.getAttribute("position").count;
        expect(n).toBeGreaterThan(0);
        for (const [name, size] of ATTRS) {
          const a = g.getAttribute(name);
          expect([layer, name, a?.count, a?.itemSize]).toEqual([
            layer,
            name,
            n,
            size,
          ]);
          expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
        }
        // Room slots are rooms; the light is lit (never 0) and bounded.
        const room = g.getAttribute("aRoom").array;
        const light = g.getAttribute("aLight").array;
        expect(Math.min(...room)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...room)).toBeLessThan(built.slots);
        expect(Math.min(...light)).toBeGreaterThan(0.05);
        expect(Math.max(...light)).toBeLessThanOrEqual(1.6 + 1e-6);
        // Colours stay under 1 (bloom's threshold): only glass glows,
        // by its aGlow.
        const col = g.getAttribute("color").array;
        expect(Math.max(...col)).toBeLessThan(1);
        const glow = g.getAttribute("aGlow").array;
        if (layer !== "glass") expect(Math.max(...glow)).toBe(0);
        tris += triangles(g);
      }
      counts[zone] = tris;
      expect(built.triangles.get(zone)).toBe(tris);
      expect(meshes + 2).toBeLessThanOrEqual(ZONE_MESH_BUDGET); // + water
      expect(tris).toBeLessThanOrEqual(
        zone === "gs" ? GS_TRIANGLE_BUDGET : ZONE_TRIANGLE_BUDGET
      );
      total += tris;
    }
    expect(GS_TRIANGLE_BUDGET).toBe(45000);
    expect(ZONE_MESH_BUDGET).toBe(6);
    expect(INTERIOR_TRIANGLE_BUDGET).toBe(120000);
    expect(total).toBeLessThanOrEqual(INTERIOR_TRIANGLE_BUDGET);
    expect(built.ms).toBeGreaterThan(0);
    // Printed only on request (SHIPWRECK_PRINT_TRIANGLES=1), for reports.
    if (process.env.SHIPWRECK_PRINT_TRIANGLES)
      console.log(
        `interior triangles per zone: ${JSON.stringify(counts)} total ${total}, build ${built.ms.toFixed(1)} ms`
      );
  });

  it("tags a long hall's surfaces by part, so its lamps die by the water at each part", () => {
    const sr = interior.rooms.find((r) => r.id === "scotland-road")!;
    const parts = lightSegments(sr);
    expect(parts.length).toBeGreaterThan(5);
    expect(built.slots).toBe(interior.rooms.length + built.segments.length);
    expect(built.slots).toBeLessThanOrEqual(MAX_ROOM_SLOTS);
    expect(built.floors.length).toBe(built.slots * 3);
    const mine = built.segments.filter(
      (s) => s.room === built.slot.get("scotland-road")
    );
    expect(mine.map((s) => s.part)).toEqual(parts.map((_, i) => i));
    // Each part's floor point is its middle, on the walker's floor.
    for (const s of mine) {
      const x = built.floors[s.slot * 3];
      const y = -built.floors[s.slot * 3 + 2];
      expect(x).toBeCloseTo(parts[s.part].mid[0], 4);
      expect(built.floors[s.slot * 3 + 1]).toBeCloseTo(
        floorZ(map, "scotland-road", x, spec, y),
        4
      );
    }
    // Every e-deck vertex of the hall carries its own part's slot.
    let checked = 0;
    for (const g of Object.values(built.zones.get("e-deck")!)) {
      if (!g) continue;
      const pos = g.getAttribute("position").array;
      const room = g.getAttribute("aRoom").array;
      for (let v = 0; v < room.length; v += 1) {
        const seg = mine.find((s) => s.slot === room[v]);
        if (!seg) continue;
        expect(seg.part).toBe(segmentAt(sr, pos[v * 3], -pos[v * 3 + 2]));
        checked += 1;
      }
      // No vertex is left on the hall's own slot.
      expect(
        Array.from(room).filter((r) => r === built.slot.get("scotland-road"))
      ).toHaveLength(0);
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("closes the step between ceilings across an open stair seam (no slit to the sky)", () => {
    // The third-class E landing (ceiling 2.4 m) opens onto its passage
    // (2.3 m) at x 74.4: a face from the passage's ceiling up to the
    // landing's, facing the landing (+x).
    const g = built.zones.get("e-deck")!.shell!;
    const pos = g.getAttribute("position").array;
    const nrm = g.getAttribute("normal").array;
    const floor = floorZ(map, "third-passage", 74.4, spec, 4.9);
    let found = 0;
    for (let v = 0; v < pos.length / 3; v += 1) {
      if (Math.abs(pos[v * 3] - 74.4) > 1e-3) continue;
      const y = -pos[v * 3 + 2];
      const z = pos[v * 3 + 1] - floor;
      if (y < 4.2 - 1e-3 || y > 5.6 + 1e-3) continue;
      if (z < 2.28 || z > 2.42) continue;
      if (nrm[v * 3] > 0.99) found += 1;
    }
    expect(found).toBeGreaterThanOrEqual(4);
  });

  it("frames the lift's doorway with brass gates (it reads as a lift, not a wall)", () => {
    const metal = built.zones.get("gs")!.metal!;
    const pos = metal.getAttribute("position").array;
    let gate = 0;
    for (let v = 0; v < pos.length / 3; v += 1) {
      const x = pos[v * 3];
      const y = -pos[v * 3 + 2];
      if (x > 41.4 && x < 41.6 && y > -5.25 && y < -3.95) gate += 1;
    }
    expect(gate).toBeGreaterThan(100);
  });

  it("keeps the B deck and E deck zones (the suites, Scotland Road) in budget", () => {
    for (const zone of ["b-deck", "e-deck"]) {
      const layers = built.zones.get(zone)!;
      const meshes = Object.values(layers).filter(Boolean).length;
      // Four layers at most, plus the water's surface and body.
      expect([zone, meshes + 2 <= 6]).toEqual([zone, true]);
      let tris = 0;
      for (const g of Object.values(layers)) if (g) tris += triangles(g);
      expect([zone, tris <= 40000]).toEqual([zone, true]);
      // Dressed: wood (beds, wardrobes, tables) or metal (bunks, pipes).
      expect(layers.wood ?? layers.metal).toBeDefined();
    }
    expect(ZONE_TRIANGLE_BUDGET).toBe(40000);
    let total = 0;
    for (const n of built.triangles.values()) total += n;
    expect(total).toBeLessThanOrEqual(120000);
  });

  it("draws every furniture piece in the Titanic's rooms", () => {
    const byId = new Map(interior.rooms.map((r) => [r.id, r]));
    for (const f of interior.furniture) {
      const L = new Layers();
      addPiece(L, f, byId.get(f.room)!, spec);
      expect([f.room, f.piece, L.triangles > 0]).toEqual([
        f.room,
        f.piece,
        true,
      ]);
    }
  });

  it("the Grand Staircase glows: lamps and the dome in its glass, HDR", () => {
    const glass = built.zones.get("gs")!.glass!;
    const glow = glass.getAttribute("aGlow").array;
    const col = glass.getAttribute("color").array;
    let hdr = 0;
    for (let i = 0; i < glow.length; i += 1)
      if (glow[i] * Math.max(col[i * 3], col[i * 3 + 1]) > 1) hdr += 1;
    expect(hdr).toBeGreaterThan(100);
    // The dome's panes (TILE.dome) are there, over the well.
    const tile = glass.getAttribute("aTile").array;
    expect(
      Array.from(tile).filter((t) => t === TILE.dome).length
    ).toBeGreaterThan(100);
  });

  it("each room's lamps read the water at its floor's middle, a flight's at its head", () => {
    expect(built.slot.size).toBe(interior.rooms.length);
    for (const room of interior.rooms) {
      const k = built.slot.get(room.id)!;
      const x = built.floors[k * 3];
      const y = -built.floors[k * 3 + 2];
      const z = built.floors[k * 3 + 1];
      expect(z).toBeCloseTo(floorZ(map, room.id, x, spec, y), 4);
      if (room.ramp)
        expect([x, y]).toEqual(
          [room.ramp.from[0], room.ramp.from[1]].map((v) =>
            expect.closeTo(v, 4)
          )
        );
    }
  });

  it("knows which rooms are open to each other (the lights' spill)", () => {
    const n = (id: string) =>
      built.neighbours[built.slot.get(id)!].map((k) => interior.rooms[k].id);
    expect(n("gs-c")).toContain("gs-flight-b-c");
    expect(n("suite-1")).toContain("b-corridor");
    expect(n("third-cabin")).toContain("third-stairs-e");
    // Never itself; a wall between is no opening.
    expect(n("suite-1")).not.toContain("suite-1");
    expect(n("suite-1")).not.toContain("suite-2");
  });

  it("sits in her frame (three-local x, z, −y) round each room", () => {
    // The Grand Staircase zone's box covers the well and the foyers.
    const g = built.zones.get("gs")!.shell!;
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

  it("never puts a balustrade's outer faces on another room's wall (no z-fighting)", () => {
    // A rail draws faces on its edge line facing out of its room; a wall
    // of the room beside (any zone) on the same line, at overlapping
    // heights, faces the same way and fights it (the black jagged patch
    // beside the third-class passage).
    const kinds = edgeKinds(interior, spec);
    const fz = (id: string, x: number, y: number) =>
      floorZ(map, id, x, spec, y);
    const bad: string[] = [];
    for (const A of interior.rooms)
      A.outline.forEach((a, i) => {
        if (kinds.get(A.id)![i].kind !== "rail") return;
        const b = A.outline[(i + 1) % A.outline.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / len;
        const uy = (b[1] - a[1]) / len;
        for (const B of interior.rooms) {
          if (B === A) continue;
          B.outline.forEach((c, j) => {
            if (kinds.get(B.id)![j].kind !== "wall") return;
            const d = B.outline[(j + 1) % B.outline.length];
            const off = (p: readonly number[]) =>
              Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux);
            if (off(c) > 1e-3 || off(d) > 1e-3) return;
            if ((d[0] - c[0]) * ux + (d[1] - c[1]) * uy >= 0) return;
            const t = (p: readonly number[]) =>
              (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
            const t0 = Math.max(0, Math.min(t(c), t(d)));
            const t1 = Math.min(len, Math.max(t(c), t(d)));
            if (t1 - t0 < 0.05) return;
            const m = (t0 + t1) / 2;
            // Just inside each room at the overlap's middle.
            const pa: [number, number] = [
              a[0] + ux * m - uy * 0.01,
              a[1] + uy * m + ux * 0.01,
            ];
            const pb: [number, number] = [
              a[0] + ux * m + uy * 0.01,
              a[1] + uy * m - ux * 0.01,
            ];
            const aLo = fz(A.id, ...pa) - 0.5;
            const aHi = fz(A.id, ...pa) + 1.0;
            const bLo = fz(B.id, ...pb);
            const bHi = bLo + B.ceilingM;
            if (Math.min(aHi, bHi) - Math.max(aLo, bLo) > 0.05)
              bad.push(`${A.id} rail on ${B.id}'s wall at ${m.toFixed(1)}`);
          });
        }
      });
    expect(bad).toEqual([]);
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
    // The roped B → C flight is open from the B foyer (the rope keeps you
    // out, not a wall): you look down it to the C landing.
    const head = interior.rooms
      .find((r) => r.id === "gs-flight-b-c")!
      .outline.filter((p) => Math.abs(p[0] - 35) < 1e-3)
      .map((p) => [p[0], p[1]] as [number, number]);
    expect(head).toHaveLength(2);
    expect(edgeAt("gs-flight-b-c", head[0], head[1])).toBe("seam");
    // And open at its foot onto the C landing (not a balustrade to the
    // A → B half landing stacked over the C landing).
    expect(edgeAt("gs-flight-b-c", [39, -1.5], [39, 1.5])).toBe("seam");
    // The C landing's after edge is open only at the flight's foot; either
    // side, under the A → B twin flights, it is closed (no holes there).
    expect(edgeAt("gs-c", [39, 1.5], [39, -1.5])).toBe("seam");
    expect(edgeAt("gs-c", [39, 3], [39, 1.5])).toBe("wall");
    expect(edgeAt("gs-c", [39, -1.5], [39, -3])).toBe("wall");
    // Under an A → B twin flight is nothing: its balustrade over the roped
    // flight carries a cheek down to the floor beside (no see-through
    // void under the stair); the A foyer's over the well has the B foyer
    // stacked under it, so none.
    const info = (id: string, p: [number, number], q: [number, number]) => {
      edgeAt(id, p, q);
      const room = interior.rooms.find((r) => r.id === id)!;
      const o = room.outline;
      const i = o.findIndex((a, k) => {
        const b = o[(k + 1) % o.length];
        const on = (v: readonly number[], w: [number, number]) =>
          Math.abs(v[0] - w[0]) < 1e-3 && Math.abs(v[1] - w[1]) < 1e-3;
        return (on(a, p) && on(b, q)) || (on(a, q) && on(b, p));
      });
      return kinds.get(id)![i];
    };
    const twin = interior.rooms.find((r) => r.id === "gs-flight-a-b-port")!;
    const inner = twin.outline.filter((p) => Math.abs(p[1] - 1.5) < 1e-3);
    expect(inner).toHaveLength(2);
    const cheek = info(
      "gs-flight-a-b-port",
      [inner[0][0], inner[0][1]],
      [inner[1][0], inner[1][1]]
    );
    expect(cheek.kind).toBe("rail");
    expect(cheek.cheek).toBeDefined();
    const foyerRail = info("gs-a", [41.4, 3], [35, 3]);
    expect(foyerRail.kind).toBe("rail");
    expect(foyerRail.cheek).toBeUndefined();
    // A suite and the corridor are level: a wall either side of the door.
    const suite = interior.rooms.find((r) => r.id === "suite-1")!;
    const kindsSuite = kinds.get("suite-1")!;
    expect(kindsSuite.filter((k) => k.kind === "rail")).toHaveLength(0);
    expect(kindsSuite.filter((k) => k.kind === "seam")).toHaveLength(1);
    expect(suite.outline.length).toBe(kindsSuite.length);
  });
});

// --- 1.17: deck rooms (her pool hall) -------------------------------------------

describe("the room kit, unchanged for the Titanic", () => {
  it("builds her zones to the same triangles and meshes as before deck rooms", () => {
    // Recorded at the Concordia's walking (1.17, before Task 4).
    const before: Record<string, [number, number]> = {
      gs: [14983, 4],
      "b-deck": [5872, 4],
      "e-deck": [12494, 4],
      "third-stairs": [1185, 3],
    };
    const now: Record<string, [number, number]> = {};
    for (const [zone, layers] of built.zones) {
      let tris = 0;
      let meshes = 0;
      for (const g of Object.values(layers))
        if (g) {
          meshes += 1;
          tris += triangles(g);
        }
      now[zone] = [tris, meshes];
    }
    expect(now).toEqual(before);
    expect(built.basins).toEqual([]);
    expect(built.deckZones.size).toBe(0);
    expect(built.modern).toBe(false);
    expect(built.slots).toBe(interior.rooms.length + built.segments.length);
  });
});

describe("her pool hall (a deck room)", () => {
  const hers = buildInterior(CONCORDIA_INTERIOR, concordia);
  const hall = CONCORDIA_INTERIOR.rooms[0];
  const herMap = walkMapFor("concordia") as WalkMap;
  const zone = hers.zones.get("pool-hall")!;
  const deck = floorZ(herMap, "pool-hall", 16, concordia, 0);
  afterAll(() => {
    for (const z of hers.zones.values())
      for (const g of Object.values(z)) g?.dispose();
  });

  it("is one zone within its budget: at most 25k triangles and 6 meshes (with its pool's water)", () => {
    // Its own zone (her rooms inside, 1.18, are theirs).
    expect([...hers.zones.keys()][0]).toBe("pool-hall");
    let tris = 0;
    let meshes = 0;
    for (const g of Object.values(zone))
      if (g) {
        meshes += 1;
        tris += triangles(g);
      }
    expect(hers.triangles.get("pool-hall")).toBe(tris);
    // Its layers and the pool's water (it has no room water: open deck).
    expect(hers.basins).toHaveLength(1);
    expect(meshes + hers.basins.length).toBeLessThanOrEqual(ZONE_MESH_BUDGET);
    expect(tris).toBeLessThanOrEqual(DECK_ROOM_TRIANGLE_BUDGET);
    expect(DECK_ROOM_TRIANGLE_BUDGET).toBe(25000);
    expect(hers.deckZones).toEqual(new Set(["pool-hall"]));
    expect(hers.modern).toBe(true);
    if (process.env.SHIPWRECK_PRINT_TRIANGLES)
      console.log(
        `pool hall: ${tris} triangles, ${meshes} meshes, build ${hers.ms.toFixed(1)} ms`
      );
  });

  it("builds every layer finite and tagged, its glass in the pane mesh", () => {
    for (const [layer, g] of Object.entries(zone)) {
      if (!g) continue;
      const n = g.getAttribute("position").count;
      for (const [name, size] of ATTRS) {
        const a = g.getAttribute(name);
        expect([layer, name, a?.count, a?.itemSize]).toEqual([
          layer,
          name,
          n,
          size,
        ]);
        expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
      }
      expect(Math.max(...g.getAttribute("color").array)).toBeLessThan(1);
    }
    expect(zone.shell).toBeDefined();
    expect(zone.metal).toBeDefined();
    expect(zone.glass).toBeDefined();
    const pane = zone.pane!;
    const tile = pane.getAttribute("aTile").array;
    // Clear glass (walls, vault) and the doors' frosted panes (two doors
    // of two leaves, two triangles each: 24 vertices).
    expect(
      Array.from(tile).filter((t) => t === MODERN_TILE.pane).length
    ).toBeGreaterThan(500);
    expect(Array.from(tile).filter((t) => t === FROSTED_TILE).length).toBe(24);
  });

  it("stands its floor 2 cm over the deck, cut round the pool's basin", () => {
    const g = zone.shell!;
    const pos = g.getAttribute("position").array;
    const nrm = g.getAttribute("normal").array;
    const tile = g.getAttribute("aTile").array;
    let floor = 0;
    const [cx, cy] = [16, 0];
    for (let v = 0; v < pos.length / 3; v += 1) {
      if (tile[v] !== MODERN_TILE.poolTile || nrm[v * 3 + 1] < 0.99) continue;
      const z = pos[v * 3 + 1];
      if (Math.abs(z - deck - DECK_ROOM_FLOOR_M) > 1e-4) continue;
      floor += 1;
      // No floor over the basin (9 × 4.5 m round the pool's middle).
      const x = pos[v * 3];
      const y = -pos[v * 3 + 2];
      expect(
        Math.abs(x - cx) < 4.5 - 1e-3 && Math.abs(y - cy) < 2.25 - 1e-3
      ).toBe(false);
    }
    expect(floor).toBeGreaterThan(1000);
    // The pool's basin goes down from there.
    const b = hers.basins[0];
    expect(
      b.rim.every((p) => Math.abs(p[2] - deck - DECK_ROOM_FLOOR_M) < 1e-6)
    ).toBe(true);
    expect(b.floorZ).toBeLessThan(deck - 1);
    expect(b.slot).toBe(CONCORDIA_INTERIOR.rooms.length + hers.segments.length);
    expect(hers.slots).toBe(b.slot + 1);
    expect(b.room).toBe(hers.slot.get("pool-hall"));
  });

  it("roofs it in glass at the eaves, as high as the lidos, her dome on it, and tags what the day lights", () => {
    const pane = zone.pane!;
    pane.computeBoundingBox();
    const box = pane.boundingBox!;
    const eaves = deck + DECK_ROOM_FLOOR_M + hall.ceilingM;
    const dome = hall.look.dome!;
    // Her model's dome (the same shape, see-through).
    expect(dome).toEqual({
      at: [CONCORDIA_POOL_DOME.x, 0],
      a: CONCORDIA_POOL_DOME.a,
      b: CONCORDIA_POOL_DOME.b,
      rise: CONCORDIA_POOL_DOME.c,
    });
    expect(box.max.y).toBeCloseTo(eaves + dome.rise, 2);
    expect(box.min.x).toBeGreaterThanOrEqual(-2);
    expect(box.max.x).toBeLessThanOrEqual(34);
    expect(box.max.z).toBeLessThanOrEqual(13.5);
    // The flat glass at the eaves reaches the hall's corners.
    const pos = pane.getAttribute("position").array;
    let corner = 0;
    for (let v = 0; v < pos.length / 3; v += 1)
      if (
        Math.abs(pos[v * 3 + 1] - eaves) < 1e-4 &&
        pos[v * 3] < -1.9 &&
        -pos[v * 3 + 2] < -13.4
      )
        corner += 1;
    expect(corner).toBeGreaterThan(0);
    // The shell, wood and metal catch the day (aGlow 1 on a deck room).
    for (const layer of ["shell", "metal"] as const) {
      const glow = zone[layer]!.getAttribute("aGlow").array;
      expect([layer, Math.min(...glow), Math.max(...glow)]).toEqual([
        layer,
        1,
        1,
      ]);
    }
    // Lamps: the spotlights on the vault light the floor at night.
    const light = zone.shell!.getAttribute("aLight").array;
    expect(Math.max(...light)).toBeGreaterThan(0.6);
  });
});

describe("her rooms inside (1.18 blockout)", () => {
  const hers = buildInterior(CONCORDIA_INTERIOR, concordia);
  afterAll(() => {
    for (const z of hers.zones.values())
      for (const g of Object.values(z)) g?.dispose();
  });

  it("builds her zones within the spec's budgets (the atrium 50k, the rest 40k, all 140k)", () => {
    expect([...hers.zones.keys()].sort()).toEqual(
      [
        "atrium",
        "low-cabins",
        "pool-hall",
        "squok",
        "stateroom",
        "theatre",
      ].sort()
    );
    let total = 0;
    for (const [zone, layers] of hers.zones) {
      let tris = 0;
      let meshes = 0;
      for (const g of Object.values(layers))
        if (g) {
          meshes += 1;
          tris += triangles(g);
          const n = g.getAttribute("position").count;
          for (const [name, size] of ATTRS) {
            const a = g.getAttribute(name);
            expect([zone, name, a?.count, a?.itemSize]).toEqual([
              zone,
              name,
              n,
              size,
            ]);
          }
          expect(
            Array.from(g.getAttribute("position").array).every(Number.isFinite)
          ).toBe(true);
        }
      total += tris;
      if (zone === "pool-hall") continue;
      // Its layers, and the water's surface and body.
      expect([zone, meshes + 2 <= ZONE_MESH_BUDGET]).toEqual([zone, true]);
      expect([zone, tris <= (zone === "atrium" ? 50000 : 40000)]).toEqual([
        zone,
        true,
      ]);
    }
    expect(total).toBeLessThanOrEqual(140000);
    expect(hers.slots).toBeLessThanOrEqual(MAX_ROOM_SLOTS);
  });

  it("draws each lift car with its landing (its zone and slot)", () => {
    for (const l of CONCORDIA_INTERIOR.lifts ?? [])
      for (const s of l.stops) {
        const id = `${l.id}@${s.deck}`;
        expect(hers.roomZone.get(id)).toBe(hers.roomZone.get(s.landing));
        expect(hers.slot.get(id)).toBe(hers.slot.get(s.landing));
      }
  });

  it("opens her atrium to its well (no lintel) and rails its galleries over it", () => {
    const kinds = edgeKinds(CONCORDIA_INTERIOR, concordia);
    const seamTo = (room: string, other: string) =>
      kinds
        .get(room)!
        .filter((e) => e.kind === "seam" && e.other?.id === other);
    expect(seamTo("atrium-3", "atrium-well").length).toBeGreaterThan(0);
    for (const e of seamTo("atrium-3", "atrium-well"))
      expect(e.lintel).toBeUndefined();
    // A gallery's edges round the well are balustrades.
    expect(
      kinds.get("atrium-4")!.filter((e) => e.kind === "rail").length
    ).toBeGreaterThanOrEqual(3);
    expect(
      kinds.get("atrium-5")!.filter((e) => e.kind === "rail").length
    ).toBeGreaterThanOrEqual(3);
    // The theatre's balcony front over the stalls, and the balcony's side
    // over the sea, are rails; a cabin's doorway keeps its lintel.
    expect(kinds.get("theatre-balcony")!.some((e) => e.kind === "rail")).toBe(
      true
    );
    const balcony = CONCORDIA_INTERIOR.rooms.find((r) => r.id === "balcony")!;
    const outboard = balcony.outline.findIndex(
      (p, k) =>
        Math.abs(p[1]) > 17.5 &&
        Math.abs(balcony.outline[(k + 1) % balcony.outline.length][1]) > 17.5
    );
    expect(kinds.get("balcony")![outboard].kind).toBe("rail");
    expect(
      seamTo("corridor-1", "cabin-inside").every((e) => e.lintel !== undefined)
    ).toBe(true);
  });
});

describe("her rooms' look (1.18)", () => {
  const hers = buildInterior(CONCORDIA_INTERIOR, concordia);
  afterAll(() => {
    for (const z of hers.zones.values())
      for (const g of Object.values(z)) g?.dispose();
  });
  const slotOf = (room: string) => hers.slot.get(room)!;
  /** A layer's vertices in a room: their attribute values. */
  function inRoom(
    zone: string,
    layer: ZoneLayerName,
    room: string,
    attr: string
  ) {
    const g = hers.zones.get(zone)![layer];
    if (!g) return [] as number[];
    const r = g.getAttribute("aRoom").array;
    const a = g.getAttribute(attr).array;
    const k = slotOf(room);
    const parts = new Set(
      hers.segments.filter((s) => s.room === k).map((s) => s.slot)
    );
    const out: number[] = [];
    for (let v = 0; v < r.length; v += 1)
      if (r[v] === k || parts.has(r[v])) out.push(a[v]);
    return out;
  }
  type ZoneLayerName = "shell" | "wood" | "metal" | "glass" | "pane";

  it("keeps her budgets: the atrium 50k and 7 meshes, every other zone inside her 40k and 6 (with its water), all 140k", () => {
    let total = 0;
    for (const [zone, layers] of hers.zones) {
      let tris = 0;
      let meshes = 0;
      for (const g of Object.values(layers))
        if (g) {
          meshes += 1;
          tris += triangles(g);
        }
      total += tris;
      if (zone === "pool-hall") continue;
      const atrium = zone === "atrium";
      expect([zone, meshes + 2 <= (atrium ? 7 : 6)]).toEqual([zone, true]);
      expect([zone, tris <= (atrium ? 50000 : 40000)]).toEqual([zone, true]);
      if (process.env.SHIPWRECK_PRINT_TRIANGLES)
        console.log(`${zone}: ${tris} triangles, ${meshes} meshes`);
    }
    expect(total).toBeLessThanOrEqual(140000);
  });

  it("finishes her rooms in her tiles: veneer, cream, marble, the mural, velvet; carpet, marble, soft play, stage boards", () => {
    const has = (zone: string, room: string, tile: number) =>
      inRoom(zone, "shell", room, "aTile").includes(tile);
    expect(has("stateroom", "stateroom", MODERN_TILE.veneer)).toBe(true);
    expect(has("stateroom", "stateroom", MODERN_TILE.cabinCarpet)).toBe(true);
    expect(has("low-cabins", "corridor-1", MODERN_TILE.cream)).toBe(true);
    expect(has("atrium", "atrium-3", MODERN_TILE.marble)).toBe(true);
    expect(has("squok", "squok", MODERN_TILE.mural)).toBe(true);
    expect(has("squok", "squok", MODERN_TILE.softPlay)).toBe(true);
    expect(has("theatre", "theatre", MODERN_TILE.theatre)).toBe(true);
    expect(has("theatre", "stage", MODERN_TILE.stageWood)).toBe(true);
  });

  it("draws her panes last in each inside zone's glass mesh (only the pool hall keeps a pane mesh)", () => {
    for (const [zone, layers] of hers.zones) {
      expect([zone, layers.pane !== undefined]).toEqual([
        zone,
        zone === "pool-hall",
      ]);
      if (zone === "pool-hall") continue;
      const tile = Array.from(layers.glass!.getAttribute("aTile").array);
      const first = tile.findIndex((t) => t === MODERN_TILE.pane);
      if (first < 0) continue;
      expect(tile.slice(first).every((t) => t >= MODERN_TILE.pane)).toBe(true);
    }
    // Her galleries' glass rails, the stair's, the lifts' fronts.
    expect(inRoom("atrium", "glass", "atrium-4", "aTile")).toContain(
      MODERN_TILE.pane
    );
    // The balcony's glass rail over the sea.
    expect(inRoom("stateroom", "glass", "balcony", "aTile")).toContain(
      MODERN_TILE.pane
    );
  });

  /**
   * Her glass pane triangles lying on the wall line at x with |y| in
   * [y0, y1]: their centroids (ship x, y, z) and their lowest and highest
   * z. Non-indexed geometry.
   */
  function panesOn(zone: string, x: number, y0: number, y1: number) {
    const g = hers.zones.get(zone)!.glass!;
    const pos = g.getAttribute("position").array;
    const tile = g.getAttribute("aTile").array;
    const out: [number, number, number, number, number][] = [];
    for (let v = 0; v + 2 < tile.length; v += 3) {
      if (tile[v] !== MODERN_TILE.pane && tile[v] !== MODERN_TILE.liftGlass)
        continue;
      let flat = true;
      let cy = 0;
      let cz = 0;
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < 3; k += 1) {
        const i = (v + k) * 3;
        if (Math.abs(pos[i] - x) > 1e-3) flat = false;
        cy += -pos[i + 2] / 3;
        cz += pos[i + 1] / 3;
        lo = Math.min(lo, pos[i + 1]);
        hi = Math.max(hi, pos[i + 1]);
      }
      if (flat && Math.abs(cy) > y0 && Math.abs(cy) < y1)
        out.push([x, cy, cz, lo, hi]);
    }
    return out;
  }

  it("glasses her atrium's after wall across both lift shafts, to the cove and over the doors (never in a doorway)", () => {
    const floors = ["3", "4", "5"].map((d) => deckZAt(d, 0, concordia));
    const storey = (z: number) => floors.filter((f) => f <= z + 1e-3).pop()!;
    const glass = panesOn("atrium", 64.2, 1.44, 3.76);
    expect(glass.length).toBeGreaterThan(0);
    for (const f of floors) {
      const mine = glass.filter(([, , z]) => storey(z) === f);
      // Every storey: glass beside each door from the floor towards the cove.
      const beside = mine.filter(
        ([, y]) => Math.abs(y) < 2.0 || Math.abs(y) > 3.2
      );
      expect(beside.length).toBeGreaterThan(0);
      expect(Math.min(...beside.map((t) => t[3])) - f).toBeCloseTo(0, 3);
      const room = CONCORDIA_INTERIOR.rooms.find(
        (r) => r.id === `atrium-${floors.indexOf(f) + 3}`
      )!;
      // To the cove (0.14 m under the ceiling).
      expect(Math.max(...beside.map((t) => t[4])) - f).toBeCloseTo(
        room.ceilingM - 0.14,
        3
      );
      // Over the door's head too (|y| 2.0..3.2), never in the doorway.
      const door = mine.filter(
        ([, y]) => Math.abs(y) > 2.0 && Math.abs(y) < 3.2
      );
      expect(door.length).toBeGreaterThan(0);
      for (const [, , z] of door) expect(z - f).toBeGreaterThan(DOOR_HEAD_M);
    }
    // Both shafts, port and starboard.
    expect(glass.some(([, y]) => y > 0)).toBe(true);
    expect(glass.some(([, y]) => y < 0)).toBe(true);
    // Between the shafts the wall stays a wall.
    expect(panesOn("atrium", 64.2, 0, 1.4)).toEqual([]);
    // It is the lift glass (its own look), and the rails stay panes.
    const tiles = new Set(inRoom("atrium", "glass", "atrium-4", "aTile"));
    expect(tiles.has(MODERN_TILE.liftGlass)).toBe(true);
    expect(tiles.has(MODERN_TILE.pane)).toBe(true);
  });

  it("leaves the lobbies' lift walls solid but for the doors (the cars carry their own glass)", () => {
    expect(panesOn("low-cabins", 62, 1.4, 3.8)).toEqual([]);
    expect(panesOn("stateroom", 62, 1.4, 3.8)).toEqual([]);
  });

  it("puts the shaft glass only on landings the shaft opens onto (the atrium), up to each one's cove", () => {
    const walls = liftGlassWalls(
      CONCORDIA_INTERIOR.rooms,
      CONCORDIA_INTERIOR.lifts!
    );
    expect([...walls.keys()].sort()).toEqual([
      "atrium-3",
      "atrium-4",
      "atrium-5",
    ]);
    for (const [id, list] of walls) {
      const room = CONCORDIA_INTERIOR.rooms.find((r) => r.id === id)!;
      expect(list).toHaveLength(2);
      for (const f of list) {
        expect(f.top).toBeCloseTo(room.ceilingM - 0.14, 6);
        expect(Math.abs(f.b[1] - f.a[1])).toBeCloseTo(2.2 + 0.12, 6);
      }
    }
    expect(liftGlassWalls(TITANIC_INTERIOR.rooms, []).size).toBe(0);
  });

  it("stands the moving car's glass ends a hand inside its ends and its frame and shaft off the landings' walls: nothing doubled at a stop", () => {
    const lifts = buildLiftCars(
      CONCORDIA_INTERIOR,
      concordia,
      new Map(CONCORDIA_INTERIOR.rooms.map((r) => [r.id, r.zone])),
      new MeshBasicMaterial(),
      new MeshBasicMaterial()
    )!;
    const lift = CONCORDIA_INTERIOR.lifts![0];
    const halfX = (lift.car.max[0] - lift.car.min[0]) / 2;
    const pos = lifts.cars[0].pane.geometry.getAttribute("position").array;
    let ends = 0;
    for (let v = 0; v < pos.length / 3; v += 1) {
      // Local three (x, z, −y): x along her, from the car's middle.
      const x = Math.abs(pos[v * 3]);
      // Off the side glass (which runs the car's length at its sides).
      const y = Math.abs(pos[v * 3 + 2]);
      if (y > (lift.car.max[1] - lift.car.min[1]) / 2 - 0.05) continue;
      ends += 1;
      expect(halfX - x).toBeGreaterThanOrEqual(CAR_END_INSET_M - 1e-6);
    }
    expect(ends).toBeGreaterThan(0);
    expect(CAR_END_INSET_M).toBeGreaterThanOrEqual(0.08);
    // Its panes are the lift glass; its downlights and cone lights glow.
    expect(
      Array.from(lifts.cars[0].pane.geometry.getAttribute("aTile").array).every(
        (t) => t === MODERN_TILE.liftGlass
      )
    ).toBe(true);
    expect(
      Array.from(lifts.cars[0].body.geometry.getAttribute("aGlow").array).some(
        (g) => g === 1
      )
    ).toBe(true);
    // Nothing of the car (frame, floor, posts) on its plan's end lines,
    // where the landings' walls stand at a stop.
    const body = lifts.cars[0].body.geometry.getAttribute("position").array;
    for (let v = 0; v < body.length / 3; v += 1)
      expect(halfX - Math.abs(body[v * 3])).toBeGreaterThan(0.01);
    // The shafts never poke through a lobby's wall or the atrium's glass.
    const shaft = lifts.shaft.geometry.getAttribute("position").array;
    for (let v = 0; v < shaft.length / 3; v += 1) {
      expect(shaft[v * 3]).toBeGreaterThanOrEqual(lift.car.min[0] - 1e-6);
      expect(shaft[v * 3]).toBeLessThanOrEqual(lift.car.max[0] + 1e-6);
    }
    disposeLiftCars(lifts);
  });

  it("lights her rooms by their lamp style: downlights down a corridor, the chandelier over the well, the theatre's strips and house lights", () => {
    for (const [zone, room] of [
      ["low-cabins", "corridor-1"],
      ["atrium", "atrium-well"],
      ["theatre", "theatre"],
      ["squok", "squok"],
      ["stateroom", "stateroom"],
    ] as const) {
      const light = inRoom(zone, "shell", room, "aLight");
      const mean = light.reduce((s, l) => s + l, 0) / light.length;
      expect([room, mean > 0.3]).toEqual([room, true]);
    }
  });

  it("puts her emergency strips and exit signs on the emergency supply, their light in aGlow under 0 (a deck room's stays its daylight)", () => {
    const glassTiles = (zone: string, room: string) =>
      inRoom(zone, "glass", room, "aTile");
    for (const [zone, room] of [
      ["low-cabins", "corridor-1"],
      ["low-cabins", "lobby-1"],
      ["atrium", "atrium-3"],
      ["theatre", "theatre"],
      ["squok", "squok"],
    ] as const) {
      expect([
        room,
        glassTiles(zone, room).includes(MODERN_TILE.emergency),
      ]).toEqual([room, true]);
      const glow = inRoom(zone, "shell", room, "aGlow");
      expect([room, Math.max(...glow) <= 0, Math.min(...glow) < -0.05]).toEqual(
        [room, true, true]
      );
    }
    const hall = hers.zones
      .get("pool-hall")!
      .shell!.getAttribute("aGlow").array;
    expect(Math.min(...hall)).toBe(1);
  });

  it("lights her club's door in the pool hall's own glass (tagged with the club), not in the deck doors' glow mesh", () => {
    const squok = slotOf("squok");
    expect(hers.deckDoorSlots).toEqual([squok]);
    const g = hers.zones.get("pool-hall")!.glass!;
    const room = g.getAttribute("aRoom").array;
    const glow = g.getAttribute("aGlow").array;
    const col = g.getAttribute("color").array;
    const pos = g.getAttribute("position").array;
    const door = CONCORDIA_INTERIOR.links.find((l) => l.id === "squok")!;
    let hdr = 0;
    for (let v = 0; v < room.length; v += 1) {
      if (room[v] !== squok) continue;
      // On the hall's forward wall, round the door's outside end.
      expect(Math.abs(pos[v * 3] - door.from.at[0])).toBeLessThan(0.5);
      expect(Math.abs(-pos[v * 3 + 2] - door.from.at[1])).toBeLessThan(0.7);
      if (glow[v] * col[v * 3] > 1) hdr += 1;
    }
    expect(hdr).toBeGreaterThan(0);
    // The deck doors' glow mesh draws only the doors on her open decks.
    const herMap = walkMapFor("concordia") as WalkMap;
    const dg = doorGlowGeometry(CONCORDIA_INTERIOR, herMap, concordia);
    const dp = dg.getAttribute("position");
    for (let i = 0; i < dp.count; i += 1)
      expect(
        Math.hypot(
          dp.getX(i) - door.from.at[0],
          -dp.getZ(i) - door.from.at[1]
        ) > 1.5
      ).toBe(true);
    expect(dp.count).toBe(18 * 2);
    dg.dispose();
    // The Titanic has no deck rooms: nothing of the kind.
    expect(built.deckDoorSlots).toEqual([]);
  });

  it("closes her cabins with her doors (veneer), not the Titanic's", () => {
    expect(inRoom("low-cabins", "wood", "corridor-1", "aTile")).toContain(
      MODERN_TILE.veneer
    );
  });
});
