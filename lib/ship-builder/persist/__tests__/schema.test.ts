import { CURRENT_VERSION, MAX_PARTS, migrate, parseShip } from "../schema";
import { attachPart, gridPart, testShip } from "../../testing";
import { HULL_ID } from "../../model/types";

const validShip = testShip([
  gridPart("a", "deck-1x1", 0, 2, 0),
  gridPart("b", "deck-1x1", 1, 2, 0),
  attachPart("dv", "davit", "b", "davit:2:0"),
]);

describe("parseShip", () => {
  it("accepts a valid ship", () => {
    expect(parseShip(validShip)).toEqual({ ok: true, ship: validShip });
  });

  it("round-trips a v2 ship of every beam through JSON", () => {
    for (const beam of [3, 4, 5, 6, 7]) {
      const ship = testShip(validShip.parts, 8, beam);
      expect(parseShip(JSON.parse(JSON.stringify(ship)))).toEqual({
        ok: true,
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
    ["a newer version", { ...validShip, v: 6 }],
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

  it("rejects data that breaks the building rules", () => {
    const floating = testShip([gridPart("a", "deck-1x1", 2, 0, 0)]);
    expect(parseShip(floating)).toEqual({
      ok: false,
      error: "Part a: Needs a deck beneath every cell",
    });
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
      ship: { ...testShip(validShip.parts, 10, 4), name: "Olympic" },
    });
  });

  it("overrides any beam already on a v1 hull", () => {
    const migrated = migrate({ ...v1, hull: { lengthSegments: 10, beam: 7 } });
    expect(migrated).toMatchObject({ v: 5, hull: { beam: 4 } });
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

  it("still rejects a v1 ship that breaks the building rules", () => {
    const floating = { ...v1, parts: [gridPart("a", "deck-1x1", 2, 0, 0)] };
    expect(parseShip(floating).ok).toBe(false);
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
      ship: { ...testShip(v3.parts), name: "Plain" },
    });
    expect(migrate(v3)).toMatchObject({
      v: 5,
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
    expect(migrate(v4)).toEqual({ ...v4, v: 5 });
    expect(parseShip(JSON.parse(JSON.stringify(v4)))).toEqual({
      ok: true,
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
