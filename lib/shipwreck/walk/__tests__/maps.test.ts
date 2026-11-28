import { britannicRecipe } from "@/components/shipwreck/model/britannicRecipe";
import { carpathiaRecipe } from "@/components/shipwreck/model/carpathiaRecipe";
import { concordiaRecipe } from "@/components/shipwreck/model/concordiaRecipe";
import { getShip } from "../../ships";
import { CONCORDIA_RECESS as CONCORDIA_RECESS_X } from "../../ships/concordiaLayout";
import {
  BRITANNIC_BOAT,
  BRITANNIC_GANTRY_ARM_DX,
  BRITANNIC_GANTRY_REACH,
  BRITANNIC_GANTRY_SETS,
} from "../../ships/britannic";
import type { ShipId } from "../../ships/types";
import type { SimFrame } from "../../sim/track";
// Her frame at t 0 (before anything happens the to-sea run is her real
// night): concordiaToSeaFixture's saved summary.
import toSea from "../../sim/__tests__/fixtures/concordiaToSea.json";
import { stepWalker, type StepContext, type WalkerState } from "../step";
import { placeWalker } from "../swim";
import {
  floorZ,
  insideBlocker,
  pointInPolygon,
  railYAt,
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

describe("the Costa Concordia's walk", () => {
  const spec = getShip("concordia");
  const map = walkMapFor("concordia") as WalkMap;
  const recipe = concordiaRecipe(spec);
  const edge = (x: number) => recipe.hull.topHalfBreadth(x);
  const Z = (deck: string) => recipe.deckZ(deck, 0);
  const block = (id: string) => {
    const b = recipe.blocks?.find((x) => x.id === id);
    if (!b) throw new Error(`no block ${id}`);
    return b;
  };
  const covered = (id: string, p: V2) => insideBlocker(map, id, p, 0);
  const AREAS = [
    "lido-aft",
    "pool-hall",
    "lido-fwd",
    "aft-terrace",
    "sports-deck",
    "boat-deck-p",
    "boat-deck-s",
  ];
  /** Whether segments ab and cd cross (touching ends excluded). */
  function cross(a: V2, b: V2, c: V2, d: V2): boolean {
    const o = (p: V2, q: V2, r: V2) =>
      (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(c, d, a);
    const d2 = o(c, d, b);
    const d3 = o(a, b, c);
    const d4 = o(a, b, d);
    return d1 * d2 < 0 && d3 * d4 < 0;
  }
  function distToOutline(p: V2, poly: readonly V2[]): number {
    let best = Infinity;
    for (let i = 0; i < poly.length; i += 1)
      best = Math.min(
        best,
        distToSegment(p, poly[i], poly[(i + 1) % poly.length])
      );
    return best;
  }
  /** The walked area whose floor is at z and whose plan holds (x, y), if any. */
  function areaAt(x: number, y: number, z: number, tol = 0.05) {
    return map.areas.find(
      (a) =>
        Math.abs(floorZ(map, a.id, x, spec) - z) < tol &&
        pointInPolygon([x, y], a.outline)
    );
  }

  it("is hers, with her open decks", () => {
    expect(map.ship).toBe("concordia");
    const ids = map.areas.map((a) => a.id);
    expect([...ids].sort()).toEqual([...AREAS].sort());
  });

  it("lays every area on her decks, inside her, counter-clockwise and simple", () => {
    const decks = spec.decks.map((d) => d.name);
    for (const a of map.areas) {
      expect(decks).toContain(a.deck);
      expect(signedArea(a.outline)).toBeGreaterThan(0);
      const n = a.outline.length;
      for (const [x, y] of a.outline) {
        expect(Math.abs(y)).toBeLessThanOrEqual(edge(x) + 1e-6);
        expect(x).toBeGreaterThan(spec.stations[0].x);
        expect(x).toBeLessThan(spec.stations[spec.stations.length - 1].x);
      }
      for (let i = 0; i < n; i += 1)
        for (let j = i + 2; j < n; j += 1) {
          if (i === 0 && j === n - 1) continue;
          const hit = cross(
            a.outline[i],
            a.outline[(i + 1) % n],
            a.outline[j],
            a.outline[(j + 1) % n]
          );
          expect([a.id, i, j, hit]).toEqual([a.id, i, j, false]);
        }
      for (const i of a.wallEdges ?? []) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(n);
      }
    }
  });

  it("stands every area on the deck the model draws it at", () => {
    const want: Record<string, number> = {
      "lido-aft": Z("13"),
      "pool-hall": Z("12"),
      "lido-fwd": Z("13"),
      "aft-terrace": Z("12"),
      "sports-deck": Z("14") + block("sports-deck").h,
      "boat-deck-p": Z("4"),
      "boat-deck-s": Z("4"),
    };
    for (const a of map.areas) {
      const xs = a.outline.map((p) => p[0]);
      for (const x of [Math.min(...xs), 0, Math.max(...xs)])
        expect([a.id, floorZ(map, a.id, x, spec)]).toEqual([
          a.id,
          expect.closeTo(want[a.id], 9),
        ]);
    }
    // Her decks are flat (deck 3's sheer): the spec table's heights.
    expect(floorZ(map, "lido-aft", 0, spec)).toBeCloseTo(47.78, 9);
    expect(floorZ(map, "pool-hall", 0, spec)).toBeCloseTo(44.98, 9);
    expect(floorZ(map, "boat-deck-s", 0, spec)).toBeCloseTo(22.58, 9);
  });

  it("puts every blocker's middle inside its area", () => {
    for (const b of map.blockers) {
      const c: V2 =
        b.kind === "circle"
          ? b.at
          : [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
      expect([b, pointInPolygon(c, area(map, b.area).outline)]).toEqual([
        b,
        true,
      ]);
    }
  });

  it("blocks the aft glass houses, the funnel's casing and the funnel", () => {
    for (const id of [
      "aft-pool-glass-0",
      "aft-pool-glass-1",
      "funnel-casing",
    ]) {
      const b = block(id);
      const hw = b.halfWidth as number;
      for (const x of [b.x0 + 0.1, (b.x0 + b.x1) / 2, b.x1 - 0.1])
        for (const y of [-hw + 0.1, 0, hw - 0.1])
          expect([id, x, y, covered("lido-aft", [x, y])]).toEqual([
            id,
            x,
            y,
            true,
          ]);
    }
    const f = recipe.funnels[0];
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * Math.PI * 2;
      const p: V2 = [f.x + f.semiA * Math.cos(a), f.semiB * Math.sin(a)];
      expect([k, covered("lido-aft", p)]).toEqual([k, true]);
    }
  });

  it("blocks the slide's tower and its coil where it is low enough to walk into", () => {
    const tower = (recipe.boxes ?? []).find(
      (b) =>
        Math.abs(b.size[0] - 2.2) < 1e-9 && Math.abs(b.size[2] - 8.4) < 1e-9
    )!;
    expect(tower).toBeDefined();
    for (const dx of [-1, 0, 1])
      for (const dy of [-1, 0, 1])
        expect(
          covered("lido-fwd", [
            tower.c[0] + dx * (tower.size[0] / 2 - 0.05),
            tower.c[1] + dy * (tower.size[1] / 2 - 0.05),
          ])
        ).toBe(true);
    const slide = recipe.slides?.[0];
    expect(slide).toBeDefined();
    for (const p of slide!.points) {
      // Over the walker's head (eyes 1.6 m, the tube 0.55 m round): clear.
      if (p[2] - Z("13") - slide!.r > 1.9) continue;
      expect([p, covered("lido-fwd", [p[0], p[1]])]).toEqual([p, true]);
    }
  });

  it("blocks both open pools' basins", () => {
    const pools = (recipe.boxes ?? []).filter(
      (b) => Math.abs(b.size[2] - 0.12) < 1e-9 && b.c[2] > Z("13")
    );
    expect(pools.length).toBe(2);
    for (const p of pools) {
      const a = areaAt(p.c[0], p.c[1], Z("13"));
      expect(a).toBeDefined();
      for (const dx of [-1, 0, 1])
        for (const dy of [-1, 0, 1])
          expect(
            covered(a!.id, [
              p.c[0] + dx * (p.size[0] / 2 - 0.1),
              p.c[1] + dy * (p.size[1] / 2 - 0.1),
            ])
          ).toBe(true);
    }
  });

  it("blocks the radar mast's pole and legs, and every radome low over a walked deck", () => {
    const mast = recipe.masts[0];
    expect(covered("sports-deck", [mast.x, 0])).toBe(true);
    const legs = (recipe.boxes ?? []).filter(
      (b) => Math.abs(b.size[2] - 11) < 1e-9 && Math.abs(b.c[0] - mast.x) < 1
    );
    expect(legs.length).toBe(2);
    for (const l of legs)
      expect(covered("sports-deck", [l.c[0], l.c[1]])).toBe(true);
    let low = 0;
    for (const r of recipe.radomes ?? []) {
      // The walked area under it whose floor its foot is on (within 2 m).
      const a = map.areas.find((x) => {
        const zf = floorZ(map, x.id, r.p[0], spec);
        const foot = r.p[2] - r.r;
        return (
          pointInPolygon([r.p[0], r.p[1]], x.outline) &&
          foot > zf - 0.5 &&
          foot < zf + 2
        );
      });
      if (!a) continue;
      low += 1;
      for (const [dx, dy] of [
        [0, 0],
        [r.r - 0.1, 0],
        [-(r.r - 0.1), 0],
        [0, r.r - 0.1],
        [0, -(r.r - 0.1)],
      ])
        expect([r.p, covered(a.id, [r.p[0] + dx, r.p[1] + dy])]).toEqual([
          r.p,
          true,
        ]);
    }
    // Two aft on the glass houses' roofs, one on the forward lido, two on
    // the sports deck: every one of them is over a walked deck in plan.
    expect(low).toBe(5);
  });

  it("walls the forward lido's front, where the spa rises from it", () => {
    const fwd = area(map, "lido-fwd");
    const front = Math.max(...fwd.outline.map(([x]) => x));
    expect(front).toBeCloseTo(block("spa").x0, 9);
    const n = fwd.outline.length;
    for (let i = 0; i < n; i += 1) {
      const a = fwd.outline[i];
      const b = fwd.outline[(i + 1) % n];
      if (a[0] === front && b[0] === front) expect(fwd.wallEdges).toContain(i);
    }
  });

  it("blocks every boat (and its davits) and every liferaft rack on her boat deck", () => {
    expect(recipe.boats.length).toBe(26);
    for (const b of recipe.boats) {
      const id = b.side === "port" ? "boat-deck-p" : "boat-deck-s";
      for (const dx of [-1, 0, 1])
        for (const dy of [-1, 0, 1]) {
          const p: V2 = [
            b.x + dx * (b.length / 2 - 0.1),
            b.y + dy * (b.beam / 2 - 0.1),
          ];
          expect([b.label, p, covered(id, p)]).toEqual([b.label, p, true]);
        }
    }
    for (const d of recipe.davits) {
      const b = recipe.boats[d.boat];
      const id = b.side === "port" ? "boat-deck-p" : "boat-deck-s";
      expect([d.boat, covered(id, [d.x, d.footY])]).toEqual([d.boat, true]);
    }
    const cans = recipe.canisters ?? [];
    expect(cans.length).toBe(40);
    for (const c of cans) {
      const id = c.c[1] > 0 ? "boat-deck-p" : "boat-deck-s";
      for (const dx of [-c.len / 2 + 0.05, 0, c.len / 2 - 0.05])
        expect([c.c, covered(id, [c.c[0] + dx, c.c[1]])]).toEqual([c.c, true]);
    }
  });

  it("stands her rails where the recipe's edge runs draw them", () => {
    const runs = recipe.rails.filter(
      (r) => r.points[0][0] !== r.points[r.points.length - 1][0]
    );
    const seen = new Set<string>();
    for (const run of runs) {
      const z = run.points[0][2];
      // Deck 5's foredeck rails: not a deck she walks.
      if (Math.abs(z - Z("5")) < 1e-6) continue;
      for (const [x, y] of run.points) {
        const side = y > 0 ? "port" : "starboard";
        const a = map.areas.find(
          (q) =>
            Math.abs(floorZ(map, q.id, x, spec) - z) < 1e-6 &&
            Math.min(...q.outline.map((p) => p[0])) <= x + 1e-9 &&
            Math.max(...q.outline.map((p) => p[0])) >= x - 1e-9 &&
            Math.sign(railYAt(q.outline, x, side)) === Math.sign(y)
        );
        expect([x, y, z, a?.id ?? null]).not.toEqual([x, y, z, null]);
        seen.add(a!.id);
        expect([a!.id, x, railYAt(a!.outline, x, side)]).toEqual([
          a!.id,
          x,
          expect.closeTo(y, 1),
        ]);
        expect(Math.abs(railYAt(a!.outline, x, side) - y)).toBeLessThan(0.03);
      }
    }
    expect([...seen].sort()).toEqual(
      [
        "aft-terrace",
        "boat-deck-p",
        "boat-deck-s",
        "lido-aft",
        "lido-fwd",
        "sports-deck",
      ].sort()
    );
    // Her boat deck and the terrace: 10 cm in from her edge, over the sea.
    for (const [id, x] of [
      ["boat-deck-s", -60],
      ["boat-deck-p", 90],
      ["aft-terrace", -105],
    ] as const) {
      const side = id === "boat-deck-p" ? "port" : "starboard";
      expect(Math.abs(railYAt(area(map, id).outline, x, side))).toBeCloseTo(
        edge(x) - 0.1,
        1
      );
    }
  });

  it("puts each stair's ends inside their areas with 0.3 m clear, between different heights", () => {
    const pairs = map.stairs.map((s) =>
      [s.from.area, s.to.area].sort().join(" ")
    );
    for (const want of [
      "lido-aft pool-hall",
      "lido-fwd pool-hall",
      "aft-terrace lido-aft",
      "lido-fwd sports-deck",
      "boat-deck-p lido-aft",
      "boat-deck-s lido-aft",
      "boat-deck-p lido-fwd",
      "boat-deck-s lido-fwd",
    ])
      expect(pairs).toContain(want);
    for (const s of map.stairs) {
      for (const end of [s.from, s.to]) {
        const a = area(map, end.area);
        expect([s.id, end.area, pointInPolygon(end.at, a.outline)]).toEqual([
          s.id,
          end.area,
          true,
        ]);
        expect([
          s.id,
          end.area,
          insideBlocker(map, end.area, end.at, WALK_RADIUS_M),
        ]).toEqual([s.id, end.area, false]);
        expect(distToOutline(end.at, a.outline)).toBeGreaterThanOrEqual(
          WALK_RADIUS_M
        );
      }
      const dz =
        floorZ(map, s.to.area, s.to.at[0], spec) -
        floorZ(map, s.from.area, s.from.at[0], spec);
      expect([s.id, Math.abs(dz) > 1]).toEqual([s.id, true]);
    }
  });

  it("keeps the boat deck's stair doors off the promenade's middle", () => {
    let doors = 0;
    for (const s of map.stairs)
      for (const end of [s.from, s.to]) {
        if (!end.area.startsWith("boat-deck")) continue;
        doors += 1;
        const x = end.at[0];
        // Beside the recess wall, so walking the promenade's middle line
        // never takes the stair.
        const wall = edge(x) - (block("boat-recess").inset ?? 0);
        const mid = (wall + promenadeOuter(x)) / 2;
        expect([
          s.id,
          Math.abs(Math.abs(end.at[1]) - mid) > s.widthM / 2,
        ]).toEqual([s.id, true]);
        expect(Math.abs(end.at[1])).toBeLessThan(mid);
      }
    expect(doors).toBe(4);
  });

  /** The boats' inboard side (|y|) at x on her boat deck, or her rail. */
  function promenadeOuter(x: number): number {
    let out = edge(x) - 0.1;
    for (const b of recipe.boats)
      if (Math.abs(x - b.x) <= b.length / 2)
        out = Math.min(out, Math.abs(b.y) - b.beam / 2);
    return out;
  }

  it("runs a promenade at least 2.2 m wide between the recess wall and the boats", () => {
    const recess = block("boat-recess");
    for (const id of ["boat-deck-p", "boat-deck-s"]) {
      const a = area(map, id);
      const sign = id === "boat-deck-p" ? 1 : -1;
      for (let x = recess.x0; x <= recess.x1 + 1e-9; x += 0.5) {
        // The outline's inner side is the recess wall the model draws.
        const ys = [] as number[];
        const n = a.outline.length;
        for (let i = 0; i < n; i += 1) {
          const p = a.outline[i];
          const q = a.outline[(i + 1) % n];
          if (p[0] === q[0]) continue;
          if (x < Math.min(p[0], q[0]) || x > Math.max(p[0], q[0])) continue;
          ys.push(p[1] + ((x - p[0]) / (q[0] - p[0])) * (q[1] - p[1]));
        }
        const wall = Math.min(...ys.map((y) => sign * y));
        expect([id, x, wall]).toEqual([
          id,
          x,
          expect.closeTo(edge(x) - (recess.inset ?? 0), 1),
        ]);
        expect([id, x, promenadeOuter(x) - wall >= 2.2]).toEqual([id, x, true]);
      }
    }
  });

  it("reaches every area from the spawn", () => {
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
    expect([...seen].sort()).toEqual([...AREAS].sort());
  });

  describe("walking her (level, on the stick)", () => {
    const pose = (toSea.night.frames[0] as unknown as SimFrame).bodies[0];
    const ctx: StepContext = {
      map,
      spec,
      pose,
      breakX: null,
      seaZ: () => -1000,
    };
    const inside = (w: WalkerState) =>
      pointInPolygon([w.x, w.y], area(map, w.area).outline);

    it("walks the promenade's middle end to end on each side without taking a stair", () => {
      for (const s of [1, -1] as const) {
        const id = s > 0 ? "boat-deck-p" : "boat-deck-s";
        const x0 = CONCORDIA_RECESS_X[0] + 1;
        const y = (x: number) =>
          s * (edge(x) - (block("boat-recess").inset ?? 0) + 1.5);
        let w: WalkerState = {
          part: "whole",
          area: id,
          x: x0,
          y: y(x0),
          yaw: 0,
        };
        for (
          let i = 0;
          i < 60 * 60 && w.x < CONCORDIA_RECESS_X[1] - 1;
          i += 1
        ) {
          // Steer back onto the line each step (the stick, as a child would).
          const err = y(w.x) - w.y;
          const r = stepWalker(
            { ...w, yaw: Math.atan2(err, 4) },
            { forward: 1, strafe: 0, lookDx: 0, lookDy: 0 },
            ctx,
            1 / 60
          );
          expect([id, i, r.via ?? null]).toEqual([id, i, null]);
          w = r.state;
          expect(w.area).toBe(id);
          expect(inside(w)).toBe(true);
        }
        expect(w.x).toBeGreaterThan(CONCORDIA_RECESS_X[1] - 1.5);
      }
    });

    it("never leaves every outline or gets held in a corner (a seeded random walk on every area)", () => {
      let seed = 7;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      for (const a of AREAS) {
        const start = map.stairs
          .flatMap((st) => [st.from, st.to])
          .find((e) => e.area === a)!;
        let w: WalkerState = {
          part: "whole",
          area: a,
          x: start.at[0],
          y: start.at[1],
          yaw: 0,
        };
        let input = { forward: 1, strafe: 0, lookDx: 0, lookDy: 0 };
        let stuck = 0;
        for (let i = 0; i < 60 * 20; i += 1) {
          if (i % 30 === 0)
            input = {
              forward: rnd() * 2 - 1,
              strafe: rnd() * 2 - 1,
              lookDx: (rnd() * 2 - 1) * 200,
              lookDy: 0,
            };
          const r = stepWalker(w, input, ctx, 1 / 60);
          input = { ...input, lookDx: 0 };
          const moved = Math.hypot(r.state.x - w.x, r.state.y - w.y);
          w = r.state;
          expect([a, i, inside(w)]).toEqual([a, i, true]);
          expect(r.inWater).toBeNull();
          stuck = moved < 1e-4 ? stuck + 1 : 0;
          expect([a, i, stuck < 60 * 3]).toEqual([a, i, true]);
        }
      }
    });
  });

  it("spawns in the pool hall, starboard of the pool, facing forward, dry at t 0", () => {
    expect(map.spawn.area).toBe("pool-hall");
    expect(map.spawn.yaw).toBe(0);
    const hall = area(map, "pool-hall");
    expect(pointInPolygon(map.spawn.at, hall.outline)).toBe(true);
    expect(insideBlocker(map, "pool-hall", map.spawn.at, 1)).toBe(false);
    expect(distToOutline(map.spawn.at, hall.outline)).toBeGreaterThanOrEqual(1);
    // The basin is a blocker; the spawn is on its starboard side.
    const basin = map.blockers.find(
      (b) => b.area === "pool-hall" && b.kind === "box"
    );
    expect(basin?.kind).toBe("box");
    if (basin?.kind === "box") {
      expect(map.spawn.at[1]).toBeLessThan(basin.min[1]);
      expect(map.spawn.at[0]).toBeGreaterThan(basin.min[0]);
      expect(map.spawn.at[0]).toBeLessThan(basin.max[0]);
    }
    const f0 = toSea.night.frames[0] as unknown as SimFrame;
    expect(f0.t).toBe(0);
    const w = placeWalker(map, spec, f0, null);
    expect(w).not.toBeNull();
    expect(w?.area).toBe("pool-hall");
  });
});
