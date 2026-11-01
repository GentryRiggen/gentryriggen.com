import { formatDuration, formatNumber } from "../format";

describe("formatNumber", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [7.46, "7.5"],
    [42.9, "42"],
    [999, "999"],
    [1000, "1.00K"],
    [1500, "1.50K"],
    [12_345, "12.3K"],
    [123_456, "123K"],
    [999_999, "1.00M"],
    [2.5e6, "2.50M"],
    [3e9, "3.00B"],
    [4e12, "4.00T"],
    [5e15, "5.00Qa"],
    [6e18, "6.00Qi"],
    [1.23e36, "1.23e36"],
    [-1500, "-1.50K"],
  ])("formats %p as %s", (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  it("handles non-finite values", () => {
    expect(formatNumber(Infinity)).toBe("∞");
    expect(formatNumber(NaN)).toBe("0");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [45.9, "45s"],
    [185, "3m 05s"],
    [3600, "1h 00m"],
    [8040, "2h 14m"],
    [97_200, "1d 3h"],
    [-5, "0s"],
  ])("formats %p as %s", (value, expected) => {
    expect(formatDuration(value)).toBe(expected);
  });
});
