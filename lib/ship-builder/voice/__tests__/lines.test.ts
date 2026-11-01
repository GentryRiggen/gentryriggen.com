import manifest from "../manifest.json";
import {
  pickVoiceLine,
  SHIP_VOICE_LINES,
  VOICE_MOMENTS,
  voiceMomentIds,
} from "../lines";
import { getShipClip } from "../manifest";

describe("ship voice lines", () => {
  it("has unique ids", () => {
    const ids = SHIP_VOICE_LINES.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(VOICE_MOMENTS)("has at least two variants for %s", (moment) => {
    const ids = voiceMomentIds(moment);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const id of ids) expect(id).toMatch(`escape/${moment}-`);
  });

  it("speaks the scripted words", () => {
    const text = (id: string) =>
      SHIP_VOICE_LINES.find((line) => line.id === id)?.text;
    expect(text("escape/splash-1")).toBe(
      "Splash! No boat for you. You'll have to survive the waters!"
    );
    expect(text("escape/saved-deck-3")).toBe(
      "Safe and sound. Great thinking, sailor!"
    );
    expect(SHIP_VOICE_LINES).toHaveLength(16);
  });

  it("rotates through the variants by a counter", () => {
    expect(pickVoiceLine("saved-deck", 0)).toBe("escape/saved-deck-1");
    expect(pickVoiceLine("saved-deck", 1)).toBe("escape/saved-deck-2");
    expect(pickVoiceLine("saved-deck", 2)).toBe("escape/saved-deck-3");
    expect(pickVoiceLine("saved-deck", 3)).toBe("escape/saved-deck-1");
    expect(pickVoiceLine("cold", 5)).toBe("escape/cold-2");
  });

  it("has a manifest entry only for lines that exist", () => {
    const ids = new Set(SHIP_VOICE_LINES.map((line) => line.id));
    for (const key of Object.keys(manifest)) expect(ids.has(key)).toBe(true);
  });

  it("has no clip for an unknown line", () => {
    expect(getShipClip("escape/nope-1")).toBeUndefined();
  });
});
