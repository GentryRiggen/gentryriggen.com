import { MAX_EFFECTS, pushEffect, type ActiveEffect } from "../effectQueue";

const make = (n: number): Omit<ActiveEffect, "id"> => ({
  toolId: "asteroid",
  u: 0.5,
  v: 0.5,
  point: { x: 0, y: 0, z: 1 },
  startedAt: n,
});

describe("pushEffect", () => {
  it("appends with the given id", () => {
    const list = pushEffect([], make(0), 7);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(7);
  });

  it("drops the oldest effect beyond the cap", () => {
    let list: ActiveEffect[] = [];
    for (let i = 0; i < MAX_EFFECTS; i++) list = pushEffect(list, make(i), i);
    expect(list).toHaveLength(MAX_EFFECTS);
    list = pushEffect(list, make(99), 99);
    expect(list).toHaveLength(MAX_EFFECTS);
    expect(list.some((e) => e.id === 0)).toBe(false);
    expect(list[list.length - 1].id).toBe(99);
  });

  it("does not mutate the input list", () => {
    const list = pushEffect([], make(0), 1);
    pushEffect(list, make(1), 2);
    expect(list).toHaveLength(1);
  });
});
