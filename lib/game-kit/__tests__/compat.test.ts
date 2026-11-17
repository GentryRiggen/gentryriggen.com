import { at, findLast, findLastIndex, hasOwn, sorted } from "../compat";

describe("compat helpers", () => {
  it("hasOwn ignores inherited keys", () => {
    expect(hasOwn({ a: 1 }, "a")).toBe(true);
    expect(hasOwn({ a: 1 }, "toString")).toBe(false);
    expect(hasOwn(Object.create({ a: 1 }), "a")).toBe(false);
  });

  it("at counts from the end for negative indexes", () => {
    expect(at([1, 2, 3], 0)).toBe(1);
    expect(at([1, 2, 3], -1)).toBe(3);
    expect(at([1, 2, 3], -4)).toBeUndefined();
    expect(at([1, 2, 3], 3)).toBeUndefined();
    expect(at("abc", -1)).toBe("c");
  });

  it("finds the last match", () => {
    expect(findLast([1, 2, 3, 4], (n) => n % 2 === 1)).toBe(3);
    expect(findLastIndex([1, 2, 3, 4], (n) => n % 2 === 1)).toBe(2);
    expect(findLastIndex([1], (n) => n > 5)).toBe(-1);
  });

  it("sorted leaves the original alone", () => {
    const input = [3, 1, 2];
    expect(sorted(input)).toEqual([1, 2, 3]);
    expect(input).toEqual([3, 1, 2]);
  });
});
