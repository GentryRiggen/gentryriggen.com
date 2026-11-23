import { liveryHelp, helpFor } from "../help";
import { SHIP_IDS, getShip } from "../ships";
import {
  defaultLivery,
  funnelPaintOf,
  nextLivery,
  resolveLivery,
} from "../ships/types";

describe("each ship's liveries (R28)", () => {
  it("lists them as the research decided: two for the Lusitania, the Carpathia and the Britannic, none for the Titanic and the Fitzgerald", () => {
    const ids = (id: (typeof SHIP_IDS)[number]) =>
      getShip(id).liveries?.map((l) => l.id) ?? [];
    expect(ids("titanic")).toEqual([]);
    expect(ids("fitzgerald")).toEqual([]);
    expect(ids("lusitania")).toEqual(["war-1915", "cunard-1907"]);
    expect(ids("carpathia")).toEqual(["dazzle-1918", "cunard-1912"]);
    // Her own names for her two looks (the model's `BritannicPaint`).
    expect(ids("britannic")).toEqual(["hospital", "liner"]);
  });

  it.each(SHIP_IDS)("%s: one default, sources, swatches and a label", (id) => {
    const spec = getShip(id);
    const list = spec.liveries ?? [];
    if (list.length === 0) {
      expect(defaultLivery(spec)).toBeNull();
      expect(nextLivery(spec, null)).toBeNull();
      return;
    }
    expect(list.filter((l) => l.default)).toHaveLength(1);
    expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
    for (const l of list) {
      // "cunard-1912", or a bare look's name (the Britannic's "liner").
      expect(l.id).toMatch(/^[a-z]+(-\d{4})?$/);
      expect(l.label.length).toBeGreaterThan(5);
      expect(l.sources.length).toBeGreaterThan(0);
      expect(l.swatches).toHaveLength(2);
      if (/-\d{4}$/.test(l.id)) expect(l.year).toBe(Number(l.id.slice(-4)));
      else expect(l.year).toBeGreaterThan(1900);
    }
    // The default livery is the 1.x look (the model's spec.funnelPaint).
    expect(funnelPaintOf(spec, null)).toEqual(spec.funnelPaint);
  });

  it("resolves a missing or unknown id to her default and cycles", () => {
    const spec = getShip("carpathia");
    expect(resolveLivery(spec, null)).toBe("dazzle-1918");
    expect(resolveLivery(spec, "war-1915")).toBe("dazzle-1918");
    expect(resolveLivery(spec, "cunard-1912")).toBe("cunard-1912");
    expect(nextLivery(spec, null)?.id).toBe("cunard-1912");
    expect(nextLivery(spec, "cunard-1912")?.id).toBe("dazzle-1918");
    expect(funnelPaintOf(spec, "cunard-1912")?.funnel).toBe(0xcc5a28);
    expect(resolveLivery(getShip("titanic"), "cunard-1912")).toBeNull();
  });
});

describe("the paint brush explains itself (help)", () => {
  it.each(SHIP_IDS)(
    "%s: words for every livery, and a controls line when she has a choice",
    (id) => {
      const spec = getShip(id);
      const controls = helpFor("controls", null, spec).lines.join(" ");
      if (!spec.liveries) {
        expect(liveryHelp(spec, null)).toBeNull();
        expect(controls).not.toMatch(/paint brush/);
        return;
      }
      expect(controls).toMatch(/paint brush/);
      for (const l of spec.liveries) {
        const h = liveryHelp(spec, l.id)!;
        expect(h.title).toBe(l.label);
        expect(h.lines[0]).not.toMatch(/as she was in/);
        // Kind: no deaths in the words.
        expect(h.lines.join(" ")).not.toMatch(/die|died|dead|killed/i);
      }
    }
  );
});
