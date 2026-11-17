import { trackGame } from "@/lib/analytics/trackGame";
import { isValidGameProps } from "@/lib/analytics/gameEvents";
import {
  trackEvents,
  trackHatch,
  trackPlayEnd,
  trackVisit,
} from "../analytics";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
const track = trackGame as jest.Mock;

beforeEach(() => track.mockClear());

describe("flamelings analytics", () => {
  it("reports a visit with its window and the number of pets", () => {
    trackVisit(3, new Date(2026, 10, 16, 8).getTime());
    expect(track).toHaveBeenCalledWith("fl_visit", {
      window: "morning",
      pets: 3,
    });
  });

  it("clamps numbers into the schema", () => {
    trackPlayEnd(500);
    trackVisit(40, new Date(2026, 10, 16, 23).getTime());
    expect(track).toHaveBeenCalledWith("fl_play_end", { score: 99 });
    expect(track).toHaveBeenCalledWith("fl_visit", {
      window: "night",
      pets: 8,
    });
  });

  it("reports a purchase as its kind and a price in tens", () => {
    trackEvents([
      { type: "buy", key: "hat:pirate", price: 90 },
      { type: "buy", key: "decor:tent", price: 280 },
      { type: "buy", key: "decor:mushroomHouse", price: 4000 },
      { type: "buy", key: "emote:love", price: 10 },
      { type: "sparks", amount: 3, source: "feed" },
    ]);
    expect(track.mock.calls).toEqual([
      ["fl_buy", { kind: "hat", price: 90 }],
      ["fl_buy", { kind: "decor", price: 280 }],
      ["fl_buy", { kind: "decor", price: 1000 }],
    ]);
    for (const [name, props] of track.mock.calls) {
      expect(isValidGameProps(name, props)).toBe(true);
    }
  });

  it("maps pet events and never sends names or text", () => {
    trackHatch();
    trackEvents([
      { type: "care", action: "feed" },
      { type: "levelUp", level: 4, stage: "flicker", unlocked: "food:coal" },
      { type: "unlock", key: "food:coal", via: "level" },
      { type: "state", to: "relit" },
      { type: "overfed" },
    ]);
    const calls = track.mock.calls;
    expect(calls.map((c) => c[0])).toEqual([
      "fl_hatch",
      "fl_care",
      "fl_level",
      "fl_unlock",
      "fl_state",
    ]);
    for (const [name, props] of calls) {
      expect(isValidGameProps(name, props)).toBe(true);
      expect(JSON.stringify(props)).not.toMatch(/Pip|name/i);
    }
  });
});
