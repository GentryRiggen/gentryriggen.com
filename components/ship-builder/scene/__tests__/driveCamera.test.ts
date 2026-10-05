import { createSail } from "@/lib/ship-builder/sail";
import { DECK_Y } from "../coords";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { findTemplate } from "@/lib/ship-builder/templates";
import {
  bankAngle,
  bridgeCamera,
  bridgeLayout,
  chaseCamera,
  topCamera,
} from "../driveCamera";

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

describe("topCamera", () => {
  it("is straight above the ship, looking down with the bow up the screen", () => {
    const { position, target, up } = topCamera(sailAt(0), LENGTH);
    expect(position[1]).toBeGreaterThan(DECK_Y);
    expect(position[2]).toBe(0);
    expect(target[1]).toBe(0);
    expect(position[0]).toBe(target[0]);
    expect(position[2]).toBe(target[2]);
    expect(up).toEqual([1, 0, 0]);
  });

  it("rises with the length of the ship and a little with speed", () => {
    expect(topCamera(sailAt(0), 24).position[1]).toBeGreaterThan(
      topCamera(sailAt(0), 6).position[1]
    );
    const still = topCamera(sailAt(0), LENGTH).position[1];
    const fast = topCamera(sailAt(6), LENGTH).position[1];
    expect(fast).toBeGreaterThan(still);
    expect(fast).toBeLessThan(still * 1.5);
  });

  it("is finite for every input", () => {
    const inputs = [0, -5, 1e9, NaN, Infinity, -Infinity];
    for (const speed of inputs) {
      for (const length of [...inputs, 1]) {
        const { position, target } = topCamera(sailAt(speed), length);
        for (const value of [...position, ...target]) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

function templateShip(id: string) {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.build();
}

describe("bridgeLayout and bridgeCamera", () => {
  it("puts the eye at the bridge, above its floor, looking along the bow", () => {
    const ship = templateShip("titanic");
    const layout = bridgeLayout(ship);
    expect(layout.hasBridge).toBe(true);
    const { position, target } = bridgeCamera(layout);
    expect(position[1]).toBeGreaterThan(layout.floor[1]);
    expect(position[0]).toBe(layout.floor[0]);
    expect(position[2]).toBe(layout.floor[2]);
    expect(target[0]).toBeGreaterThan(position[0]);
    expect(target[2]).toBe(position[2]);
    // The bridge sits in the forward half.
    expect(position[0]).toBeGreaterThan(0);
    expect(position[0]).toBeLessThan(gridLength(ship) / 2);
  });

  it("falls back to the forward third of the deck when there is no bridge", () => {
    const ship = templateShip("titanic");
    ship.parts = ship.parts.filter((part) => !part.type.startsWith("bridge"));
    const layout = bridgeLayout(ship);
    expect(layout.hasBridge).toBe(false);
    const length = gridLength(ship);
    expect(layout.floor[0]).toBeGreaterThan(0);
    expect(layout.floor[0]).toBeLessThan(length / 2);
    expect(layout.floor[1]).toBeGreaterThanOrEqual(DECK_Y);
    expect(layout.floor[2]).toBe(0);
    const { position } = bridgeCamera(layout);
    expect(position[1]).toBeGreaterThan(layout.floor[1]);
  });

  it("works for a ship with no parts at all", () => {
    const ship = templateShip("titanic");
    ship.parts = [];
    const { position, target } = bridgeCamera(bridgeLayout(ship));
    for (const value of [...position, ...target]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("rises over a stack of containers ahead of the bridge, within a limit", () => {
    const ship = templateShip("ever-given");
    const layout = bridgeLayout(ship);
    expect(layout.clearY).toBeDefined();
    const { position } = bridgeCamera(layout);
    expect(position[1]).toBeGreaterThanOrEqual(layout.clearY ?? 0);
    expect(position[1]).toBeLessThanOrEqual(layout.floor[1] + 9);
    const low = bridgeCamera({ ...layout, clearY: layout.floor[1] });
    expect(low.position[1]).toBeLessThan(position[1]);
    const huge = bridgeCamera({ ...layout, clearY: 1e6 });
    expect(huge.position[1]).toBe(layout.floor[1] + 9);
  });

  it("is finite when the layout is not", () => {
    const { position, target } = bridgeCamera({
      floor: [NaN, Infinity, -Infinity],
      hasBridge: true,
      clearY: NaN,
    });
    for (const value of [...position, ...target]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
