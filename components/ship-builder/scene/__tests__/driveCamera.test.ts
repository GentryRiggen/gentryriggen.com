import { createSail } from "@/lib/ship-builder/sail";
import { DECK_Y } from "../coords";
import { bankAngle, chaseCamera } from "../driveCamera";

const LENGTH = 12;

function sailAt(speed: number) {
  return { ...createSail(), speed };
}

describe("chaseCamera", () => {
  it("sits behind the bow axis, above the deck, and looks ahead of the ship", () => {
    const { position, target } = chaseCamera(sailAt(0), LENGTH);
    expect(position[0]).toBeLessThan(-LENGTH / 2);
    expect(position[1]).toBeGreaterThan(DECK_Y);
    expect(position[2]).toBe(0);
    expect(target[0]).toBeGreaterThan(0);
  });

  it("pulls back as speed rises and never closes in when reversing", () => {
    const still = chaseCamera(sailAt(0), LENGTH).position;
    const fast = chaseCamera(sailAt(6), LENGTH).position;
    const reversing = chaseCamera(sailAt(-1), LENGTH).position;
    expect(fast[0]).toBeLessThan(still[0]);
    expect(reversing[0]).toBeCloseTo(still[0]);
  });

  it("scales with the length of the ship", () => {
    const short = chaseCamera(sailAt(0), 6).position;
    const long = chaseCamera(sailAt(0), 24).position;
    expect(long[0]).toBeLessThan(short[0]);
    expect(long[1]).toBeGreaterThan(short[1]);
  });

  it("is finite for every input", () => {
    const inputs = [0, -5, 1e9, NaN, Infinity, -Infinity];
    for (const speed of inputs) {
      for (const length of [...inputs, 1]) {
        const { position, target } = chaseCamera(sailAt(speed), length);
        for (const value of [...position, ...target]) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

describe("bankAngle", () => {
  it("leans toward the turn, more at speed, and not at all when stopped", () => {
    expect(bankAngle({ rudder: 1, speed: 4 })).toBeGreaterThan(0);
    expect(bankAngle({ rudder: -1, speed: 4 })).toBeLessThan(0);
    expect(bankAngle({ rudder: 1, speed: 4 })).toBeGreaterThan(
      bankAngle({ rudder: 1, speed: 1 })
    );
    expect(bankAngle({ rudder: 1, speed: 0 })).toBe(0);
  });

  it("stays small and finite", () => {
    const angle = bankAngle({ rudder: 9, speed: Infinity });
    expect(Math.abs(angle)).toBeLessThan(0.3);
    expect(Number.isFinite(bankAngle({ rudder: NaN, speed: NaN }))).toBe(true);
  });
});
