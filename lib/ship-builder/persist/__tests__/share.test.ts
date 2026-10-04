import { compressToEncodedURIComponent } from "lz-string";
import {
  buildShareUrl,
  decodeShareHash,
  encodeShip,
  MAX_JSON_LENGTH,
  MAX_SHARE_LENGTH,
} from "../share";
import { attachPart, gridPart, testShip } from "../../testing";

const ship = testShip(
  [
    gridPart("a", "deck-2x1", 0, 2, 0, 90),
    gridPart("b", "deck-1x1", 1, 2, 0),
    attachPart("dv", "davit", "b", "davit:2:0"),
    attachPart("lb", "lifeboat-standard", "dv", "boat"),
  ],
  10
);

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
