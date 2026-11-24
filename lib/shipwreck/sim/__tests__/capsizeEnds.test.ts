import type { ShipSpec } from "../../ships/types";
import { simulate, whatIfOpenings, whatIfSpots } from "../run";
import type { SimTrack } from "../track";
import { groupPassed, rogueGroup, waveStartT, type WaveVariant } from "../wave";
import { keelUpShip, waveShip } from "./testShips";

const DEG = Math.PI / 180;
const RIDE_OUT = { afterS: 300, maxListDeg: 10 };
const END_S = 900;

function run(spec: ShipSpec, variant: WaveVariant, endT?: number): SimTrack {
  return simulate(spec, whatIfOpenings(spec, whatIfSpots(spec), variant), {
    wave: variant,
    ...(endT === undefined ? {} : { endT }),
  });
}

function kinds(track: SimTrack): string[] {
  return track.events.map((e) => e.kind);
}

/** The wave's time as the run locked it (shown s). */
function waveT(track: SimTrack): number {
  const groups = track.storm?.groups ?? [];
  const g = rogueGroup(track.storm) ?? groups[groups.length - 1];
  return waveStartT(g);
}

describe("rideOut (a rule)", () => {
  const spec = waveShip({ extra: { rideOut: RIDE_OUT, endS: END_S } });

  it.each(["smaller", "ahead"] as const)(
    "ends a whole floating run that never capsized: %s",
    (variant) => {
      const track = run(spec, variant);
      expect(track.outcome).toBe("floated");
      const sheltered = track.events.filter((e) => e.kind === "sheltered");
      expect(sheltered).toHaveLength(1);
      const at = waveT(track) + RIDE_OUT.afterS;
      expect(sheltered[0].t).toBeGreaterThanOrEqual(at);
      expect(sheltered[0].t).toBeLessThan(at + 1.01);
      expect(track.endT).toBeCloseTo(sheltered[0].t, 9);
      const last = track.frames[track.frames.length - 1].bodies[0];
      expect(Math.abs(last.roll)).toBeLessThanOrEqual(
        RIDE_OUT.maxListDeg * DEG
      );
      expect(kinds(track)).not.toContain("capsized");
    }
  );

  it("waits while she is listed past maxListDeg", () => {
    // Her list over 0° is never within 0°: no ride-out, she runs to endS.
    const strict = waveShip({
      extra: { rideOut: { afterS: 300, maxListDeg: 0 }, endS: END_S },
    });
    const track = run(strict, "smaller");
    expect(kinds(track)).not.toContain("sheltered");
    expect(track.endT).toBeGreaterThanOrEqual(END_S);
  });

  it("never ends a capsized run, even one physics rights", () => {
    // The tower ship's sealed deckhouse rights her after the real wave
    // (physics), but she capsized: no ride-out; she runs to endS upright.
    const track = run(spec, "real");
    expect(kinds(track)).toContain("capsized");
    expect(kinds(track)).not.toContain("sheltered");
    expect(track.endT).toBeGreaterThanOrEqual(END_S);
    expect(track.endT).toBeLessThan(END_S + 1);
    const last = track.frames[track.frames.length - 1].bodies[0];
    expect(Math.cos(last.roll)).toBeGreaterThan(0);
    expect(track.outcome).toBe("floated");
  });

  it("is off without the field", () => {
    const plain = waveShip({ extra: { endS: END_S } });
    const track = run(plain, "smaller");
    expect(kinds(track)).not.toContain("sheltered");
    expect(track.outcome).toBe("floated");
  });
});

describe("endS (a rule)", () => {
  it("ends a body afloat keel up `capsized` at endS", () => {
    const spec = keelUpShip(0, { extra: { endS: 600 } });
    const track = run(spec, "real");
    expect(kinds(track)).toContain("capsized");
    expect(track.outcome).toBe("capsized");
    expect(track.endT).toBeGreaterThanOrEqual(600);
    expect(track.endT).toBeLessThan(600.2);
    const last = track.frames[track.frames.length - 1];
    expect(Math.abs(last.bodies[0].roll / DEG - 180)).toBeLessThan(5);
    for (const f of track.frames)
      for (const b of f.bodies)
        for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
          expect(Number.isFinite(v)).toBe(true);
  });

  it("without endS a keel-up ship ends `floated` at the run's end", () => {
    const track = run(keelUpShip(), "real", 600);
    expect(track.outcome).toBe("floated");
  });
});

describe("the steady test in her storm", () => {
  it("runs once her rogue wave has passed, with the pose box", () => {
    const spec = waveShip();
    const track = run(spec, "smaller", 1500);
    const steady = track.events.filter((e) => e.kind === "floating-steady");
    expect(steady).toHaveLength(1);
    const g = rogueGroup(track.storm) as NonNullable<
      ReturnType<typeof rogueGroup>
    >;
    expect(groupPassed(g, steady[0].realT)).toBe(true);
    // Not held back to 1800 s or by her storm (the 1.0 gate).
    expect(steady[0].t).toBeLessThan(1800);
    // Held from there to the run's end.
    const after = track.frames.filter((f) => f.t > steady[0].t + 1);
    const first = after[0].bodies[0];
    for (const f of after) expect(f.bodies[0]).toEqual(first);
  });

  it("waits for the group: never while it is still on her", () => {
    const spec = waveShip();
    const track = run(spec, "ahead", 1500);
    const steady = track.events.find((e) => e.kind === "floating-steady");
    const groups = track.storm?.groups ?? [];
    const g = groups[groups.length - 1];
    expect(steady).toBeDefined();
    expect(groupPassed(g, (steady as { realT: number }).realT)).toBe(true);
  });
});
