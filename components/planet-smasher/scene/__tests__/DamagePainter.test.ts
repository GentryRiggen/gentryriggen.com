import { DamagePainter, stampEllipses } from "../DamagePainter";

function mockContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: jest.fn() };
  const target: Record<string, unknown> = {
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  };
  return new Proxy(target, {
    get(t, key: string) {
      if (!(key in t)) t[key] = jest.fn();
      return t[key];
    },
    set(t, key: string, value) {
      t[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe("stampEllipses", () => {
  it("copies a stamp across the seam", () => {
    const e = stampEllipses(0.999, 0.5, 0.1, 2048, 1024);
    expect(e).toHaveLength(2);
    expect(e.some((x) => x.cx > 2000)).toBe(true);
    expect(e.some((x) => x.cx < 50)).toBe(true);
  });
  it("does not copy a stamp in the middle", () => {
    expect(stampEllipses(0.5, 0.5, 0.1, 2048, 1024)).toHaveLength(1);
  });
  it("caps the stretch near the poles", () => {
    const [e] = stampEllipses(0.5, 0.98, 0.1, 2048, 1024);
    expect(e.rx).toBeLessThanOrEqual(((0.1 / (2 * Math.PI)) * 2048) / 0.15 + 1);
  });
  it("sizes the height by the angular radius", () => {
    const [e] = stampEllipses(0.5, 0.5, 0.1, 2048, 1024);
    expect(e.ry).toBeCloseTo((0.1 / Math.PI) * 1024, 5);
  });
});

describe("DamagePainter", () => {
  beforeEach(() => {
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => mockContext() as unknown as RenderingContext);
  });
  afterEach(() => jest.restoreAllMocks());

  it("has the documented canvas sizes", () => {
    const p = new DamagePainter(null);
    expect([p.damage.width, p.damage.height]).toEqual([2048, 1024]);
    expect([p.glow.width, p.glow.height]).toEqual([1024, 512]);
    expect([p.lights.width, p.lights.height]).toEqual([2048, 1024]);
    expect([p.height.width, p.height.height]).toEqual([512, 256]);
  });

  it("bumps the version for every kind of stamp", () => {
    const p = new DamagePainter(null);
    const kinds = [
      "crater",
      "scorch",
      "lava",
      "crack",
      "ice",
      "trench",
    ] as const;
    kinds.forEach((k, i) => {
      p.stamp(k, 0.3, 0.6, 0.1);
      expect(p.version).toBe(i + 1);
    });
  });

  it("bumps the version on reset", () => {
    const p = new DamagePainter(null);
    const before = p.version;
    p.reset(null);
    expect(p.version).toBeGreaterThan(before);
  });
});
