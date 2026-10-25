import { analyzeShip } from "../../model/analysis";
import type { PlacedPart, Ship } from "../../model/types";
import { findTemplate } from "../../templates";
import { gridPart, testShip } from "../../testing";
import { ATTACH_BLOCK_RADIUS, type WalkGrid } from "../../walk/types";
import { walkGridOf } from "../../walk/walkGrid";
import { crowdSize, planCrowd, seatsOf } from "../plan";
import { mulberry32 } from "../rng";
import {
  type CrowdPlan,
  MAX_PEOPLE,
  PERSON_SPEED,
  type PersonPose,
} from "../types";

function titanic(): Ship {
  return findTemplate("titanic")!.build();
}

function planOf(ship: Ship): { plan: CrowdPlan; grid: WalkGrid } {
  const grid = walkGridOf(ship);
  return { plan: planCrowd(ship, grid, analyzeShip(ship).stats), grid };
}

/**
 * A small ship with cabins (people), deck chairs and benches on the open main
 * deck, and a raised deck block reached by stairs.
 */
function loungeShip(): Ship {
  const parts: PlacedPart[] = [
    gridPart("c1", "cabin-1st", 0, 0, 0),
    gridPart("c2", "cabin-2nd", 0, 1, 0),
    gridPart("c3", "cabin-3rd", 0, 2, 0),
    gridPart("c4", "cabin-3rd", 0, 3, 0),
    gridPart("ch1", "deckchair", 0, 8, 3, 270),
    gridPart("ch2", "deckchair", 0, 9, 3, 270),
    gridPart("ch3", "deckchair", 0, 10, 3, 270),
    gridPart("b1", "bench", 0, 12, 0, 90),
    gridPart("d1", "deck-1x1", 0, 18, 1),
    gridPart("d2", "deck-1x1", 0, 19, 1),
    gridPart("d3", "deck-1x1", 0, 19, 2),
    gridPart("s1", "stairs", 0, 17, 1, 0),
  ];
  return { ...testShip(parts), name: "Lounge" };
}

function samples(
  plan: CrowdPlan,
  from: number,
  to: number,
  step: number,
  each: (i: number, t: number, pose: PersonPose) => void
) {
  for (let i = 0; i < plan.people.length; i++) {
    for (let t = from; t <= to + 1e-9; t += step) each(i, t, plan.poseAt(i, t));
  }
}

