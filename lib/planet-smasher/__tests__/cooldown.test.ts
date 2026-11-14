import { cooldownLeft, resetCooldowns, tryFire } from "../cooldown";

beforeEach(() => resetCooldowns());

describe("cooldown", () => {
  it("lets an asteroid through three times in a second of 100 ms taps", () => {
    let shots = 0;
    for (let t = 0; t <= 1000; t += 100) if (tryFire("asteroid", t)) shots++;
    // Fires at 0, 400 and 800; each blocks the next 350 ms.
    expect(shots).toBe(3);
  });

  it("gives each tool its own cooldown", () => {
    expect(tryFire("asteroid", 0)).toBe(true);
    expect(tryFire("asteroid", 100)).toBe(false);
    expect(tryFire("megaBomb", 100)).toBe(true);
    expect(tryFire("megaBomb", 200)).toBe(false);
    expect(tryFire("asteroid", 350)).toBe(true);
  });

  it("reports the share of cooldown left", () => {
    tryFire("asteroid", 0);
    expect(cooldownLeft("asteroid", 0)).toBe(1);
    expect(cooldownLeft("asteroid", 175)).toBeCloseTo(0.5, 5);
    expect(cooldownLeft("asteroid", 350)).toBe(0);
  });

  it("never blocks a tool with no cooldown", () => {
    expect(tryFire("moonRam", 0)).toBe(true);
    expect(tryFire("moonRam", 1)).toBe(true);
    expect(cooldownLeft("moonRam", 1)).toBe(0);
  });
});
