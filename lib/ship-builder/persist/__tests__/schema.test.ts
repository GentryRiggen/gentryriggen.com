import {
  CURRENT_VERSION,
  MAX_PARTS,
  droppedPartsNotice,
  migrate,
  parseShip,
} from "../schema";
import { MAX_SEGMENTS } from "../../model/grid";
import { validateShip } from "../../model/placement";
import { attachPart, gridPart, testShip } from "../../testing";
import { HULL_ID } from "../../model/types";

const validShip = testShip([
  gridPart("a", "deck-1x1", 0, 2, 0),
  gridPart("b", "deck-1x1", 1, 2, 0),
  attachPart("dv", "davit", "b", "davit:2:0"),
]);

describe("parseShip", () => {
  it("accepts a valid ship", () => {
    expect(parseShip(validShip)).toEqual({
      ok: true,
      dropped: 0,
      ship: validShip,
    });
  });

  it("round-trips a v2 ship of every beam through JSON", () => {
    for (const beam of [3, 4, 5, 6, 7]) {
      const ship = testShip(validShip.parts, 8, beam);
      expect(parseShip(JSON.parse(JSON.stringify(ship)))).toEqual({
        ok: true,
        dropped: 0,
        ship,
      });
    }
  });

  it("strips unknown keys", () => {
    const result = parseShip({ ...validShip, extra: "x" });
    expect(result.ok && "extra" in result.ship).toBe(false);
  });

  it.each([
    ["null", null],
    ["a string", "ship"],
    ["an array", []],
    ["a newer version", { ...validShip, v: 8 }],
    ["an unknown bow", { ...validShip, hull: { ...validShip.hull, bow: "x" } }],
    [
      "a missing stern",
      { ...validShip, hull: { ...validShip.hull, stern: undefined } },
    ],
    [
      "a beam too narrow",
      { ...validShip, hull: { ...validShip.hull, beam: 2 } },
    ],
    ["a beam too wide", { ...validShip, hull: { ...validShip.hull, beam: 8 } }],
    [
      "a fractional beam",
      { ...validShip, hull: { ...validShip.hull, beam: 4.5 } },
    ],
    ["a missing beam", { ...validShip, hull: { lengthSegments: 8 } }],
    [
      "an unknown part type",
      { ...validShip, parts: [{ ...validShip.parts[0], type: "cannon" }] },
    ],
    [
      "a hull too long",
      { ...validShip, hull: { ...validShip.hull, lengthSegments: 99 } },
    ],
    [
      "a fractional hull",
      { ...validShip, hull: { ...validShip.hull, lengthSegments: 6.5 } },
    ],
    ["a long name", { ...validShip, name: "x".repeat(61) }],
    [
      "a bad rotation",
      { ...validShip, parts: [{ ...validShip.parts[0], rotation: 45 }] },
    ],
    [
      "too many parts",
      {
        ...validShip,
        parts: Array.from({ length: MAX_PARTS + 1 }, (_, i) =>
          gridPart(`p${i}`, "deck-1x1", 0, 0, 0)
        ),
      },
    ],
    [
      "too many parts as bare numbers",
      { ...validShip, parts: Array.from({ length: MAX_PARTS + 1 }, () => 0) },
    ],
    ["parts that aren't an array", { ...validShip, parts: { length: 1 } }],
  ])("rejects %s", (_label, raw) => {
    expect(parseShip(raw).ok).toBe(false);
  });

  it("checks the parts count before visiting any part", () => {
    const visited = jest.fn();
    const parts = new Proxy(
      Array.from({ length: MAX_PARTS + 1 }, () => 0),
      {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) visited(key);
          return Reflect.get(target, key, receiver);
        },
      }
    );
    expect(parseShip({ ...validShip, parts }).ok).toBe(false);
    expect(visited).not.toHaveBeenCalled();
  });

  it("turns errors thrown during parsing into a failure", () => {
    const hostile = {
      ...validShip,
      get hull(): never {
        throw new RangeError("boom");
      },
    };
    expect(parseShip(hostile)).toEqual({
      ok: false,
      error: "Invalid ship data",
    });
  });

  it("drops a part that no longer fits and keeps the rest", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("floating", "deck-1x1", 2, 0, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
    ]);
    const result = parseShip(JSON.parse(JSON.stringify(ship)));
    expect(result).toMatchObject({ ok: true, dropped: 1 });
    if (!result.ok) return;
    expect(result.ship.parts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(validateShip(result.ship).ok).toBe(true);
  });

  it("drops parts that depended on a dropped part", () => {
    const ship = testShip([
      gridPart("floating", "deck-1x1", 2, 0, 0),
      attachPart("dv", "davit", "floating", "davit:2:0"),
      gridPart("a", "deck-1x1", 0, 2, 0),
    ]);
    const result = parseShip(JSON.parse(JSON.stringify(ship)));
    expect(result).toMatchObject({ ok: true, dropped: 2 });
    if (!result.ok) return;
    expect(result.ship.parts.map((p) => p.id)).toEqual(["a"]);
  });

  it("keeps parts saved before the part that holds them up", () => {
    const ship = testShip([
      gridPart("b", "deck-1x1", 1, 2, 0),
      gridPart("a", "deck-1x1", 0, 2, 0),
    ]);
    const result = parseShip(JSON.parse(JSON.stringify(ship)));
    expect(result).toMatchObject({ ok: true, dropped: 0 });
    if (!result.ok) return;
    expect(result.ship.parts).toHaveLength(2);
  });

  it("still rejects a structurally broken ship", () => {
    expect(parseShip({ ...validShip, kind: "raft" }).ok).toBe(false);
    expect(
      parseShip({ ...validShip, hull: { ...validShip.hull, beam: 99 } }).ok
    ).toBe(false);
    expect(parseShip({ ...validShip, parts: [{ id: "x" }] }).ok).toBe(false);
  });

  it("words the notice for one part and for several", () => {
    expect(droppedPartsNotice(0)).toBeNull();
    expect(droppedPartsNotice(1)).toBe(
      "1 part didn't fit any more and was removed"
    );
    expect(droppedPartsNotice(2)).toBe(
      "2 parts didn't fit any more and were removed"
    );
  });
});