describe("mulberry32", () => {
  it("repeats for a seed and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let k = 0; k < 100; k++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("crowdSize", () => {
  it("fills MAX_PEOPLE on the Titanic, with crew aboard", () => {
    const size = crowdSize(analyzeShip(titanic()).stats);
    expect(size.passengers + size.crew).toBe(MAX_PEOPLE);
    expect(size.crew).toBeGreaterThanOrEqual(1);
  });

  it("has nobody on a ship with no cabins", () => {
    expect(crowdSize(analyzeShip(testShip()).stats)).toEqual({
      passengers: 0,
      crew: 0,
    });
  });

  it("has one passenger and no crew for a single first-class cabin", () => {
    const ship = testShip([gridPart("c", "cabin-1st", 0, 5, 1)]);
    expect(crowdSize(analyzeShip(ship).stats)).toEqual({
      passengers: 1,
      crew: 0,
    });
  });

  it("plans nobody when nobody is aboard", () => {
    const { plan } = planOf(testShip());
    expect(plan.people).toHaveLength(0);
  });
});

describe("seatsOf", () => {
  it("finds deck chairs and benches, facing their rotation", () => {
    const ship = loungeShip();
    const seats = seatsOf(ship, walkGridOf(ship));
    expect(seats.map((s) => s.partId).sort()).toEqual([
      "b1",
      "ch1",
      "ch2",
      "ch3",
    ]);
    const chair = seats.find((s) => s.partId === "ch1")!;
    expect(chair).toMatchObject({ x: 8.5, z: 3.5, level: 0 });
    // Rotation 270 faces model -z (starboard); in model coordinates the
    // facing direction is (-cos yaw, -sin yaw), so (0, -1) here.
    expect(-Math.cos(chair.yaw)).toBeCloseTo(0);
    expect(-Math.sin(chair.yaw)).toBeCloseTo(-1);
    const bench = seats.find((s) => s.partId === "b1")!;
    expect(-Math.sin(bench.yaw)).toBeCloseTo(1);
  });
});

describe("planCrowd on the Titanic", () => {
  const ship = titanic();
  const { plan, grid } = planOf(ship);
  const seatCells = new Set(
    plan.seats.map((s) => `${Math.floor(s.x)},${Math.floor(s.z)},${s.level}`)
  );

  it("plans MAX_PEOPLE people with ids p0, p1 ...", () => {
    expect(plan.people).toHaveLength(MAX_PEOPLE);
    expect(plan.people.map((p) => p.id)).toEqual(
      Array.from({ length: MAX_PEOPLE }, (_, i) => `p${i}`)
    );
    expect(plan.people.filter((p) => p.kind === "crew").length).toBeGreaterThan(
      0
    );
    for (const p of plan.people)
      if (p.kind === "crew") expect(p.outfit).toBe(0);
  });

  it("keeps everyone on walkable deck (or in a seat), clear of blockers", () => {
    samples(plan, 0, 120, 0.5, (_, __, pose) => {
      const x = Math.floor(pose.x);
      const z = Math.floor(pose.z);
      const onSeat = seatCells.has(`${x},${z},${pose.level}`);
      expect(onSeat || grid.isWalkable(x, z, pose.level)).toBe(true);
      for (const b of grid.blockersAt(pose.level)) {
        expect(Math.hypot(pose.x - b.x, pose.z - b.z)).toBeGreaterThanOrEqual(
          ATTACH_BLOCK_RADIUS
        );
      }
    });
  });

  it("starts everyone in a different column", () => {
    const cells = new Set(
      plan.people.map((_, i) => {
        const p = plan.poseAt(i, 0);
        return `${Math.floor(p.x)},${Math.floor(p.z)},${p.level}`;
      })
    );
    expect(cells.size).toBe(plan.people.length);
  });

  it("gives the same poses for the same ship, whatever order they're asked in", () => {
    const again = planOf(titanic()).plan;
    // Ask the second plan in a different order (late times first).
    for (let i = again.people.length - 1; i >= 0; i--) again.poseAt(i, 90);
    samples(plan, 0, 90, 1.5, (i, t, pose) => {
      expect(again.poseAt(i, t)).toEqual(pose);
    });
  });

  it("gives different poses for a renamed ship", () => {
    const renamed = planOf({ ...titanic(), name: "RMS Gigantic" }).plan;
    let differs = false;
    samples(plan, 0, 30, 3, (i, t, pose) => {
      const other = renamed.poseAt(i, t);
      if (other.x !== pose.x || other.z !== pose.z) differs = true;
    });
    expect(differs).toBe(true);
  });

  it("never stacks two idle people on one cell centre", () => {
    for (let t = 0; t <= 120; t += 0.5) {
      const seen = new Set<string>();
      plan.people.forEach((_, i) => {
        const p = plan.poseAt(i, t);
        if (p.activity !== "idle") return;
        const key = `${p.x},${p.z},${p.level}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      });
    }
  });

  it("moves no faster than PERSON_SPEED", () => {
    samples(plan, 0, 60, 0.1, (i, t, pose) => {
      if (t === 0) return;
      const prev = plan.poseAt(i, t - 0.1);
      expect(Math.hypot(pose.x - prev.x, pose.z - prev.z)).toBeLessThanOrEqual(
        PERSON_SPEED * 0.1 + 1e-6
      );
      expect(pose.level).toBe(prev.level); // she has no stairs
    });
  });

  it("answers 24 people at 600 times quickly", () => {
    const fresh = planOf(titanic()).plan;
    const start = performance.now();
    for (let k = 0; k < 600; k++) {
      for (let i = 0; i < fresh.people.length; i++) fresh.poseAt(i, k);
    }
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("planCrowd with seats and stairs", () => {
  const ship = loungeShip();
  const { plan, grid } = planOf(ship);

  it("has someone sitting within two minutes", () => {
    let sat = false;
    samples(plan, 0, 120, 0.5, (_, __, pose) => {
      if (pose.activity === "sit") sat = true;
    });
    expect(sat).toBe(true);
  });

  it("stands only on walkable deck, stepping off it only into a seat", () => {
    // A seat cell is decor, so the grid never calls it walkable: people step
    // into it from a neighbour to sit, and back out to leave.
    const seatCells = new Set(
      plan.seats.map((s) => `${s.x},${s.z},${s.level}`)
    );
    samples(plan, 0, 300, 0.25, (_, __, pose) => {
      const x = Math.floor(pose.x);
      const z = Math.floor(pose.z);
      const onSeat = seatCells.has(`${x + 0.5},${z + 0.5},${pose.level}`);
      expect(onSeat || grid.isWalkable(x, z, pose.level)).toBe(true);
    });
  });

  it("sits people on a seat, facing it", () => {
    samples(plan, 0, 300, 0.5, (_, __, pose) => {
      if (pose.activity !== "sit") return;
      const seat = plan.seats.find(
        (s) => s.x === pose.x && s.z === pose.z && s.level === pose.level
      );
      expect(seat).toBeDefined();
      expect(pose.yaw).toBe(seat!.yaw);
    });
  });

  it("never sits two people in one seat at once", () => {
    for (let t = 0; t <= 300; t += 0.5) {
      const taken = new Set<string>();
      plan.people.forEach((_, i) => {
        const p = plan.poseAt(i, t);
        if (p.activity !== "sit") return;
        const key = `${p.x},${p.z},${p.level}`;
        expect(taken.has(key)).toBe(false);
        taken.add(key);
      });
    }
  });

  it("moves no faster than PERSON_SPEED and changes level only on stairs", () => {
    const linked = (
      a: { x: number; z: number; level: number },
      b: { x: number; z: number; level: number }
    ) =>
      grid.stairs.some(
        (s) =>
          s.from.x === a.x &&
          s.from.z === a.z &&
          s.from.level === a.level &&
          s.to.x === b.x &&
          s.to.z === b.z &&
          s.to.level === b.level
      );
    let climbed = false;
    samples(plan, 0, 300, 0.1, (i, t, pose) => {
      if (t === 0) return;
      const prev = plan.poseAt(i, t - 0.1);
      expect(Math.hypot(pose.x - prev.x, pose.z - prev.z)).toBeLessThanOrEqual(
        PERSON_SPEED * 0.1 + 1e-6
      );
      if (pose.level !== prev.level) {
        climbed = true;
        const cell = (p: PersonPose) => ({
          x: Math.floor(p.x),
          z: Math.floor(p.z),
          level: p.level,
        });
        expect(linked(cell(prev), cell(pose))).toBe(true);
      }
    });
    expect(climbed).toBe(true);
  });
});
