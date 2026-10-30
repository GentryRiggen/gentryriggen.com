import {
  initialQuality,
  MAX_QUALITY_LEVEL,
  qualitySettings,
  STEP_DOWN_COOLDOWN_MS,
  STEP_UP_COOLDOWN_MS,
  stepQuality,
} from "../quality";

describe("stepQuality", () => {
  it("steps down one level at a time after the cooldown", () => {
    const start = initialQuality(0);
    expect(stepQuality(start, "decline", 100)).toBe(start);
    const one = stepQuality(start, "decline", STEP_DOWN_COOLDOWN_MS);
    expect(one.level).toBe(1);
    expect(stepQuality(one, "decline", STEP_DOWN_COOLDOWN_MS + 100)).toBe(one);
    expect(stepQuality(one, "decline", STEP_DOWN_COOLDOWN_MS * 2).level).toBe(
      2
    );
  });

  it("never goes below the last level or above full quality", () => {
    let state = initialQuality(0);
    for (let i = 1; i <= 10; i += 1) {
      state = stepQuality(state, "decline", i * STEP_DOWN_COOLDOWN_MS);
    }
    expect(state.level).toBe(MAX_QUALITY_LEVEL);
    expect(stepQuality(initialQuality(0), "incline", 1e9).level).toBe(0);
  });

  it("steps back up only after the longer cooldown", () => {
    const down = stepQuality(initialQuality(0), "decline", 5000);
    expect(stepQuality(down, "incline", 5000 + STEP_UP_COOLDOWN_MS - 1)).toBe(
      down
    );
    expect(stepQuality(down, "incline", 5000 + STEP_UP_COOLDOWN_MS).level).toBe(
      0
    );
  });
});

describe("qualitySettings", () => {
  it("only ever lowers settings as the level rises", () => {
    for (let level = 1; level <= MAX_QUALITY_LEVEL; level += 1) {
      const prev = qualitySettings((level - 1) as 0 | 1 | 2);
      const cur = qualitySettings(level as 1 | 2 | 3);
      expect(cur.dpr[1]).toBeLessThanOrEqual(prev.dpr[1]);
      expect(cur.shadowMapSize).toBeLessThanOrEqual(prev.shadowMapSize);
      expect(cur.obstacleDistance).toBeLessThanOrEqual(prev.obstacleDistance);
    }
  });
});
