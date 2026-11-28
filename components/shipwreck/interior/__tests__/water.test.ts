import { concordia } from "@/lib/shipwreck/ships/concordia";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { roomFloorZ, TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { CONCORDIA_INTERIOR } from "@/lib/shipwreck/interior/concordia";
import { pointInPolygon } from "@/lib/shipwreck/walk";
import {
  interiorWater,
  waterMaterials,
  WATER_BODY_ORDER,
  WATER_SURFACE_ORDER,
} from "../water";

/**
 * The water inside, as geometry: per zone one surface (each room's plan,
 * triangulated, at its floor and ceiling) and one body (its walls and
 * balustrades, inset) per room, every vertex tagged with its room's slot
 * (`aRoom`) in the level and power uniforms.
 */

const spec = titanic;
const interior = TITANIC_INTERIOR;
const water = interiorWater(interior, spec);

afterAll(() => {
  for (const z of water.zones.values()) {
    z.surface.dispose();
    z.body.dispose();
  }
});

function roomsIn(g: import("three").BufferGeometry): Set<number> {
  const a = g.getAttribute("aRoom");
  const out = new Set<number>();
  for (let i = 0; i < a.count; i += 1) out.add(a.getX(i));
  return out;
}

describe("the water inside (geometry)", () => {
  it("gives every room a slot, and each zone its rooms' slots", () => {
    expect(water.count).toBe(interior.rooms.length);
    const slots = new Set(water.slot.values());
    expect(slots.size).toBe(interior.rooms.length);
    for (const k of slots) {
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(water.count);
    }
    for (const r of interior.rooms)
      expect(water.zoneSlots.get(r.zone)).toContain(water.slot.get(r.id));
  });

  it("has one surface and one body per walkable or noWalk room in a zone", () => {
    const zones = new Set(interior.rooms.map((r) => r.zone));
    expect(new Set(water.zones.keys())).toEqual(zones);
    for (const [zone, g] of water.zones) {
      const want = new Set(
        interior.rooms
          .filter((r) => r.zone === zone)
          .map((r) => water.slot.get(r.id)!)
      );
      expect([zone, roomsIn(g.surface)]).toEqual([zone, want]);
      expect([zone, roomsIn(g.body)]).toEqual([zone, want]);
    }
  });

  it("keeps the surface's attributes in range: plan points, floor under ceiling", () => {
    for (const [, { surface }] of water.zones) {
      const pos = surface.getAttribute("position");
      const floor = surface.getAttribute("aFloor");
      const top = surface.getAttribute("aTop");
      const room = surface.getAttribute("aRoom");
      expect(pos.count % 3).toBe(0);
      expect(floor.count).toBe(pos.count);
      expect(top.count).toBe(pos.count);
      for (let i = 0; i < pos.count; i += 1) {
        expect(Number.isFinite(pos.getX(i))).toBe(true);
        expect(Number.isFinite(pos.getZ(i))).toBe(true);
        // The plan only: the shader climbs to the level.
        expect(pos.getY(i)).toBe(0);
        expect(Number.isFinite(floor.getX(i))).toBe(true);
        expect(top.getX(i)).toBeGreaterThan(floor.getX(i) + 2);
        // At (or a riser under) the room's own floor there.
        const r = interior.rooms[room.getX(i)];
        const x = pos.getX(i);
        const y = -pos.getZ(i);
        const fz = roomFloorZ(r, x, y, spec);
        expect(floor.getX(i)).toBeLessThanOrEqual(fz + 1e-4);
        expect(floor.getX(i)).toBeGreaterThan(fz - 0.3);
      }
    }
  });

  it("insets the body into its room and keeps it finite", () => {
    for (const [, { body }] of water.zones) {
      const pos = body.getAttribute("position");
      const room = body.getAttribute("aRoom");
      expect(pos.count % 3).toBe(0);
      for (let t = 0; t < pos.count; t += 3) {
        let cx = 0;
        let cy = 0;
        for (let k = 0; k < 3; k += 1) {
          expect(Number.isFinite(pos.getY(t + k))).toBe(true);
          cx += pos.getX(t + k) / 3;
          cy += -pos.getZ(t + k) / 3;
        }
        const r = interior.rooms[room.getX(t)];
        expect([r.id, pointInPolygon([cx, cy], r.outline)]).toEqual([
          r.id,
          true,
        ]);
      }
    }
  });

  it("marks a seeping room's surface (hers: aClear -1) for its brighter water; every Titanic room's stays 0", () => {
    const clearOf = (w: ReturnType<typeof interiorWater>) => {
      const bySlot = new Map<number, Set<number>>();
      for (const z of w.zones.values()) {
        const room = z.surface.getAttribute("aRoom");
        const clear = z.surface.getAttribute("aClear");
        expect(clear.count).toBe(room.count);
        for (let i = 0; i < room.count; i += 1) {
          const k = room.getX(i);
          if (!bySlot.has(k)) bySlot.set(k, new Set());
          bySlot.get(k)!.add(clear.getX(i));
        }
      }
      return bySlot;
    };
    for (const values of clearOf(water).values())
      expect([...values]).toEqual([0]);
    const hers = interiorWater(CONCORDIA_INTERIOR, concordia);
    const by = clearOf(hers);
    for (const room of CONCORDIA_INTERIOR.rooms) {
      const values = by.get(hers.slot.get(room.id)!);
      if (!values) continue;
      expect([...values]).toEqual([room.seep ? -1 : 0]);
    }
    expect([...by.get(hers.slot.get("lobby-1")!)!].every((v) => v === -1)).toBe(
      true
    );
    for (const z of hers.zones.values()) {
      z.surface.dispose();
      z.body.dispose();
    }
  });

  it("draws after the rooms (renderOrder over 10), see-through, no depth write", () => {
    expect(WATER_BODY_ORDER).toBeGreaterThan(10);
    expect(WATER_SURFACE_ORDER).toBeGreaterThan(WATER_BODY_ORDER);
    const m = waterMaterials(water.count);
    for (const mat of [m.surface, m.body]) {
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.fog).toBe(false);
    }
    expect(m.levels).toHaveLength(water.count);
    expect(m.surface.uniforms.uLevel.value).toBe(m.levels);
    expect(m.body.uniforms.uLevel.value).toBe(m.levels);
    // Task 6's lights, stubbed: every room's lamps on, the torch off.
    expect(Array.from(m.power)).toEqual(new Array(water.count).fill(1));
    expect(m.surface.uniforms.uRoomPower.value).toBe(m.power);
    expect(m.surface.uniforms.uTorchOn.value).toBe(0);
    m.surface.dispose();
    m.body.dispose();
  });
});
