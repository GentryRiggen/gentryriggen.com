import { seeded } from "../rng";

describe("seeded", () => {
  it("repeats for the same seed and stays in [0,1)", () => {
    const a = seeded(42);
    const b = seeded(42);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("differs between seeds", () => {
    expect(seeded(1)()).not.toBe(seeded(2)());
  });
});
