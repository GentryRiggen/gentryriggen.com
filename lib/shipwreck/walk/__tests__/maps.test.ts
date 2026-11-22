import { getShip } from "../../ships";
import type { ShipId } from "../../ships/types";
import {
  floorZ,
  insideBlocker,
  pointInPolygon,
  walkMapFor,
  WALK_RADIUS_M,
  type V2,
  type WalkMap,
} from "..";

function signedArea(poly: readonly V2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function distToSegment(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const u =
    len2 > 0
      ? Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)
        )
      : 0;
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
}

function area(map: WalkMap, id: string) {
  const a = map.areas.find((x) => x.id === id);
  if (!a) throw new Error(`no area ${id}`);
  return a;
}

const EXPECTED: Record<"titanic" | "lusitania", string[]> = {
  titanic: ["boat-deck", "forward-well", "forecastle", "aft-well", "poop"],
  lusitania: ["boat-deck", "forecastle", "stern"],
};

it("has no map for a ship without one", () => {
  expect(walkMapFor("edmund-fitzgerald" as ShipId)).toBeNull();
});

describe.each(["titanic", "lusitania"] as const)("the %s walk map", (id) => {
  const spec = getShip(id);
  const map = walkMapFor(id) as WalkMap;

  it("exists for her", () => {
    expect(map).not.toBeNull();
    expect(map.ship).toBe(id);
  });

  it("has her open decks", () => {
    const ids = map.areas.map((a) => a.id);
    for (const want of EXPECTED[id]) expect(ids).toContain(want);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lays every area on one of her decks, inside her, counter-clockwise", () => {
    const decks = spec.decks.map((d) => d.name);
    // The frame's origin is midships on the LBP, so her ends are not at
    // ±loa/2: check against the hull's own ends (the stations).
    const sternX = spec.stations[0].x;
    const stemX = spec.stations[spec.stations.length - 1].x;
    expect(stemX - sternX).toBeCloseTo(spec.loa, 0);
    for (const a of map.areas) {
      expect(decks).toContain(a.deck);
      expect(a.outline.length).toBeGreaterThanOrEqual(3);
      expect(signedArea(a.outline)).toBeGreaterThan(0);
      for (const [x, y] of a.outline) {
        expect(Math.abs(y)).toBeLessThanOrEqual(spec.beam / 2);
        expect(x).toBeGreaterThanOrEqual(sternX);
        expect(x).toBeLessThanOrEqual(stemX);
      }
      for (const i of [...(a.openEdges ?? []), ...(a.wallEdges ?? [])]) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(a.outline.length);
      }
    }
  });

  it("puts every blocker inside its area", () => {
    for (const b of map.blockers) {
      const centre: V2 =
        b.kind === "circle"
          ? b.at
          : [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
      expect([b, pointInPolygon(centre, area(map, b.area).outline)]).toEqual([
        b,
        true,
      ]);
    }
  });

  it("blocks each funnel's base on the boat deck", () => {
    for (const f of spec.funnels) {
      const hit = map.blockers.find(
        (b) =>
          b.kind === "circle" &&
          b.area === "boat-deck" &&
          Math.abs(b.at[0] - f.x) < 2
      );
      expect(hit).toBeDefined();
    }
  });

  it("joins decks of different heights with stairs inside both", () => {
    expect(map.stairs.length).toBeGreaterThan(0);
    for (const s of map.stairs) {
      for (const end of [s.from, s.to]) {
        expect(pointInPolygon(end.at, area(map, end.area).outline)).toBe(true);
        // The walker's whole body fits at each end.
        expect([
          s.id,
          end.area,
          insideBlocker(map, end.area, end.at, WALK_RADIUS_M),
        ]).toEqual([s.id, end.area, false]);
      }
      const dz =
        floorZ(map, s.to.area, s.to.at[0], spec) -
        floorZ(map, s.from.area, s.from.at[0], spec);
      // A ladder; the Lusitania's gangway instead bridges the mast gap
      // between two decks at the same height.
      if (s.id.includes("gangway")) expect(Math.abs(dz)).toBeLessThan(0.5);
      else expect(Math.abs(dz)).toBeGreaterThan(1);
    }
  });

  it("spawns clear of blockers and at least 1 m from every railing", () => {
    const a = area(map, map.spawn.area);
    expect(pointInPolygon(map.spawn.at, a.outline)).toBe(true);
    expect(insideBlocker(map, a.id, map.spawn.at, 0)).toBe(false);
    const open = new Set(a.openEdges ?? []);
    for (let i = 0; i < a.outline.length; i += 1) {
      if (open.has(i)) continue;
      const d = distToSegment(
        map.spawn.at,
        a.outline[i],
        a.outline[(i + 1) % a.outline.length]
      );
      expect(d).toBeGreaterThanOrEqual(1);
    }
  });

  it("reaches every area from the spawn by stairs", () => {
    const seen = new Set([map.spawn.area]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of map.stairs) {
        const a = seen.has(s.from.area);
        const b = seen.has(s.to.area);
        if (a !== b) {
          seen.add(s.from.area);
          seen.add(s.to.area);
          grew = true;
        }
      }
    }
    expect([...seen].sort()).toEqual(map.areas.map((x) => x.id).sort());
  });

  it("gives floor heights from the deck and its sheer", () => {
    const boat = area(map, "boat-deck");
    const x = map.spawn.at[0];
    const deckZ =
      (spec.decks.find((d) => d.name === boat.deck)?.z ?? 0) +
      spec.sheerZ(x) -
      (spec.decks.find((d) => d.name === "C")?.z ?? 0);
    expect(floorZ(map, "boat-deck", x, spec)).toBeCloseTo(
      deckZ + (boat.raiseM ?? 0),
      9
    );
  });
});

describe("the Lusitania's boat deck", () => {
  const map = walkMapFor("lusitania") as WalkMap;
  const boat = area(map, "boat-deck");
  const front = Math.max(...boat.outline.map(([x]) => x));

  it("walls its rounded front corners (over the foredeck, not the sea)", () => {
    const n = boat.outline.length;
    for (let i = 0; i < n; i += 1) {
      const a = boat.outline[i];
      const b = boat.outline[(i + 1) % n];
      if (Math.max(a[0], b[0]) > front - 4)
        expect([i, boat.wallEdges?.includes(i)]).toEqual([i, true]);
    }
  });

  it("has a gangway straight to the after deck", () => {
    const direct = map.stairs.filter(
      (s) =>
        (s.from.area === "boat-deck" && s.to.area === "aft-deck") ||
        (s.from.area === "aft-deck" && s.to.area === "boat-deck")
    );
    expect(direct.length).toBe(2);
  });
});
