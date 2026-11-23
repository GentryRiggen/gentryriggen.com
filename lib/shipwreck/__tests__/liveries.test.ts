import { liveryHelp, helpFor } from "../help";
import { SHIP_IDS, getShip } from "../ships";
import {
  defaultLivery,
  funLiveries,
  funnelPaintOf,
  nextLivery,
  realLiveries,
  resolveLivery,
} from "../ships/types";

describe("each ship's liveries (R28)", () => {
  it("lists her real paints as the research decided, then fun ones for every ship", () => {
    const ids = (id: (typeof SHIP_IDS)[number]) =>
      realLiveries(getShip(id)).map((l) => l.id);
    expect(ids("titanic")).toEqual(["white-star-1912"]);
    expect(ids("fitzgerald")).toEqual(["columbia-1975"]);
    expect(ids("lusitania")).toEqual(["war-1915", "cunard-1907"]);
    expect(ids("carpathia")).toEqual(["dazzle-1918", "cunard-1912"]);
    // Her own names for her two looks (the model's `BritannicPaint`).
    expect(ids("britannic")).toEqual(["hospital", "liner"]);
    expect(ids("concordia")).toEqual(["costa-2012"]);
    for (const id of SHIP_IDS) {
      const spec = getShip(id);
      const fun = funLiveries(spec);
      expect(fun.length).toBeGreaterThanOrEqual(5);
      // Real first, then fun: the tray's two rows.
      expect(spec.liveries!.map((l) => l.id)).toEqual([
        ...ids(id),
        ...fun.map((l) => l.id),
      ]);
      // A fun paint never copies one of hers (her funnels and hull both).
      for (const f of fun)
        for (const r of realLiveries(spec))
          expect([f.look.hull, f.look.funnel]).not.toEqual([
            r.look.hull,
            r.look.funnel,
          ]);
      // Over a livery she has, never another fun one.
      for (const f of fun)
        if (f.fun!.from) expect(ids(id)).toContain(f.fun!.from);
    }
  });

  it("keeps fun paints believable: no bright or neon colours", () => {
    // Saturation × value of an sRGB colour (0..1): real paint stays muted.
    const vivid = (c: number) => {
      const r = (c >> 16) & 255,
        g = (c >> 8) & 255,
        b = c & 255;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      return (max - min) / 255;
    };
    for (const id of SHIP_IDS)
      for (const f of funLiveries(getShip(id))) {
        const p = f.fun!.paint;
        for (const c of [p.topsides, p.bottom, p.funnel, p.funnelTop])
          expect(vivid(c)).toBeLessThan(0.65);
      }
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
      // "cunard-1912", a bare look's name (the Britannic's "liner"), or a
      // fun paint's ("fun-blue-funnel").
      expect(l.id).toMatch(l.fun ? /^fun(-[a-z]+)+$/ : /^[a-z-]+(-\d{4})?$/);
      expect(l.label.length).toBeGreaterThan(5);
      expect(l.sources.length).toBeGreaterThan(0);
      expect(l.swatches).toHaveLength(2);
      if (/-\d{4}$/.test(l.id)) expect(l.year).toBe(Number(l.id.slice(-4)));
      else if (l.fun) expect(l.year).toBeGreaterThan(1900);
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
    expect(funnelPaintOf(spec, "cunard-1912")?.funnel).toBe(0xcc5a28);
    expect(funnelPaintOf(spec, "fun-blue-funnel")?.funnel).toBe(0x4a7fb5);
    expect(resolveLivery(getShip("titanic"), "cunard-1912")).toBe(
      "white-star-1912"
    );
    expect(resolveLivery(getShip("titanic"), "fun-cunard")).toBe("fun-cunard");
  });
});

describe("the paint brush explains itself (help)", () => {
  it.each(SHIP_IDS)(
    "%s: words for every livery, and a controls line when she has a choice",
    (id) => {
      const spec = getShip(id);
      const controls = helpFor("controls", null, spec).lines.join(" ");
      expect(controls).toMatch(/paint brush/);
      for (const l of spec.liveries ?? []) {
        const h = liveryHelp(spec, l.id)!;
        expect(h.title).toBe(l.label);
        expect(h.lines[0]).not.toMatch(/as she was in/);
        if (l.fun) expect(h.lines[0]).toMatch(/Just for fun/);
        // Kind: no deaths in the words.
        expect(h.lines.join(" ")).not.toMatch(/die|died|dead|killed/i);
      }
    }
  );
});