describe("v1 to v2 migration", () => {
  const v1 = {
    v: 1,
    name: "Olympic",
    hull: { lengthSegments: 10 },
    parts: validShip.parts,
  };

  it("loads a v1 ship as v2 with the default beam", () => {
    expect(parseShip(JSON.parse(JSON.stringify(v1)))).toEqual({
      ok: true,
      dropped: 0,
      ship: { ...testShip(validShip.parts, 10, 4), name: "Olympic" },
    });
  });

  it("overrides any beam already on a v1 hull", () => {
    const migrated = migrate({ ...v1, hull: { lengthSegments: 10, beam: 7 } });
    expect(migrated).toMatchObject({ v: 7, kind: "liner", hull: { beam: 4 } });
  });

  it("does not mutate the input", () => {
    const input = JSON.parse(JSON.stringify(v1));
    migrate(input);
    expect(input).toEqual(v1);
  });

  it.each([
    ["no hull", { ...v1, hull: undefined }],
    ["a null hull", { ...v1, hull: null }],
    ["an array hull", { ...v1, hull: [10] }],
    ["a string hull", { ...v1, hull: "long" }],
  ])("leaves a v1 ship with %s unmigrated so parsing fails", (_label, raw) => {
    expect(migrate(raw)).toBe(raw);
    expect(parseShip(raw).ok).toBe(false);
  });

  it("drops the parts of a v1 ship that break the building rules", () => {
    const floating = { ...v1, parts: [gridPart("a", "deck-1x1", 2, 0, 0)] };
    expect(parseShip(floating)).toMatchObject({ ok: true, dropped: 1 });
  });
});

