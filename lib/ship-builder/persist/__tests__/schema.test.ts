import { CURRENT_VERSION, MAX_PARTS, migrate, parseShip } from "../schema";
import { attachPart, gridPart, testShip } from "../../testing";

const validShip = testShip([
  gridPart("a", "deck-1x1", 0, 2, 0),
  gridPart("b", "deck-1x1", 1, 2, 0),
  attachPart("dv", "davit", "b", "davit:2:0"),
]);

describe("parseShip", () => {
  it("accepts a valid ship", () => {
    expect(parseShip(validShip)).toEqual({ ok: true, ship: validShip });
  });

  it("strips unknown keys", () => {
    const result = parseShip({ ...validShip, extra: "x" });
    expect(result.ok && "extra" in result.ship).toBe(false);
  });

  it.each([
    ["null", null],
    ["a string", "ship"],
    ["an array", []],
    ["the wrong version", { ...validShip, v: 2 }],
    [
      "an unknown part type",
      { ...validShip, parts: [{ ...validShip.parts[0], type: "cannon" }] },
    ],
    ["a hull too long", { ...validShip, hull: { lengthSegments: 99 } }],
    ["a fractional hull", { ...validShip, hull: { lengthSegments: 6.5 } }],
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
      }
    );
    expect(migrated).toEqual({
      v: CURRENT_VERSION,
      name: "Old",
      hull: { lengthSegments: 6 },
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
