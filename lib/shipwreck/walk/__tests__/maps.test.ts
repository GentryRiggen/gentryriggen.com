import { britannicRecipe } from "@/components/shipwreck/model/britannicRecipe";
import { carpathiaRecipe } from "@/components/shipwreck/model/carpathiaRecipe";
import { getShip } from "../../ships";
import {
  BRITANNIC_BOAT,
  BRITANNIC_GANTRY_ARM_DX,
  BRITANNIC_GANTRY_REACH,
  BRITANNIC_GANTRY_SETS,
} from "../../ships/britannic";
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

const EXPECTED: Record<
  "titanic" | "lusitania" | "britannic" | "carpathia",
  string[]
> = {
  titanic: ["boat-deck", "forward-well", "forecastle", "aft-well", "poop"],
  britannic: ["boat-deck", "forward-well", "forecastle", "aft-well", "poop"],
  lusitania: ["boat-deck", "forecastle", "stern"],
  carpathia: [
    "boat-deck",
    "bridge-deck",
    "forward-well",
    "forecastle",
    "after-deck",
    "promenade-port",
    "promenade-starboard",
  ],
};

it("has no map for a ship without one", () => {
  expect(walkMapFor("edmund-fitzgerald" as ShipId)).toBeNull();
});

describe.each(["titanic", "lusitania", "britannic", "carpathia"] as const)(
  "the %s walk map",
  (id) => {
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
        for (const i of a.wallEdges ?? []) {
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
          expect(pointInPolygon(end.at, area(map, end.area).outline)).toBe(
            true
          );
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
        // between two decks at the same height, and a deck door (1.15)
        // steps from the deck into a room on it.
        if (s.id.includes("gangway") || s.kind === "door")
          expect(Math.abs(dz)).toBeLessThan(0.5);
        else expect(Math.abs(dz)).toBeGreaterThan(1);
      }
    });

    it("spawns clear of blockers and at least 1 m from every railing", () => {
      const a = area(map, map.spawn.area);
      expect(pointInPolygon(map.spawn.at, a.outline)).toBe(true);
      expect(insideBlocker(map, a.id, map.spawn.at, 0)).toBe(false);
      for (let i = 0; i < a.outline.length; i += 1) {
        const d = distToSegment(
          map.spawn.at,
          a.outline[i],
          a.outline[(i + 1) % a.outline.length]
        );
        expect(d).toBeGreaterThanOrEqual(1);
      }
    });

    it("reaches every area from the spawn by stairs (and an interior's seams)", () => {
      const seen = new Set([map.spawn.area]);
      const links = [
        ...map.stairs.map((s) => [s.from.area, s.to.area] as const),
        ...(map.seams ?? []).map((s) => [s.a, s.b] as const),
      ];
      let grew = true;
      while (grew) {
        grew = false;
        for (const [from, to] of links) {
          const a = seen.has(from);
          const b = seen.has(to);
          if (a !== b) {
            seen.add(from);
            seen.add(to);
            grew = true;
          }
        }
      }
      // A room drawn but not walked (noWalk) has no way in.
      expect([...seen].sort()).toEqual(
        map.areas
          .filter((x) => !x.noWalk)
          .map((x) => x.id)
          .sort()
      );
    });

    it("gives floor heights from the deck and its sheer", () => {
      const boat = area(map, "boat-deck");
      const x = map.spawn.at[0];
      const deckZ =
        (spec.decks.find((d) => d.name === boat.deck)?.z ?? 0) +
        spec.sheerZ(x) -
        (spec.decks.find((d) => d.name === (id === "carpathia" ? "Upper" : "C"))
          ?.z ?? 0);
      expect(floorZ(map, "boat-deck", x, spec)).toBeCloseTo(
        deckZ + (boat.raiseM ?? 0),
        9
      );
    });
  }
);

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

