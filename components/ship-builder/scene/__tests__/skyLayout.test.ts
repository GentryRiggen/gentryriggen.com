import {
  CLOUD_COUNT,
  cloudPuffs,
  PUFFS_PER_CLOUD,
  SKY_RADIUS,
  starPositions,
} from "../skyLayout";

describe("starPositions", () => {
  it("scatters stars on the upper sky dome, the same every time", () => {
    const stars = starPositions(100);
    expect(stars).toHaveLength(300);
    for (let i = 0; i < 100; i++) {
      const [x, y, z] = [stars[i * 3], stars[i * 3 + 1], stars[i * 3 + 2]];
      expect(y).toBeGreaterThan(0);
      expect(Math.hypot(x, y, z)).toBeCloseTo(SKY_RADIUS, 3);
    }
    expect(Array.from(starPositions(100))).toEqual(Array.from(stars));
  });
});

describe("cloudPuffs", () => {
  const puffs = cloudPuffs();

  it("makes clusters of puffs that appear together", () => {
    expect(puffs.ranks).toHaveLength(CLOUD_COUNT * PUFFS_PER_CLOUD);
    for (let cloud = 0; cloud < CLOUD_COUNT; cloud++) {
      const first = puffs.ranks[cloud * PUFFS_PER_CLOUD];
      for (let puff = 1; puff < PUFFS_PER_CLOUD; puff++) {
        expect(puffs.ranks[cloud * PUFFS_PER_CLOUD + puff]).toBe(first);
      }
    }
  });

  it("keeps clouds above the water and clear of the ship", () => {
    for (let i = 0; i < puffs.sizes.length; i++) {
      expect(puffs.positions[i * 3 + 1]).toBeGreaterThan(15);
      const flat = Math.hypot(
        puffs.positions[i * 3],
        puffs.positions[i * 3 + 2]
      );
      expect(flat).toBeGreaterThan(40);
    }
  });
});