describe("v2 to v3 migration", () => {
  const v2 = {
    v: 2,
    name: "Masts",
    hull: { lengthSegments: 8, beam: 4 },
    parts: [
      { ...attachPart("mf", "mast", HULL_ID, "mast-fore"), type: "mast-fore" },
      { ...attachPart("ma", "mast", HULL_ID, "mast-aft"), type: "mast-aft" },
      gridPart("a", "deck-1x1", 0, 2, 1),
    ],
  };

  it("turns fore and aft masts into masts on the same anchors", () => {
    expect(parseShip(JSON.parse(JSON.stringify(v2)))).toEqual({
      ok: true,
      dropped: 0,
      ship: {
        ...testShip([
          attachPart("mf", "mast", HULL_ID, "mast-fore"),
          attachPart("ma", "mast", HULL_ID, "mast-aft"),
          gridPart("a", "deck-1x1", 0, 2, 1),
        ]),
        name: "Masts",
      },
    });
  });

  it("does not mutate the input", () => {
    const input = JSON.parse(JSON.stringify(v2));
    migrate(input);
    expect(input).toEqual(v2);
  });

  it("runs v1 ships through both steps", () => {
    const v1 = { ...v2, v: 1, hull: { lengthSegments: 8 } };
    expect(parseShip(JSON.parse(JSON.stringify(v1))).ok).toBe(true);
  });

  it("leaves a ship with non-array parts unmigrated", () => {
    const raw = { ...v2, parts: "none" };
    expect(migrate(raw)).toBe(raw);
  });
});

describe("v3 to v4 migration", () => {
  const v3 = {
    v: 3,
    name: "Plain",
    hull: { lengthSegments: 8, beam: 4 },
    parts: [gridPart("a", "deck-1x1", 0, 2, 1)],
  };

  it("gives the hull the default bow and stern", () => {
    expect(parseShip(JSON.parse(JSON.stringify(v3)))).toEqual({
      ok: true,
      dropped: 0,
      ship: { ...testShip(v3.parts), name: "Plain" },
    });
    expect(migrate(v3)).toMatchObject({
      v: 7,
      hull: { bow: "straight", stern: "counter" },
    });
  });

  it("does not mutate the input", () => {
    const input = JSON.parse(JSON.stringify(v3));
    migrate(input);
    expect(input).toEqual(v3);
  });

  it("loads v1 and v2 ships through every step", () => {
    const v2 = { ...v3, v: 2 };
    const v1 = { ...v3, v: 1, hull: { lengthSegments: 8 } };
    for (const old of [v1, v2]) {
      expect(parseShip(JSON.parse(JSON.stringify(old)))).toEqual({
        ok: true,
        dropped: 0,
        ship: { ...testShip(v3.parts), name: "Plain" },
      });
    }
  });

  it("round-trips a ship with non-default ends", () => {
    const ship = testShip(v3.parts);
    const shaped = {
      ...ship,
      hull: { ...ship.hull, bow: "clipper", stern: "canoe" },
    } as const;
    expect(parseShip(JSON.parse(JSON.stringify(shaped)))).toEqual({
      ok: true,
      dropped: 0,
      ship: shaped,
    });
  });

  it("leaves a ship without a hull record unmigrated", () => {
    const raw = { ...v3, hull: null };
    expect(migrate(raw)).toBe(raw);
  });
});

