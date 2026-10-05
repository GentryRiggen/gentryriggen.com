import {
  DENSITY_COUNT,
  FIELD_KEEP,
  FIELD_RING,
  SECTOR_SIZE,
  START_CLEAR_RADIUS,
  obstaclesForSector,
  sectorKey,
  syncField,
  type FieldConfig,
} from "../field";
import { createSail } from "../step";
import type { Obstacle } from "../types";

const ALL: FieldConfig = {
  seed: 7,
  kinds: ["iceberg", "rock", "buoy", "ship"],
  density: "some",
};

/** Obstacles over a block of sectors starting at (fromX, fromZ). */
function seedBlock(
  config: FieldConfig,
  fromX: number,
  fromZ: number,
  width: number,
  height: number
): Obstacle[] {
  const out: Obstacle[] = [];
  for (let sx = fromX; sx < fromX + width; sx++) {
    for (let sz = fromZ; sz < fromZ + height; sz++) {
      out.push(...obstaclesForSector(config, sx, sz));
    }
  }
  return out;
}

describe("obstaclesForSector", () => {
  it("is deterministic, ids included", () => {
    const a = obstaclesForSector(ALL, 4, -6);
    const b = obstaclesForSector(ALL, 4, -6);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    a.forEach((o, i) => expect(o.id).toBe(`${sectorKey(4, -6)}:${i}`));
  });

  it("differs between seeds", () => {
    const a = seedBlock(ALL, 5, 5, 6, 6);
    const b = seedBlock({ ...ALL, seed: 8 }, 5, 5, 6, 6);
    expect(a).not.toEqual(b);
  });

  it("places obstacles inside their sector", () => {
    for (const o of seedBlock(ALL, -8, -8, 16, 16)) {
      const [sx, sz] = o.sector.split(":").map(Number);
      expect(o.x).toBeGreaterThanOrEqual(sx * SECTOR_SIZE);
      expect(o.x).toBeLessThan((sx + 1) * SECTOR_SIZE);
      expect(o.z).toBeGreaterThanOrEqual(sz * SECTOR_SIZE);
      expect(o.z).toBeLessThan((sz + 1) * SECTOR_SIZE);
    }
  });

  it("only seeds the enabled kinds", () => {
    const config: FieldConfig = { ...ALL, kinds: ["rock", "buoy"] };
    const found = seedBlock(config, 5, 5, 10, 10);
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found.map((o) => o.kind))).toEqual(
      new Set(["rock", "buoy"])
    );
  });

  it("seeds nothing with no kinds enabled", () => {
    const config: FieldConfig = { ...ALL, kinds: [], density: "many" };
    expect(seedBlock(config, -5, -5, 10, 10)).toEqual([]);
  });

  it("seeds more with more density", () => {
    const count = (density: FieldConfig["density"]) =>
      seedBlock({ ...ALL, density }, 5, 5, 20, 10).length;
    const [few, some, many] = [count("few"), count("some"), count("many")];
    expect(few).toBeLessThan(some);
    expect(some).toBeLessThan(many);
    // Averages land near the nominal per-sector counts.
    expect(few / 200).toBeCloseTo(DENSITY_COUNT.few, 0);
    expect(many / 200).toBeCloseTo(DENSITY_COUNT.many, 0);
  });

  it("keeps the start clear", () => {
    const config: FieldConfig = { ...ALL, density: "many" };
    // Sectors around the origin would hold obstacles if nothing were skipped.
    const near = seedBlock(config, -3, -3, 6, 6);
    expect(near.length).toBeGreaterThan(0);
    for (const o of near) {
      expect(Math.hypot(o.x, o.z)).toBeGreaterThanOrEqual(START_CLEAR_RADIUS);
    }
    // The filter removes roughly 44% of sector (0, 0); an equivalent sector
    // far away loses none.
    let origin = 0;
    let faraway = 0;
    for (let seed = 0; seed < 60; seed++) {
      origin += obstaclesForSector({ ...config, seed }, 0, 0).length;
      faraway += obstaclesForSector({ ...config, seed }, 10, 10).length;
    }
    expect(origin).toBeLessThan(faraway * 0.75);
  });

  it("gives other ships a heading and 1 to 3 cells per second", () => {
    const config: FieldConfig = { ...ALL, kinds: ["ship"], density: "many" };
    const ships = seedBlock(config, 5, 5, 8, 8);
    expect(ships.length).toBeGreaterThan(20);
    for (const o of ships) {
      expect(o.heading).toBeGreaterThanOrEqual(0);
      expect(o.heading).toBeLessThan(Math.PI * 2);
      expect(o.speed).toBeGreaterThanOrEqual(1);
      expect(o.speed).toBeLessThanOrEqual(3);
    }
  });

  it("leaves heading and speed off everything else", () => {
    const config: FieldConfig = {
      ...ALL,
      kinds: ["iceberg", "rock", "buoy"],
      density: "many",
    };
    for (const o of seedBlock(config, 5, 5, 8, 8)) {
      expect(o.heading).toBeUndefined();
      expect(o.speed).toBeUndefined();
    }
  });

  it("sizes each kind within its radius range", () => {
    const ranges: Record<string, [number, number]> = {
      iceberg: [3, 5],
      rock: [1.5, 3],
      buoy: [0.8, 0.8],
      ship: [4, 4],
    };
    for (const o of seedBlock({ ...ALL, density: "many" }, 5, 5, 10, 10)) {
      const [lo, hi] = ranges[o.kind];
      expect(o.radius).toBeGreaterThanOrEqual(lo);
      expect(o.radius).toBeLessThanOrEqual(hi);
    }
  });
});

