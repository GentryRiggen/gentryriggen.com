import { SEASONS } from "../season";
import {
  LIGHTHOUSE_ROWS,
  PADLOCK_ROWS,
  ROBOT_COLORS,
  ROBOT_ROWS,
  ROBOT_WIDTH,
  spriteRects,
} from "../start/sprites";

describe("sprites", () => {
  it("keeps every robot row the same width", () => {
    for (const row of ROBOT_ROWS) expect(row).toHaveLength(ROBOT_WIDTH);
  });

  it("keeps the lighthouse and padlock rectangular", () => {
    for (const rows of [LIGHTHOUSE_ROWS, PADLOCK_ROWS])
      expect(new Set(rows.map((row) => row.length)).size).toBe(1);
  });

  it("has a color for every key the robot and accessories use", () => {
    const palette = { ...ROBOT_COLORS, L: "#fff" };
    const keys = (rows: readonly string[]) =>
      new Set([...rows.join("")].filter((c) => c !== "."));
    for (const key of keys(ROBOT_ROWS)) expect(palette).toHaveProperty(key);
    for (const season of SEASONS)
      for (const a of season.accessories)
        for (const key of keys(a.rows)) expect(a.colors).toHaveProperty(key);
  });

  it("merges runs of one color into a single rectangle", () => {
    expect(spriteRects(["AAB.A"], { A: "a", B: "b" })).toEqual([
      { x: 0, y: 0, w: 2, h: 1, fill: "a" },
      { x: 2, y: 0, w: 1, h: 1, fill: "b" },
      { x: 4, y: 0, w: 1, h: 1, fill: "a" },
    ]);
  });
});
