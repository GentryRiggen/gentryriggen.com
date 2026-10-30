import { STALL_WINDOW } from "@/lib/plane-builder/sim/constants";
import {
  didGhostPass,
  flightSoundFor,
  GHOST_PASS_RANGE,
  STALL_WARN_FROM,
  WIND_FULL_SPEED,
  type FlightSoundInputs,
} from "../flightCues";

const FLYING: FlightSoundInputs = {
  hasThrust: true,
  fuel: 5,
  phase: "flying",
  wantsBoost: false,
  canBoost: true,
  speed: 40,
  progressTimer: 0,
};

describe("flightSoundFor", () => {
  it("burns at half with an engine, full on boost, silent without fuel", () => {
    expect(flightSoundFor(FLYING).engine).toBe(0.5);
    const boost = flightSoundFor({ ...FLYING, wantsBoost: true });
    expect(boost.engine).toBe(1);
    expect(boost.boosting).toBe(true);
    expect(flightSoundFor({ ...FLYING, fuel: 0 }).engine).toBe(0);
    expect(flightSoundFor({ ...FLYING, hasThrust: false }).engine).toBe(0);
  });

  it("ignores boost when the day's twist has switched it off", () => {
    const sound = flightSoundFor({
      ...FLYING,
      wantsBoost: true,
      canBoost: false,
    });
    expect(sound.boosting).toBe(false);
    expect(sound.engine).toBe(0.5);
  });

  it("does not call a boost with no fuel a boost", () => {
    expect(
      flightSoundFor({ ...FLYING, fuel: 0, wantsBoost: true }).boosting
    ).toBe(false);
  });

  it("rushes the wind with speed, even with no engine", () => {
    const slow = flightSoundFor({ ...FLYING, hasThrust: false, speed: 10 });
    const fast = flightSoundFor({ ...FLYING, hasThrust: false, speed: 60 });
    expect(slow.speed).toBeGreaterThan(0);
    expect(fast.speed).toBeGreaterThan(slow.speed);
  });

  it("caps the wind at a fast flight and floors it at a crawl", () => {
    expect(
      flightSoundFor({ ...FLYING, speed: WIND_FULL_SPEED * 3 }).speed
    ).toBe(1);
    expect(flightSoundFor({ ...FLYING, speed: 0 }).speed).toBe(0);
  });

  it("is quiet once the plane is sliding or the flight is done", () => {
    for (const phase of ["sliding", "done"] as const) {
      const sound = flightSoundFor({ ...FLYING, phase, progressTimer: 2.5 });
      expect(sound).toEqual({
        engine: 0,
        speed: 0,
        boosting: false,
        stall: 0,
      });
    }
  });

  it("warns only as a stall closes in, and urgently at the end", () => {
    expect(flightSoundFor({ ...FLYING, progressTimer: 0.5 }).stall).toBe(0);
    expect(
      flightSoundFor({ ...FLYING, progressTimer: STALL_WARN_FROM }).stall
    ).toBe(0);
    const mid = flightSoundFor({
      ...FLYING,
      progressTimer: (STALL_WARN_FROM + STALL_WINDOW) / 2,
    }).stall;
    expect(mid).toBeCloseTo(0.5);
    expect(
      flightSoundFor({ ...FLYING, progressTimer: STALL_WINDOW }).stall
    ).toBe(1);
  });
});

describe("didGhostPass", () => {
  it("fires when the ghost swaps places with the player, nearby", () => {
    expect(didGhostPass(-3, 2, 4)).toBe(true);
    expect(didGhostPass(3, -2, 4)).toBe(true);
  });

  it("does not fire while one stays ahead", () => {
    expect(didGhostPass(5, 3, 4)).toBe(false);
    expect(didGhostPass(-5, -3, 4)).toBe(false);
  });

  it("does not fire when the planes are far apart across the course", () => {
    expect(didGhostPass(-1, 1, GHOST_PASS_RANGE + 1)).toBe(false);
  });
});
