import { skyPhase } from "../sky";

const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m).getTime();

describe("skyPhase", () => {
  it.each([
    [6, 29, "night"],
    [6, 30, "dawn"],
    [7, 59, "dawn"],
    [8, 0, "day"],
    [16, 59, "day"],
    [17, 0, "dusk"],
    [19, 29, "dusk"],
    [19, 30, "evening"],
    [20, 59, "evening"],
    [21, 0, "night"],
    [0, 0, "night"],
  ])("%i:%i is %s", (h, m, phase) => {
    expect(skyPhase(at(h, m))).toBe(phase);
  });
});
