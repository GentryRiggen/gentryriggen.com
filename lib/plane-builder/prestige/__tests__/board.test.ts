import { squareAt, starShareAt } from "../board";
import { BONUS_KINDS, type BonusKind } from "../bonuses";

function tally(radius: number, cx = 0, cy = 0) {
  const counts = new Map<BonusKind | "empty", number>();
  let total = 0;
  for (let x = cx - radius; x <= cx + radius; x += 1) {
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      const key = squareAt(x, y) ?? "empty";
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
  }
  const share = (k: BonusKind | "empty") => (counts.get(k) ?? 0) / total;
  return { share, total };
}

describe("squareAt", () => {
  it("is deterministic", () => {
    for (const [x, y] of [
      [1, 0],
      [-7, 12],
      [999, -999],
    ]) {
      expect(squareAt(x, y)).toBe(squareAt(x, y));
    }
  });

  it("leaves the start empty", () => {
    expect(squareAt(0, 0)).toBeNull();
  });

  it("is empty about 35% of the time", () => {
    const { share } = tally(20);
    expect(share("empty")).toBeGreaterThan(0.3);
    expect(share("empty")).toBeLessThan(0.4);
  });

  it("holds every kind somewhere nearby", () => {
    const { share } = tally(40);
    for (const kind of BONUS_KINDS) expect(share(kind)).toBeGreaterThan(0.005);
  });

  it("makes common kinds outnumber stars near the start", () => {
    const { share } = tally(3);
    expect(share("coins") + share("fuel")).toBeGreaterThan(share("star"));
  });

  it("keeps stars rare (at most 8% of bonus squares) and more common far away", () => {
    expect(starShareAt(0)).toBeCloseTo(0.01);
    expect(starShareAt(10)).toBeGreaterThan(starShareAt(2));
    expect(starShareAt(1e6)).toBe(0.08);
    // Far away, about 8% of the 65% that aren't empty, over three big areas.
    const far =
      (tally(20, 500, 500).share("star") +
        tally(20, -700, 300).share("star") +
        tally(20, 1000, -900).share("star")) /
      3;
    expect(far).toBeLessThan(0.08 * 0.65 + 0.015);
    expect(far).toBeGreaterThan(0.08 * 0.65 - 0.015);
  });

  it("stays finite and fast at huge coordinates", () => {
    const start = Date.now();
    for (const [x, y] of [
      [1e6, -1e6],
      [-1e9, 1e9],
      [2 ** 40, -(2 ** 40)],
      [Number.MAX_SAFE_INTEGER, 0],
    ]) {
      const kind = squareAt(x, y);
      expect(kind === null || BONUS_KINDS.includes(kind)).toBe(true);
    }
    tally(10, 1e6, -1e6);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("copes with non-finite input", () => {
    expect(() => squareAt(NaN, Infinity)).not.toThrow();
  });
});
