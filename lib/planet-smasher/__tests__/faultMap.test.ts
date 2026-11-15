import { buildFaultMap, crackTarget, easeCrack, faultSeed } from "../faultMap";

describe("buildFaultMap", () => {
  const w = 128;
  const h = 64;
  const map = buildFaultMap(faultSeed("earth"), w, h);

  it("fills every texel with opaque RGBA bytes", () => {
    expect(map).toHaveLength(w * h * 4);
    for (let i = 3; i < map.length; i += 4) expect(map[i]).toBe(255);
  });

  it("has borders and open ground", () => {
    let border = 0;
    let ground = 0;
    for (let i = 0; i < map.length; i += 4) {
      if (map[i] > 200) border++;
      if (map[i] === 0) ground++;
    }
    expect(border).toBeGreaterThan(w * h * 0.01);
    expect(ground).toBeGreaterThan(w * h * 0.3);
  });

  it("gives a border one reveal order along its length", () => {
    const orders = new Set<number>();
    for (let i = 0; i < map.length; i += 4) {
      if (map[i] > 200) orders.add(map[i + 1]);
    }
    // 20 plates share at most ~60 borders; far fewer values than texels.
    expect(orders.size).toBeGreaterThan(3);
    expect(orders.size).toBeLessThan(90);
  });

  it("is the same for the same seed and different for another", () => {
    expect(buildFaultMap(faultSeed("earth"), w, h)).toEqual(map);
    expect(buildFaultMap(faultSeed("mars"), w, h)).not.toEqual(map);
  });
});

describe("buildFaultMap cost", () => {
  it("builds a full 512x256 map quickly", () => {
    const t0 = performance.now();
    buildFaultMap(faultSeed("earth"));
    // Generous bound; the target is ~40 ms on a quiet machine.
    expect(performance.now() - t0).toBeLessThan(400);
  });
});

describe("crackTarget", () => {
  it("is closed for a healthy planet and fully open near death", () => {
    expect(crackTarget(100)).toBe(0);
    expect(crackTarget(85)).toBe(0);
    expect(crackTarget(8)).toBe(1);
    expect(crackTarget(0)).toBe(1);
  });

  it("opens steadily as health drops", () => {
    expect(crackTarget(60)).toBeGreaterThan(0);
    expect(crackTarget(30)).toBeGreaterThan(crackTarget(60));
    expect(crackTarget(10)).toBeGreaterThan(crackTarget(30));
  });
});

describe("easeCrack", () => {
  it("rises toward the target over about half a second", () => {
    let v = 0;
    for (let i = 0; i < 30; i++) v = easeCrack(v, 1, 1 / 60);
    expect(v).toBeGreaterThan(0.8);
    expect(v).toBeLessThan(1);
  });

  it("clears at once when the planet heals (a new planet)", () => {
    expect(easeCrack(0.9, 0, 1 / 60)).toBe(0);
  });

  it("snaps shut when a full-health planet starts mid-crack", () => {
    expect(easeCrack(0.7, crackTarget(100), 1 / 60)).toBe(0);
  });
});
