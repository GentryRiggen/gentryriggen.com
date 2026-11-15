import {
  LABEL_SECONDS,
  MAX_LABELS,
  addDeathLabel,
  advanceDeathLabels,
  clearDeathLabels,
  deathLabels,
  labelTier,
} from "../deathLabels";

const START = 8_000_000_000;
const active = () => deathLabels.filter((l) => l.active);

describe("deathLabels", () => {
  beforeEach(() => clearDeathLabels());

  it("merges a close, quick hit into the label and adds its number", () => {
    addDeathLabel(1000, 0.5, 0.5, START);
    advanceDeathLabels(0.1);
    addDeathLabel(500, 0.51, 0.5, START);
    expect(active()).toHaveLength(1);
    expect(active()[0].people).toBe(1500);
    expect(active()[0].age).toBe(0);
  });

  it("does not merge after 250 ms or beyond 0.15 rad", () => {
    addDeathLabel(1000, 0.5, 0.5, START);
    advanceDeathLabels(0.3);
    addDeathLabel(500, 0.5, 0.5, START);
    expect(active()).toHaveLength(2);
    clearDeathLabels();
    addDeathLabel(1000, 0.2, 0.5, START);
    addDeathLabel(500, 0.4, 0.5, START);
    expect(active()).toHaveLength(2);
  });

  it("retires labels after their life and ignores zero deaths", () => {
    addDeathLabel(0, 0.5, 0.5, START);
    expect(active()).toHaveLength(0);
    addDeathLabel(10, 0.5, 0.5, START);
    advanceDeathLabels(LABEL_SECONDS + 0.01);
    expect(active()).toHaveLength(0);
  });

  it("replaces the oldest label when all slots are in use", () => {
    for (let i = 0; i < MAX_LABELS; i++) {
      addDeathLabel(100 + i, i / 10, 0.5, START);
      advanceDeathLabels(0.1);
    }
    addDeathLabel(7, 0.95, 0.5, START);
    expect(active()).toHaveLength(MAX_LABELS);
    expect(active().some((l) => l.people === 100)).toBe(false);
    expect(active().some((l) => l.people === 7)).toBe(true);
  });

  it("picks the size tier by share of the start population", () => {
    expect(labelTier(START * 0.0001, START)).toBe("small");
    expect(labelTier(START * 0.001, START)).toBe("medium");
    expect(labelTier(START * 0.01, START)).toBe("big");
    expect(labelTier(START * 0.05, START)).toBe("huge");
    expect(labelTier(5, 0)).toBe("small");
  });
});