describe("v4 to v5 migration", () => {
  const v4 = {
    v: 4,
    name: "Plain",
    hull: { lengthSegments: 8, beam: 4, bow: "straight", stern: "counter" },
    parts: [gridPart("a", "deck-1x1", 0, 2, 1)],
  };

  it("only bumps the version", () => {
    expect(migrate({ ...v4, v: 4 })).toEqual({ ...v4, v: 7, kind: "liner" });
    expect(parseShip(JSON.parse(JSON.stringify(v4)))).toEqual({
      ok: true,
      dropped: 0,
      ship: { ...testShip(v4.parts), name: "Plain" },
    });
  });

  it("loads v1 to v3 ships through every step", () => {
    const { bow, stern, ...hull } = v4.hull;
    expect([bow, stern]).toEqual(["straight", "counter"]);
    const v3 = { ...v4, v: 3, hull };
    const v1 = { ...v4, v: 1, hull: { lengthSegments: 8 } };
    for (const old of [v1, v3]) {
      expect(parseShip(JSON.parse(JSON.stringify(old)))).toEqual({
        ok: true,
        dropped: 0,
        ship: { ...testShip(v4.parts), name: "Plain" },
      });
    }
  });

  it("round-trips a painted ship", () => {
    const base = testShip([gridPart("a", "deck-1x1", 0, 2, 1)]);
    const painted = {
      ...base,
      hull: { ...base.hull, paint: { topsides: "navy", bottom: "green" } },
      parts: [{ ...base.parts[0], color: "red" }],
    } as const;
    expect(parseShip(JSON.parse(JSON.stringify(painted)))).toEqual({
      ok: true,
      dropped: 0,
      ship: painted,
    });
  });

  it("ignores colour when validating placement", () => {
    const base = testShip([gridPart("a", "deck-1x1", 0, 2, 1)]);
    const painted = {
      ...base,
      parts: [{ ...base.parts[0], color: "pink" }],
    } as const;
    expect(parseShip(painted).ok).toBe(true);
  });

  it.each([
    [
      "a part colour",
      (s: typeof v4) => ({
        ...s,
        v: 5,
        parts: [{ ...s.parts[0], color: "teal" }],
      }),
    ],
    [
      "a topsides colour",
      (s: typeof v4) => ({
        ...s,
        v: 5,
        hull: { ...s.hull, paint: { topsides: "#fff" } },
      }),
    ],
    [
      "a bottom colour",
      (s: typeof v4) => ({
        ...s,
        v: 5,
        hull: { ...s.hull, paint: { bottom: 3 } },
      }),
    ],
  ])("rejects an unknown %s", (_label, make) => {
    expect(parseShip(make(v4)).ok).toBe(false);
  });
});

describe("v5 to v6 migration", () => {
  const v5 = {
    v: 5,
    name: "Old liner",
    hull: { lengthSegments: 8, beam: 4, bow: "straight", stern: "counter" },
    parts: [gridPart("a", "deck-1x1", 0, 2, 1)],
  };

  it("adds the liner kind", () => {
    expect(migrate(v5)).toEqual({ ...v5, v: 7, kind: "liner" });
    expect(parseShip(JSON.parse(JSON.stringify(v5)))).toEqual({
      ok: true,
      dropped: 0,
      ship: { ...testShip(v5.parts), name: "Old liner" },
    });
  });

  it("loads a v1 ship through every step as a liner", () => {
    const v1 = { ...v5, v: 1, hull: { lengthSegments: 8 } };
    const result = parseShip(JSON.parse(JSON.stringify(v1)));
    expect(result.ok && result.ship.kind).toBe("liner");
  });

  it.each(["cruise", "navy", "cargo"] as const)(
    "round-trips a %s ship",
    (kind) => {
      const ship = { ...testShip(v5.parts), kind };
      expect(parseShip(JSON.parse(JSON.stringify(ship)))).toEqual({
        ok: true,
        dropped: 0,
        ship,
      });
    }
  );

  it.each([["submarine"], [""], [3], [null]])(
    "rejects the unknown kind %p",
    (kind) => {
      expect(parseShip({ ...testShip(v5.parts), kind }).ok).toBe(false);
    }
  );

  it("rejects a v6 ship with no kind", () => {
    const { kind, ...rest } = testShip(v5.parts);
    expect(kind).toBe("liner");
    expect(parseShip(rest).ok).toBe(false);
  });
});

