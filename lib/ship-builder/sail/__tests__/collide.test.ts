import { hullHit } from "../collide";

const hull = { x: 0, z: 0, heading: 0, length: 20, beam: 6, vx: 0, vz: 0 };
const rock = (x: number, z: number, radius = 1) => ({
  x,
  z,
  radius,
  vx: 0,
  vz: 0,
});

describe("hullHit", () => {
  it("misses a clear obstacle", () => {
    expect(hullHit(hull, rock(20, 0))).toBeNull();
  });
  it("misses just outside the radius", () => {
    expect(hullHit(hull, rock(11.1, 0))).toBeNull();
    expect(hullHit(hull, rock(0, 4.1))).toBeNull();
  });
  it("hits the bow", () => {
    const hit = hullHit({ ...hull, vx: 4 }, rock(10.5, 0));
    expect(hit?.part).toBe("bow");
    expect(hit?.impactX).toBeCloseTo(0);
    expect(hit?.closingSpeed).toBeCloseTo(4);
  });
  it("hits the stern", () => {
    const hit = hullHit(hull, rock(-10.5, 0));
    expect(hit?.part).toBe("stern");
    expect(hit?.impactX).toBeCloseTo(20);
  });
  it("hits the side amidships", () => {
    const hit = hullHit(hull, rock(0, 3.5));
    expect(hit?.part).toBe("side");
    expect(hit?.impactX).toBeCloseTo(10);
  });
  it("places a forward side hit nearer the bow", () => {
    const hit = hullHit(hull, rock(6, -3.5));
    expect(hit?.part).toBe("side");
    expect(hit?.impactX).toBeCloseTo(4);
  });
  it("handles a turned ship", () => {
    // Heading +90° points the bow at +Z.
    const hit = hullHit({ ...hull, heading: Math.PI / 2 }, rock(0, 10.5));
    expect(hit?.part).toBe("bow");
    expect(hit?.impactX).toBeCloseTo(0);
  });
  it("sees a side hit on a turned ship", () => {
    // Heading +90°: starboard is -X, so a rock at -X is beside her.
    const hit = hullHit({ ...hull, heading: Math.PI / 2 }, rock(-3.5, 0));
    expect(hit?.part).toBe("side");
    expect(hit?.impactX).toBeCloseTo(10);
  });
  it("measures closing speed along the contact normal", () => {
    const hit = hullHit({ ...hull, vz: 5 }, rock(0, 3.5));
    expect(hit?.closingSpeed).toBeCloseTo(5);
  });
  it("counts an approaching obstacle's own speed", () => {
    const hit = hullHit(hull, { ...rock(10.5, 0), vx: -3 });
    expect(hit?.closingSpeed).toBeCloseTo(3);
  });
  it("reports no closing speed when moving apart", () => {
    const hit = hullHit({ ...hull, vx: -2 }, rock(10.5, 0));
    expect(hit?.closingSpeed).toBe(0);
  });
  it("still hits when the centre is inside the hull", () => {
    const hit = hullHit({ ...hull, vx: 2 }, rock(0, 0));
    expect(hit).not.toBeNull();
    expect(Number.isFinite(hit?.closingSpeed)).toBe(true);
  });
});
