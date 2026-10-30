import {
  initialQuality,
  MAX_QUALITY_LEVEL,
  qualitySettings,
  restartWarmup,
  STEP_DOWN_COOLDOWN_MS,
  STEP_UP_COOLDOWN_MS,
  stepQuality,
  WARMUP_MS,
  type QualityState,
} from "../quality";

/** A started state whose warm-up is over. */
function ready(): QualityState {
  return { ...initialQuality(0), warmupUntil: 0 };
}

describe("stepQuality", () => {
  it("steps down one level at a time after the cooldown", () => {
    const start = ready();
    expect(stepQuality(start, "decline", 100)).toBe(start);
    const one = stepQuality(start, "decline", STEP_DOWN_COOLDOWN_MS);
    expect(one.level).toBe(1);
    expect(stepQuality(one, "decline", STEP_DOWN_COOLDOWN_MS + 100)).toBe(one);
    expect(stepQuality(one, "decline", STEP_DOWN_COOLDOWN_MS * 2).level).toBe(
      2
    );
  });

  it("never goes below the last level or above full quality", () => {
    let state = ready();
    for (let i = 1; i <= 10; i += 1) {
      state = stepQuality(state, "decline", i * STEP_DOWN_COOLDOWN_MS);
    }
    expect(state.level).toBe(MAX_QUALITY_LEVEL);
    expect(stepQuality(ready(), "incline", 1e9).level).toBe(0);
  });

  it("steps back up only after the longer cooldown", () => {
    const down = stepQuality(ready(), "decline", 5000);
    expect(stepQuality(down, "incline", 5000 + STEP_UP_COOLDOWN_MS - 1)).toBe(
      down
    );
    expect(stepQuality(down, "incline", 5000 + STEP_UP_COOLDOWN_MS).level).toBe(
      0
    );
  });

  it("ignores reports while warming up, and again after a restart", () => {
    const fresh = initialQuality(1000);
    expect(stepQuality(fresh, "decline", 1000 + WARMUP_MS - 1)).toBe(fresh);
    const later = {
      ...restartWarmup(ready(), 50_000),
      changedAt: 0,
    };
    expect(stepQuality(later, "decline", 50_000 + WARMUP_MS - 1)).toBe(later);
    expect(
      stepQuality(later, "decline", 50_000 + WARMUP_MS).level
    ).toBeGreaterThan(0);
  });

  it("skips a step that changes nothing on a 1x screen", () => {
    expect(stepQuality(ready(), "decline", 1e6, 1).level).toBe(2);
    expect(stepQuality(ready(), "decline", 1e6, 2).level).toBe(1);
  });

  it("latches a level that failed right after a step up", () => {
    let t = 1e6;
    let state = stepQuality(ready(), "decline", t, 2);
    expect(state.level).toBe(1);
    // A device that is slow on 0 and fine on 1 must not cycle forever.
    for (let cycle = 0; cycle < 3; cycle += 1) {
      t += STEP_UP_COOLDOWN_MS;
      state = stepQuality(state, "incline", t, 2);
      t += STEP_DOWN_COOLDOWN_MS;
      // Only the climbed-into level 0 is slow; level 1 is fine.
      if (state.level === 0) state = stepQuality(state, "decline", t, 2);
    }
    expect(state.level).toBe(1);
    const stuck = stepQuality(state, "incline", t + 1e6, 2);
    expect(stuck).toBe(state);
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
      expect(cur.fogFar).toBeLessThanOrEqual(prev.fogFar);
    }
  });

  it("never cuts obstacles off before the fog is opaque", () => {
    for (let level = 0; level <= MAX_QUALITY_LEVEL; level += 1) {
      const s = qualitySettings(level as 0 | 1 | 2 | 3);
      expect(s.obstacleDistance).toBeGreaterThanOrEqual(s.fogFar);
    }
  });
});
