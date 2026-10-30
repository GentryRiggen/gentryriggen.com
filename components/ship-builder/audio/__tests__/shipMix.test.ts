import { emptyShip } from "@/lib/ship-builder/model/placement";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import {
  buildCueFor,
  modeFor,
  rushLevelFor,
  worldBedsFor,
  type BuildSnapshot,
} from "../shipMix";

describe("modeFor", () => {
  const idle = { isTrialRunning: false, isSailing: false, isWalking: false };

  it("builds by default", () => {
    expect(modeFor(idle)).toBe("build");
  });

  it("picks sailing, a trial or walking, with walking winning", () => {
    expect(modeFor({ ...idle, isSailing: true })).toBe("sail");
    expect(modeFor({ ...idle, isTrialRunning: true })).toBe("trial");
    expect(modeFor({ ...idle, isTrialRunning: true, isWalking: true })).toBe(
      "walk"
    );
  });
});

describe("worldBedsFor", () => {
  const base = { seaState: "calm", throttle: 0, speedShare: 0 } as const;

  it("leaves the trial's sea to the trial", () => {
    const beds = worldBedsFor({ ...base, mode: "trial" });
    expect(Object.values(beds).every((level) => level === 0)).toBe(true);
  });

  it("makes a rougher sea wash and blow harder", () => {
    const calm = worldBedsFor({ ...base, mode: "build" });
    const stormy = worldBedsFor({ ...base, mode: "build", seaState: "stormy" });
    expect(stormy.wash).toBeGreaterThan(calm.wash);
    expect(stormy.wind).toBeGreaterThan(calm.wind);
  });

  it("is quiet and engine-free while building", () => {
    const beds = worldBedsFor({ ...base, mode: "build", seaState: "stormy" });
    expect(beds.thrum).toBe(0);
    expect(beds.bow).toBe(0);
    expect(beds.wash).toBeLessThan(0.6);
  });

  it("follows the throttle with the engine thrum", () => {
    const idle = worldBedsFor({ ...base, mode: "sail", throttle: 0 });
    const full = worldBedsFor({ ...base, mode: "sail", throttle: 1 });
    const astern = worldBedsFor({ ...base, mode: "sail", throttle: -0.3 });
    expect(idle.thrum).toBeGreaterThan(0);
    expect(full.thrum).toBeGreaterThan(idle.thrum);
    expect(astern.thrum).toBeGreaterThan(idle.thrum);
    expect(full.thrum).toBeLessThanOrEqual(1);
  });

  it("follows speed with the bow wave, in either direction, and caps at 1", () => {
    expect(worldBedsFor({ ...base, mode: "sail", speedShare: 0 }).bow).toBe(0);
    expect(worldBedsFor({ ...base, mode: "sail", speedShare: 0.5 }).bow).toBe(
      0.5
    );
    expect(worldBedsFor({ ...base, mode: "sail", speedShare: -0.4 }).bow).toBe(
      0.4
    );
    expect(worldBedsFor({ ...base, mode: "sail", speedShare: 3 }).bow).toBe(1);
  });

  it("keeps every level between 0 and 1", () => {
    const beds = worldBedsFor({
      mode: "sail",
      seaState: "stormy",
      throttle: 1,
      speedShare: 1,
    });
    for (const level of Object.values(beds)) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });
});

describe("rushLevelFor", () => {
  it("is silent until she starts to sink", () => {
    expect(rushLevelFor("sailing", 10, null)).toBe(0);
    expect(rushLevelFor("sailing", 10, undefined)).toBe(0);
  });

  it("rises as she sinks, then eases once she is deep", () => {
    const early = rushLevelFor("sinking", 12, 10);
    const later = rushLevelFor("sinking", 30, 10);
    expect(early).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(early);
    expect(later).toBe(1);
    expect(rushLevelFor("descending", 40, 10)).toBeLessThan(1);
  });

  it("stops when the trial is done", () => {
    expect(rushLevelFor("done", 40, 10)).toBe(0);
  });
});

function part(id: string, color?: string): PlacedPart {
  return { id, type: "funnel", color } as unknown as PlacedPart;
}

function snapshot(ship: Ship, history: number, future = 0): BuildSnapshot {
  return { ship, historyLength: history, futureLength: future };
}

describe("buildCueFor", () => {
  const empty = emptyShip();
  const withOne: Ship = { ...empty, parts: [part("a")] };
  const withTwo: Ship = { ...empty, parts: [part("a"), part("b")] };

  it("is silent when the ship did not change", () => {
    expect(buildCueFor(snapshot(empty, 0), snapshot(empty, 0))).toBeNull();
  });

  it("clicks when one part is placed", () => {
    expect(buildCueFor(snapshot(empty, 0), snapshot(withOne, 1))).toEqual({
      kind: "place",
    });
  });

  it("pops when parts are removed", () => {
    expect(buildCueFor(snapshot(withTwo, 2), snapshot(withOne, 3))).toEqual({
      kind: "remove",
    });
  });

  it("swishes when a colour changes", () => {
    const painted: Ship = { ...withOne, parts: [part("a", "red")] };
    expect(buildCueFor(snapshot(withOne, 1), snapshot(painted, 2))).toEqual({
      kind: "paint",
    });
  });

  it("swishes for hull paint", () => {
    const painted: Ship = {
      ...empty,
      hull: { ...empty.hull, paint: { topsides: "red" } as never },
    };
    expect(buildCueFor(snapshot(empty, 0), snapshot(painted, 1))).toEqual({
      kind: "paint",
    });
  });

  it("whooshes for undo and redo, telling them apart", () => {
    expect(buildCueFor(snapshot(withOne, 1, 0), snapshot(empty, 0, 1))).toEqual(
      {
        kind: "undo",
      }
    );
    expect(buildCueFor(snapshot(empty, 0, 1), snapshot(withOne, 1, 0))).toEqual(
      {
        kind: "redo",
      }
    );
  });

  it("is silent when a whole other ship is loaded", () => {
    const other: Ship = {
      ...empty,
      parts: [part("x"), part("y"), part("z")],
    };
    expect(buildCueFor(snapshot(empty, 0), snapshot(other, 1))).toBeNull();
    const otherKind: Ship = {
      ...withOne,
      kind: empty.kind === "liner" ? "cargo" : "liner",
    };
    expect(buildCueFor(snapshot(empty, 0), snapshot(otherKind, 1))).toBeNull();
  });

  it("is silent when history was reset by a load", () => {
    expect(buildCueFor(snapshot(withOne, 5), snapshot(empty, 0))).toBeNull();
  });
});
