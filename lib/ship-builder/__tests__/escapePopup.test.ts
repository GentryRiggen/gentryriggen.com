import type { BoatLaunch } from "../crowd/evacuation";
import { LOWER_S, ROW_S } from "../crowd/evacuation";
import { escapePopupFor } from "../walk/escapePopup";
import type { EscapePhase } from "../walk/escape";

const davit = { kind: "davit", at: 10, departs: 10 } as BoatLaunch;
const raft = { kind: "raft", at: 10, ready: 12, departs: 20 } as BoatLaunch;
const boat = (since: number, fromWater = false): EscapePhase => ({
  kind: "in-boat",
  boatId: "b",
  since,
  fromWater,
});

describe("escapePopupFor", () => {
  it("shows nothing aboard or while jumping", () => {
    expect(escapePopupFor({ kind: "aboard" }, null, 0)).toBeNull();
  });
  it("waits for a davit boat to be fully out", () => {
    expect(
      escapePopupFor(boat(9), davit, 10 + LOWER_S + ROW_S - 0.1)
    ).toBeNull();
    expect(escapePopupFor(boat(9), davit, 10 + LOWER_S + ROW_S)).toBe(
      "saved-deck"
    );
  });
  it("waits for a raft to depart", () => {
    expect(escapePopupFor(boat(13), raft, 19)).toBeNull();
    expect(escapePopupFor(boat(13), raft, 20)).toBe("saved-deck");
  });
  it("uses the jump time when the raft already departed", () => {
    expect(escapePopupFor(boat(30), raft, 30.5)).toBeNull();
    expect(escapePopupFor(boat(30), raft, 31.7)).toBe("saved-deck");
  });
  it("shows swim rescue, splash and freeze at once", () => {
    expect(escapePopupFor(boat(5, true), davit, 5)).toBe("saved-swim");
    const swimmer = { x: 0, z: 0, yaw: 0, warmth: 1, kick: 0 };
    expect(
      escapePopupFor(
        { kind: "swimming", since: 1, swimmer, warned: false },
        null,
        1
      )
    ).toBe("splash");
    expect(
      escapePopupFor({ kind: "frozen", since: 1, x: 0, z: 0 }, null, 1)
    ).toBe("frozen");
  });
});