describe("the Britannic's walk map", () => {
  const spec = getShip("britannic");
  const map = walkMapFor("britannic") as WalkMap;
  const recipe = britannicRecipe(spec);
  const gantries = recipe.gantries ?? [];

  function covered(area: string, p: V2): boolean {
    return insideBlocker(map, area, p, 0);
  }

  it("is her own, at her 94 ft beam", () => {
    expect(map.ship).toBe("britannic");
    expect(spec.beam).toBeCloseTo(28.65, 1);
    const boat = area(map, "boat-deck");
    const widest = Math.max(...boat.outline.map(([, y]) => Math.abs(y)));
    // Wider than the Titanic's boat deck, inside her beam.
    const titanicBoat = area(walkMapFor("titanic") as WalkMap, "boat-deck");
    const titanicWidest = Math.max(
      ...titanicBoat.outline.map(([, y]) => Math.abs(y))
    );
    expect(widest).toBeGreaterThan(titanicWidest);
    expect(widest).toBeLessThanOrEqual(spec.beam / 2);
  });

  it("blocks every house and funnel casing the recipe draws", () => {
    expect(recipe.houses.length).toBeGreaterThan(10);
    for (const h of recipe.houses) {
      const mid: V2 = [(h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2];
      expect([h.id, covered("boat-deck", mid)]).toEqual([h.id, true]);
      // Its corners too (a little in from each).
      for (const x of [h.x0 + 0.1, h.x1 - 0.1])
        for (const y of [h.y0 + 0.1, h.y1 - 0.1])
          expect([h.id, x, y, covered("boat-deck", [x, y])]).toEqual([
            h.id,
            x,
            y,
            true,
          ]);
    }
    // The funnel casings (±5.2 × ±4.3): centre and corners, a little in.
    for (const f of spec.funnels)
      for (const [dx, dy] of [
        [0, 0],
        [-5.1, -4.2],
        [-5.1, 4.2],
        [5.1, -4.2],
        [5.1, 4.2],
      ])
        expect([f.x, dx, dy, covered("boat-deck", [f.x + dx, dy])]).toEqual([
          f.x,
          dx,
          dy,
          true,
        ]);
  });

  it("blocks each gantry davit's arms and its boat stack", () => {
    expect(BRITANNIC_GANTRY_SETS.length).toBe(5);
    expect(gantries.length).toBe(BRITANNIC_GANTRY_SETS.length);
    for (const g of gantries) {
      const s = Math.sign(g.footY);
      for (const x of g.arms) {
        expect(Math.abs(x - g.x)).toBeCloseTo(BRITANNIC_GANTRY_ARM_DX, 9);
        // The pedestal at the deck edge and along the arm's lean.
        for (const u of [0, 0.5, 1])
          expect([
            g.x,
            x,
            u,
            covered("boat-deck", [x, g.footY - s * u * BRITANNIC_GANTRY_REACH]),
          ]).toEqual([g.x, x, u, true]);
      }
      // The stack of boats in the bay between the arms.
      for (const b of recipe.boats.filter((b) => b.gantry !== undefined)) {
        if (b.x !== g.x || b.side !== g.side) continue;
        expect([b.index, covered("boat-deck", [b.x, b.y])]).toEqual([
          b.index,
          true,
        ]);
      }
    }
  });

  it("blocks the foot of each Welin davit", () => {
    expect(recipe.davits.length).toBeGreaterThan(0);
    for (const d of recipe.davits)
      expect([d.boat, covered("boat-deck", [d.x, d.footY])]).toEqual([
        d.boat,
        true,
      ]);
  });

  it("keeps a boat-deck bench exactly where the recipe draws one", () => {
    const drawn = recipe.benches
      .filter((b) => Math.abs(b.p[1]) < 9 && Math.abs(b.p[2] - 28) < 3)
      .map((b) => `${b.p[0]},${b.p[1]}`)
      .sort();
    expect(drawn.length).toBeGreaterThan(0);
    const kept = map.blockers
      .filter(
        (b) =>
          b.kind === "box" &&
          b.area === "boat-deck" &&
          Math.abs(b.max[0] - b.min[0] - 1.8) < 1e-9 &&
          Math.abs(b.max[1] - b.min[1] - 0.6) < 1e-9
      )
      .map((b) =>
        b.kind === "box"
          ? `${(b.min[0] + b.max[0]) / 2},${Math.round(((b.min[1] + b.max[1]) / 2) * 10) / 10}`
          : ""
      )
      .sort();
    expect(kept).toEqual(drawn);
  });

  it("stands the spawn in clear deck, not in a boat's bay", () => {
    const [x, y] = map.spawn.at;
    for (const b of recipe.boats)
      expect(
        Math.abs(x - b.x) < BRITANNIC_BOAT.length / 2 + 0.3 &&
          Math.abs(y - b.y) < BRITANNIC_BOAT.beam / 2 + 0.3
      ).toBe(false);
  });
});

describe("the Carpathia's walk", () => {
  const spec = getShip("carpathia");
  const map = walkMapFor("carpathia") as WalkMap;
  const recipe = carpathiaRecipe(spec);

  it("blocks every house, mast and funnel her recipe stands on a walked deck", () => {
    const areaOf = (x: number, z: number): string | null => {
      const floors: [string, string, number][] = [
        ["boat-deck", "Boat", 0],
        ["bridge-deck", "Bridge", 0],
        ["after-deck", "Upper", 0],
        ["forward-well", "Upper", 0],
      ];
      for (const [id, deck] of floors) {
        const a = area(map, id);
        const xs = a.outline.map((p) => p[0]);
        if (x < Math.min(...xs) || x > Math.max(...xs)) continue;
        if (Math.abs(z - floorZ(map, id, x, spec)) < 0.6 && deck) return id;
      }
      return null;
    };
    const hit = (id: string, x: number, y: number) =>
      insideBlocker(map, id, [x, y], 0);
    for (const h of recipe.houses) {
      const x = (h.x0 + h.x1) / 2;
      const id = areaOf(x, h.z0);
      if (!id) continue; // on a roof, not a floor she walks
      expect([h.id, hit(id, x, 0)]).toEqual([h.id, true]);
    }
    for (const m of recipe.masts) {
      const id = areaOf(m.x, m.baseZ);
      expect([m.id, id]).not.toEqual([m.id, null]);
      expect([m.id, hit(id as string, m.x, 0)]).toEqual([m.id, true]);
    }
    for (const f of recipe.funnels) expect(hit("boat-deck", f.x, 0)).toBe(true);
  });

  it("keeps her off the wheelhouse's footprint: the bridge house under it is blocked", () => {
    const wh = recipe.houses.find((h) => h.id === "wheelhouse")!;
    expect(wh).toBeDefined();
    // On the navigating bridge (the bridge house's roof), which she does
    // not walk; the boat deck under it is the bridge house's blocker.
    for (const x of [wh.x0, (wh.x0 + wh.x1) / 2, wh.x1])
      for (const y of [wh.y0, 0, wh.y1])
        expect([x, y, insideBlocker(map, "boat-deck", [x, y], 0)]).toEqual([
          x,
          y,
          true,
        ]);
  });

  it("walks a covered promenade down each side, joined to the boat deck", () => {
    for (const side of ["port", "starboard"]) {
      const s = map.stairs.find((x) => x.id === `promenade-ladder-${side}`);
      expect(s?.to.area).toBe(`promenade-${side}`);
      expect(s?.from.area).toBe("boat-deck");
    }
  });
});
