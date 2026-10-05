import { storyClockSeconds } from "../story";

describe("storyClockSeconds", () => {
  const events = [
    { kind: "flooding", at: 5 },
    { kind: "sunk", at: 30 },
  ];

  it("follows sim time until she sinks", () => {
    expect(storyClockSeconds(12, events)).toBe(12);
    expect(storyClockSeconds(12, [])).toBe(12);
  });

  it("freezes at the sunk event afterwards", () => {
    expect(storyClockSeconds(30, events)).toBe(30);
    expect(storyClockSeconds(75, events)).toBe(30);
  });
});
