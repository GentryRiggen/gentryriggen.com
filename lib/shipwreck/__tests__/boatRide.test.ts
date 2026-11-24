import {
  BOARD_REACH_M,
  boardableBoats,
  nearestBoardable,
  nextBoardable,
  rideLowered,
} from "../boatRide";

const events = [
  { t: 50, kind: "rocket" },
  { t: 300, kind: "boat-lowered", index: 4 },
  { t: 100, kind: "boat-lowered", index: 2 },
  { t: 200, kind: "boat-lowered", index: 7 },
  { t: 150, kind: "boat-lowered" },
];

describe("boat ride rules", () => {
  it("boardableBoats lists boats still to be lowered, soonest first", () => {
    expect(boardableBoats(events, 0)).toEqual([2, 7, 4]);
    expect(boardableBoats(events, 150)).toEqual([7, 4]);
    expect(boardableBoats(events, 200)).toEqual([4]);
  });

  it("nextBoardable is the soonest, or null when every boat has gone", () => {
    expect(nextBoardable(events, 120)).toBe(7);
    expect(nextBoardable(events, 300)).toBeNull();
    expect(nextBoardable([], 0)).toBeNull();
  });

  it("nearestBoardable picks the closest boat within reach", () => {
    const boats = [
      { index: 2, x: 10, y: 12 },
      { index: 7, x: 13, y: 12 },
      { index: 4, x: 10, y: -12 },
    ];
    expect(BOARD_REACH_M).toBe(3);
    expect(nearestBoardable(12, 10.5, boats)).toBe(7);
    expect(nearestBoardable(10, -9, boats)).toBe(4);
    expect(nearestBoardable(0, 0, boats)).toBeNull();
    expect(nearestBoardable(0, 1, boats, 100)).toBe(2);
  });

  it("nearestBoardable reaches along the boat's whole length (davits stop the walker at its ends)", () => {
    // The Titanic's boat 10: 9 m long at x −38.2; the walker stopped by
    // its davit at x −33.5 on the rail.
    const boat = [{ index: 9, x: -38.2, y: -12.7, halfLength: 4.7 }];
    expect(nearestBoardable(-33.5, -13.7, boat)).toBe(9);
    expect(nearestBoardable(-29, -13.7, boat)).toBeNull();
  });

  it("rideLowered moves the ridden boat's lowering to when they boarded", () => {
    const lowered = new Map([
      [2, 100],
      [7, 200],
    ]);
    rideLowered(lowered, { index: 7, at: 40 });
    expect(lowered.get(7)).toBe(40);
    expect(lowered.get(2)).toBe(100);
    rideLowered(lowered, null);
    expect(lowered.get(7)).toBe(40);
  });
});
