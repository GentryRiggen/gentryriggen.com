import { MAX_LIVE_PARTICLES, ParticleSystem } from "../particles";

const spec = (life: number) => ({
  x: 1,
  y: 0,
  z: 0,
  life,
  size: 0.1,
  color: [1, 1, 1] as const,
});

describe("ParticleSystem budget", () => {
  it("never holds more live particles than its capacity", () => {
    const sys = new ParticleSystem(MAX_LIVE_PARTICLES);
    for (let i = 0; i < MAX_LIVE_PARTICLES * 3; i++) sys.emit(spec(5));
    expect(sys.liveCount).toBe(MAX_LIVE_PARTICLES);
    sys.dispose();
  });

  it("frees slots as particles die and counts only the live ones", () => {
    const sys = new ParticleSystem(100);
    for (let i = 0; i < 40; i++) sys.emit(spec(0.5));
    for (let i = 0; i < 10; i++) sys.emit(spec(3));
    expect(sys.liveCount).toBe(50);
    sys.update(1, 800);
    expect(sys.liveCount).toBe(10);
    sys.update(3, 800);
    expect(sys.liveCount).toBe(0);
    sys.dispose();
  });

  it("only draws the used range", () => {
    const sys = new ParticleSystem(100);
    for (let i = 0; i < 5; i++) sys.emit(spec(1));
    sys.update(0.1, 800);
    expect(sys.points.geometry.drawRange.count).toBe(5);
    sys.dispose();
  });
});
