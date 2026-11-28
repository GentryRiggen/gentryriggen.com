import { concordia } from "../../ships/concordia";
import { CONCORDIA_INTERIOR } from "../concordia";
import { roomsOpen } from "../open";
import { TITANIC_INTERIOR } from "../titanic";

describe("roomsOpen", () => {
  it("keeps her rooms open at 29.9° and closes them at 30°, either way", () => {
    expect(CONCORDIA_INTERIOR.closeAtHeelDeg).toBe(30);
    for (const sign of [1, -1]) {
      expect(
        roomsOpen(CONCORDIA_INTERIOR, { listDeg: sign * 29.9 }, false)
      ).toBe(true);
      expect(roomsOpen(CONCORDIA_INTERIOR, { listDeg: sign * 30 }, false)).toBe(
        false
      );
      expect(roomsOpen(CONCORDIA_INTERIOR, { listDeg: sign * 38 }, false)).toBe(
        false
      );
    }
    expect(concordia.id).toBe(CONCORDIA_INTERIOR.ship);
  });

  it("closes every ship's rooms when she is broken", () => {
    expect(roomsOpen(CONCORDIA_INTERIOR, { listDeg: 0 }, true)).toBe(false);
    expect(roomsOpen(TITANIC_INTERIOR, { listDeg: 0 }, true)).toBe(false);
  });

  it("leaves the Titanic's open until she breaks, whatever her list", () => {
    expect(TITANIC_INTERIOR.closeAtHeelDeg).toBeUndefined();
    for (const list of [0, 12, 30, 45, -60])
      expect(roomsOpen(TITANIC_INTERIOR, { listDeg: list }, false)).toBe(true);
  });

  it("treats a missing or NaN list as upright", () => {
    expect(roomsOpen(CONCORDIA_INTERIOR, { listDeg: NaN }, false)).toBe(true);
  });
});
