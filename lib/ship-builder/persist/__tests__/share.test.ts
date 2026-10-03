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
