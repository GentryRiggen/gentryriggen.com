import { compressToEncodedURIComponent } from "lz-string";
import {
  buildShareUrl,
  decodeShareHash,
  encodeShip,
  MAX_JSON_LENGTH,
  MAX_SHARE_LENGTH,
} from "../share";
import { MAX_BEAM, MAX_SEGMENTS, CELLS_PER_SEGMENT } from "../../model/grid";
import { HULL_ID, type PlacedPart, type Ship } from "../../model/types";
import { MAX_PARTS, parseShip } from "../schema";
import { attachPart, gridPart, testShip } from "../../testing";

/** Ids shaped like the store's newId("p"): a prefix plus about 12 random chars. */
function randomId(random: () => number): string {
  return `p-${random().toString(36).slice(2, 10)}${random().toString(36).slice(2, 6)}`;
}

/** A small deterministic PRNG, so the measured size never flaps. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * The largest valid ship: the longest hull, the widest beam and MAX_PARTS deck
 * blocks with store-style random ids (random ids compress worst).
 */
function largestShip(partCount = MAX_PARTS): Ship {
  const random = seededRandom(42);
  const length = MAX_SEGMENTS * CELLS_PER_SEGMENT;
  const parts: PlacedPart[] = [];
  for (let level = 0; parts.length < partCount; level++) {
    for (let x = 0; x < length && parts.length < partCount; x++) {
      for (let z = 0; z < MAX_BEAM && parts.length < partCount; z++) {
        parts.push(gridPart(randomId(random), "deck-1x1", level, x, z));
      }
    }
  }
  return testShip(parts, MAX_SEGMENTS, MAX_BEAM);
}

const ship = testShip(
  [
    gridPart("a", "deck-2x1", 0, 2, 0, 90),
    gridPart("b", "deck-1x1", 1, 2, 0),
    attachPart("dv", "davit", "b", "davit:2:0"),
    attachPart("lb", "lifeboat-standard", "dv", "boat"),
  ],
  10
);

describe("share links from older versions", () => {
  it("loads a v1 link with the default beam", () => {
    const v1 = { ...ship, v: 1, hull: { lengthSegments: 10 } };
    const hash = `#ship=${compressToEncodedURIComponent(JSON.stringify(v1))}`;
    expect(decodeShareHash(hash)).toEqual({ kind: "ok", ship });
  });

  it("loads a v2 link with old mast types", () => {
    const v2 = {
      ...ship,
      v: 2,
      parts: [
        ...ship.parts,
        { ...attachPart("m", "mast", HULL_ID, "mast-fore"), type: "mast-fore" },
      ],
    };
    const hash = `#ship=${compressToEncodedURIComponent(JSON.stringify(v2))}`;
    expect(decodeShareHash(hash)).toEqual({
      kind: "ok",
      ship: {
        ...ship,
        parts: [...ship.parts, attachPart("m", "mast", HULL_ID, "mast-fore")],
      },
    });
  });
});

describe("share links", () => {
  it("round-trips a ship through the hash", () => {
    expect(decodeShareHash(`#ship=${encodeShip(ship)}`)).toEqual({
      kind: "ok",
      ship,
    });
  });

  it("decodes a share link made by v1, before ships had a beam", () => {
    const V1_LINK =
      "N4IgbiBcCMA0IDsCGBbAplEB5ANgTxQAcBLAYxHgAsBXHHKUHNBAcwBdKBlNF9BNgM5RoABgC+8QkgBOgqAG1QxACaYkFEGzyEMkEMrSkA1gFoATAA9oGpAlKUA9tIYgjxBKr0tpKjUzBo9JAi8BZQZvAAXlDi8NIObEhsxA4IUACcsUqeIABGGlo6mAbGJtBWNnaOzpCgbh6Y3r7w-oHCoeFRMRIg8YnJqd2w2cUQ8IW6+khgxGyV9k4u9TlJifYaUtLMbACSOfmSDu67OcrTs5BmwSA9fUkpacESI3o4B5rakzjEAGZouQ4kiYBIkPDJVPBbAsanV3Cs2GtKBsZNs9qMNkd+Gi9ACkjc4gl7oMngBdMRAA";
    expect(decodeShareHash(`#ship=${V1_LINK}`)).toEqual({
      kind: "ok",
      ship: { ...ship, name: "Olympic" },
    });
  });

  it("finds the ship key among other params", () => {
    expect(decodeShareHash(`#foo=1&ship=${encodeShip(ship)}`).kind).toBe("ok");
  });

  it("builds a /ship-builder URL", () => {
    expect(buildShareUrl(ship, "https://gentryriggen.com")).toBe(
      `https://gentryriggen.com/ship-builder#ship=${encodeShip(ship)}`
    );
  });

  it("builds a share link for the largest valid ship that opens again", () => {
    const largest = largestShip();
    expect(parseShip(largest).ok).toBe(true);
    const url = buildShareUrl(largest, "https://gentryriggen.com");
    expect(url).not.toBeNull();
    const hash = new URL(url!).hash;
    expect(decodeShareHash(hash)).toEqual({ kind: "ok", ship: largest });
  });

  it("keeps the largest ship well inside both length caps", () => {
    const largest = largestShip();
    expect(encodeShip(largest).length).toBeLessThanOrEqual(MAX_SHARE_LENGTH);
    expect(JSON.stringify(largest).length).toBeLessThan(MAX_JSON_LENGTH / 2);
  });

  it("returns null when the ship is too big to share", () => {
    const tooBig = largestShip(MAX_PARTS * 3);
    expect(encodeShip(tooBig).length).toBeGreaterThan(MAX_SHARE_LENGTH);
    expect(buildShareUrl(tooBig, "https://gentryriggen.com")).toBeNull();
  });

  it("returns none without a ship key", () => {
    expect(decodeShareHash("")).toEqual({ kind: "none" });
    expect(decodeShareHash("#other=1")).toEqual({ kind: "none" });
  });

  it.each([
    ["garbage", "#ship=%%%not-lz%%%"],
    ["empty", "#ship="],
    ["non-JSON", `#ship=${compressToEncodedURIComponent("not json")}`],
    [
      "invalid ship",
      `#ship=${compressToEncodedURIComponent(JSON.stringify({ v: 1 }))}`,
    ],
    ["oversize", `#ship=${"A".repeat(MAX_SHARE_LENGTH + 1)}`],
  ])("returns invalid for %s", (_label, hash) => {
    expect(decodeShareHash(hash)).toEqual({ kind: "invalid" });
  });

  it("rejects a decompression bomb quickly", () => {
    const json =
      '{"v":1,"name":"x","hull":{"lengthSegments":8},"parts":[' +
      "0,".repeat(100_000) +
      "0]}";
    const hash = `#ship=${compressToEncodedURIComponent(json)}`;
    const start = performance.now();
    expect(decodeShareHash(hash)).toEqual({ kind: "invalid" });
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("rejects decompressed JSON over the length cap", () => {
    const json = JSON.stringify({ ...ship, pad: "x".repeat(MAX_JSON_LENGTH) });
    const hash = `#ship=${compressToEncodedURIComponent(json)}`;
    expect(hash.length).toBeLessThan(MAX_SHARE_LENGTH);
    expect(decodeShareHash(hash)).toEqual({ kind: "invalid" });
  });
});
