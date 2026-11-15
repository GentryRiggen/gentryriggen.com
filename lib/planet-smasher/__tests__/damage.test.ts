import {
  ENDING_BONUS,
  PLANET_TOUGHNESS,
  applyHit,
  createPlanetState,
  pointsFor,
} from "../damage";
import type { PlanetState } from "../damage";
import { POP_H, POP_W, gridFromLuminance } from "../population";
import type { EndingKind, ToolId } from "../tools";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);
const fresh = () => createPlanetState("earth", grid);

function runUntilEnd(tool: ToolId) {
  const s = fresh();
  let ending: EndingKind | null = null;
  let lost = 0;
  let last = null as ReturnType<typeof applyHit> | null;
  for (let i = 0; i < 5000 && !ending; i++) {
    last = applyHit(s, tool, (i * 0.137) % 1, 0.2 + ((i * 0.071) % 0.6));
    lost += last.peopleLost;
    ending = last.ending;
  }
  return { s, ending, lost, last: last! };
}

describe("damage", () => {
  it("scores 1% of the start population as 5 points", () => {
    expect(pointsFor(80_000_000, 8_000_000_000)).toBe(5);
  });

  it("an asteroid costs 4 health (over the toughness) and some people", () => {
    const s: PlanetState = fresh();
    const r = applyHit(s, "asteroid", 0.5, 0.5);
    expect(s.health).toBeCloseTo(100 - 4 / PLANET_TOUGHNESS);
    expect(r.healthLost).toBeCloseTo(4 / PLANET_TOUGHNESS);
    expect(s.population).toBeLessThan(s.startPopulation);
    expect(r.peopleLost).toBeGreaterThan(0);
    expect(r.points).toBeGreaterThanOrEqual(0);
  });

  it("wrecked ground takes less health", () => {
    const s = fresh();
    const first = applyHit(s, "asteroid", 0.5, 0.5).healthLost;
    let tenth = first;
    for (let i = 1; i < 10; i++)
      tenth = applyHit(s, "asteroid", 0.5, 0.5).healthLost;
    expect(tenth).toBeLessThan(first);
  });

  it("asteroids shatter the planet", () => {
    const { s, ending, last } = runUntilEnd("asteroid");
    expect(ending).toBe("shatter");
    expect(s.population).toBe(0);
    expect(s.health).toBe(0);
    expect(last.points).toBeGreaterThanOrEqual(ENDING_BONUS);
  });

  it("nukes melt it and freeze rays freeze it", () => {
    expect(runUntilEnd("nuke").ending).toBe("molten");
    expect(runUntilEnd("freezeRay").ending).toBe("frozen");
  });

  it("finishers end a fresh planet", () => {
    const a = fresh();
    expect(applyHit(a, "moonRam", 0.5, 0.5).ending).toBe("shatter");
    const b = fresh();
    expect(applyHit(b, "blackHole", 0.5, 0.5).ending).toBe("swallowed");
  });

  it("ignores hits after the ending", () => {
    const s = fresh();
    applyHit(s, "blackHole", 0.5, 0.5);
    expect(applyHit(s, "asteroid", 0.5, 0.5)).toEqual({
      peopleLost: 0,
      healthLost: 0,
      points: 0,
      rawPoints: 0,
      ending: null,
    });
  });

  it("people lost over a run equals the start population", () => {
    const { s, lost } = runUntilEnd("megaBomb");
    expect(Math.abs(lost - s.startPopulation)).toBeLessThanOrEqual(1);
  });
});