describe("syncField", () => {
  const ringSize = (FIELD_RING * 2 + 1) ** 2;

  it("seeds every sector in the ring around the ship", () => {
    const s = syncField(createSail(), ALL);
    expect(s.sectors).toHaveLength(ringSize);
    expect(s.sectors).toContain(sectorKey(-FIELD_RING, FIELD_RING));
    expect(s.sectors).not.toContain(sectorKey(FIELD_RING + 1, 0));
    expect(s.obstacles.length).toBeGreaterThan(0);
    expect(s.obstacles).toEqual(
      s.sectors.flatMap((key) => {
        const [sx, sz] = key.split(":").map(Number);
        return obstaclesForSector(ALL, sx, sz);
      })
    );
  });

  it("returns the same object when nothing changes", () => {
    const s = syncField(createSail(), ALL);
    expect(syncField(s, ALL)).toBe(s);
  });

  it("seeds new sectors as the ship moves and keeps nearby old ones", () => {
    const start = syncField(createSail(), ALL);
    const moved = syncField({ ...start, x: SECTOR_SIZE * 1.5 }, ALL);
    // Ship now in sector (1, 0): ring is -2..4, and column -3 is still within
    // FIELD_KEEP so it stays.
    expect(moved.sectors).toContain(sectorKey(4, 0));
    expect(moved.sectors).toContain(sectorKey(-3, 0));
    expect(new Set(moved.sectors).size).toBe(moved.sectors.length);
    expect(moved.sectors).toHaveLength(ringSize + (FIELD_RING * 2 + 1));
  });

  it("drops sectors beyond FIELD_KEEP and does not bring them back", () => {
    const start = syncField(createSail(), ALL);
    const far = syncField(
      { ...start, x: SECTOR_SIZE * (FIELD_KEEP + FIELD_RING + 2) },
      ALL
    );
    expect(far.sectors).toHaveLength(ringSize);
    expect(far.sectors).not.toContain(sectorKey(0, 0));
    for (const o of far.obstacles) {
      expect(far.sectors).toContain(o.sector);
    }
    expect(syncField(far, ALL)).toBe(far);
  });

  it("keeps surviving obstacles as they are, not re-seeded", () => {
    const start = syncField(createSail(), ALL);
    const edited = start.obstacles.map((o, i) =>
      i === 0 ? { ...o, x: o.x + 0.5 } : o
    );
    const moved = syncField(
      { ...start, obstacles: edited, z: SECTOR_SIZE * 1.5 },
      ALL
    );
    expect(moved.sectors).toContain(sectorKey(0, 4));
    expect(moved.obstacles[0].x).toBe(edited[0].x);
  });

  it("keeps sectors in step with a ship that sails the other way", () => {
    const start = syncField(createSail(), ALL);
    const west = syncField({ ...start, x: -SECTOR_SIZE * 12 }, ALL);
    expect(west.sectors).toContain(sectorKey(-12, 0));
    expect(west.sectors).not.toContain(sectorKey(0, 0));
    expect(west.sectors).toHaveLength(ringSize);
  });
});