describe("migrate", () => {
  it("runs migrations up to the current version", () => {
    const migrated = migrate(
      { v: 0, title: "Old", hull: { lengthSegments: 6 }, parts: [] },
      {
        0: (raw) => ({
          v: 1,
          name: raw.title,
          hull: raw.hull,
          parts: raw.parts,
        }),
        1: (raw) => ({ ...raw, v: 2, hull: { lengthSegments: 6, beam: 5 } }),
        2: (raw) => ({ ...raw, v: 3 }),
        3: (raw) => ({ ...raw, v: 4 }),
        4: (raw) => ({ ...raw, v: 5 }),
        5: (raw) => ({ ...raw, v: 6 }),
        6: (raw) => ({ ...raw, v: 7 }),
      }
    );
    expect(migrated).toEqual({
      v: CURRENT_VERSION,
      name: "Old",
      hull: { lengthSegments: 6, beam: 5 },
      parts: [],
    });
  });

  it("stops at the last good record when a step throws", () => {
    const start = { v: -1, name: "x" };
    const step0 = { v: 0, name: "x" };
    const result = migrate(start, {
      [-1]: () => step0,
      0: () => {
        throw new Error("boom");
      },
    });
    expect(result).toBe(step0);
    expect(parseShip(result).ok).toBe(false);
  });

  it("stops at the last good record when a step returns a non-record", () => {
    const start = { v: 0, name: "x" };
    const result = migrate(start, {
      0: () => null as unknown as Record<string, unknown>,
    });
    expect(result).toBe(start);
    expect(parseShip(result).ok).toBe(false);
  });

  it("leaves current and unknown data alone", () => {
    expect(migrate(validShip)).toBe(validShip);
    expect(migrate("nope")).toBe("nope");
    expect(migrate({ v: -5 })).toEqual({ v: -5 });
  });
});

describe("bulkheads", () => {
  const withWalls = (bulkheads: unknown, lengthSegments = 8) => ({
    ...validShip,
    hull: { ...validShip.hull, lengthSegments, bulkheads },
  });

  it("keeps valid walls and stays on the current version", () => {
    const bulkheads = [
      { at: 2, height: "low" },
      { at: 5, height: "deck" },
    ];
    const result = parseShip(withWalls(bulkheads));
    expect(result.ok && result.ship.v).toBe(CURRENT_VERSION);
    expect(result.ok && result.ship.hull.bulkheads).toEqual(bulkheads);
  });

  it("loads a ship without any walls", () => {
    const result = parseShip(validShip);
    expect(result.ok && "bulkheads" in result.ship.hull).toBe(false);
  });

  it("drops out-of-range and doubled walls instead of rejecting the ship", () => {
    const result = parseShip(
      withWalls([
        { at: 0, height: "low" },
        { at: 8, height: "low" },
        { at: 6, height: "deck" },
        { at: 3, height: "waterline" },
        { at: 3, height: "low" },
      ])
    );
    expect(result).toMatchObject({ ok: true, dropped: 0 });
    expect(result.ok && result.ship.hull.bulkheads).toEqual([
      { at: 3, height: "waterline" },
      { at: 6, height: "deck" },
    ]);
  });

  it("drops a fractional or non-numeric wall instead of rejecting the ship", () => {
    const result = parseShip(
      withWalls([
        { at: 2.5, height: "low" },
        { at: "3", height: "low" },
        { height: "low" },
        { at: 4, height: "deck" },
      ])
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.ship.hull.bulkheads).toEqual([
      { at: 4, height: "deck" },
    ]);
  });

  it("removes the list when no wall is valid", () => {
    const result = parseShip(withWalls([{ at: 99, height: "low" }]));
    expect(result.ok && "bulkheads" in result.ship.hull).toBe(false);
  });

  it("rejects a wall with an unknown height", () => {
    expect(parseShip(withWalls([{ at: 2, height: "tall" }])).ok).toBe(false);
  });

  it("rejects more walls than the longest hull has boundaries", () => {
    const walls = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => ({
      at: i + 1,
      height: "low",
    }));
    expect(parseShip(withWalls(walls)).ok).toBe(false);
  });
});
