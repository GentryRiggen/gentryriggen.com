import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { lightBots } from "../bots";
import {
  FORKS,
  chosenSide,
  forkActionId,
  forkPreview,
  isForkShown,
  type ForkDef,
} from "../forks";
import { hasFork, windRamp } from "../forkState";
import { sceneInfo } from "..";
import {
  autoFlashRate,
  calmSkyIncomePerSecond,
  driftPerSecond,
  fadeRate,
  lastTapResolve,
  powerPerSecond,
  resolvePerSecond,
  shipsPerFlash,
  strainPerSecond,
  supplyMW,
  tankCapacity,
} from "../tick";
import { lightSceneDiff } from "../hooks";
import { TUNING } from "../tuning";

jest.setTimeout(120_000);

const K = TUNING.fork;

/** A run in the fork's part, with the milestone met and a purse to pay with. */
function runAt(fork: ForkDef): RunState {
  const base = newRun(def);
  const owned: Record<string, number> = {
    coast: { keeper: 3, lens: 1, lighthouse: 3 },
    night: { gen1: 5, gen2: 3 },
    sky: { collector: 6, probe: 1, "copy-1": 1 },
    last: {
      "letgo-porch": 1,
      "letgo-signs": 1,
      "letgo-stadium": 1,
      "letgo-bridges": 1,
      "letgo-harbor": 1,
    },
  }[fork.id];
  return reconcileRun(def, {
    ...base,
    phase: fork.phase,
    owned,
    resources: {
      ...base.resources,
      [fork.currency]: 1e8,
      ships: 500,
      night: 80,
      probes: 20,
      collectors: 6,
    },
  });
}

const forkNamed = (id: string): ForkDef =>
  FORKS.find((f) => f.id === id) as ForkDef;

describe("the forks in the road", () => {
  it("has one in every part, with two distinct sides", () => {
    expect(FORKS.map((f) => f.phase)).toEqual([0, 1, 2, 3]);
    for (const fork of FORKS) {
      expect(fork.sides[0].id).not.toBe(fork.sides[1].id);
      for (const side of fork.sides) {
        expect(side.wry.length).toBeGreaterThan(20);
        expect(side.catches.length).toBeGreaterThan(10);
        expect(side.price).toBeGreaterThan(0);
      }
    }
  });

  it("opens at a milestone, not at the start of the part", () => {
    for (const fork of FORKS) {
      const fresh = reconcileRun(def, { ...newRun(def), phase: fork.phase });
      expect(fork.isOpen(fresh)).toBe(false);
      expect(isForkShown(fresh)).toBe(false);
      expect(fork.isOpen(runAt(fork))).toBe(true);
    }
  });

  it.each(FORKS.map((f) => [f.id, f] as const))(
    "%s: buying one side pays for it and locks the other for the run",
    (_id, fork) => {
      const [a, b] = fork.sides;
      const run = runAt(fork);
      expect(canPerformAction(def, run, forkActionId(a.id))).toBe(true);
      expect(canPerformAction(def, run, forkActionId(b.id))).toBe(true);
      const after = performAction(def, run, forkActionId(a.id));
      expect(hasFork(after, a.id)).toBe(true);
      expect(hasFork(after, b.id)).toBe(false);
      expect(chosenSide(after, fork)?.id).toBe(a.id);
      expect(after.resources[fork.currency]).toBeLessThan(
        run.resources[fork.currency]
      );
      expect(canPerformAction(def, after, forkActionId(b.id))).toBe(false);
      expect(canPerformAction(def, after, forkActionId(a.id))).toBe(false);
      // The other side stays closed however rich the player gets.
      const rich = {
        ...after,
        resources: { ...after.resources, [fork.currency]: 1e9 },
      };
      expect(performAction(def, rich, forkActionId(b.id))).toBe(rich);
    }
  );

  it.each(FORKS.map((f) => [f.id, f] as const))(
    "%s: each side changes the picture",
    (_id, fork) => {
      const run = runAt(fork);
      const before = sceneInfo(run);
      const keys = ["forkCoast", "forkNight", "forkSky", "forkLast"] as const;
      const key = keys[fork.phase];
      expect(before[key]).toBe(0);
      const seen = new Set<number>();
      for (const side of fork.sides) {
        const after = performAction(def, run, forkActionId(side.id));
        const info = sceneInfo(after);
        seen.add(info[key]);
        expect(lightSceneDiff(run, after)).toBe(true);
      }
      expect(seen).toEqual(new Set([1, 2]));
    }
  );

  it("coast: the Fresnel lens helps your own taps, the keepers only theirs", () => {
    const fork = forkNamed("coast");
    const run = runAt(fork);
    const lens = performAction(def, run, forkActionId("fresnel"));
    const crews = performAction(def, run, forkActionId("crews"));
    expect(shipsPerFlash(lens)).toBeCloseTo(
      shipsPerFlash(run) * K.coast.fresnelFlash
    );
    expect(autoFlashRate(lens)).toBeCloseTo(
      autoFlashRate(run) * K.coast.fresnelFlash
    );
    expect(shipsPerFlash(crews)).toBe(shipsPerFlash(run));
    expect(autoFlashRate(crews)).toBeCloseTo(
      autoFlashRate(run) * K.coast.crewsFlash
    );
    expect(tankCapacity(crews)).toBeGreaterThan(0);
  });

  it("night: coal pays at once and strains the grid; wind grows in and eases it", () => {
    const fork = forkNamed("night");
    const run = runAt(fork);
    const coal = performAction(def, run, forkActionId("coal"));
    expect(powerPerSecond(coal)).toBeGreaterThan(powerPerSecond(run) * 1.4);
    // More supply also works the grid harder, so at least this much more.
    expect(strainPerSecond(coal)).toBeGreaterThanOrEqual(
      strainPerSecond(run) * K.night.coalStrain - 1e-9
    );
    let wind = performAction(def, run, forkActionId("wind"));
    // Nothing at first: it takes a while to build.
    expect(windRamp(wind)).toBe(0);
    expect(powerPerSecond(wind)).toBeCloseTo(powerPerSecond(run), 5);
    for (let i = 0; i < K.night.windRampSeconds / 2; i += 1)
      wind = tick(def, wind, 1);
    expect(windRamp(wind)).toBeCloseTo(0.5, 1);
    const half = powerPerSecond(wind);
    for (let i = 0; i < K.night.windRampSeconds; i += 1)
      wind = tick(def, wind, 1);
    expect(windRamp(wind)).toBe(1);
    expect(powerPerSecond(wind)).toBeGreaterThan(half);
    expect(supplyMW(wind)).toBeGreaterThan(supplyMW(coal));
    expect(strainPerSecond(wind)).toBeLessThan(strainPerSecond(run));
    expect(sceneInfo(wind).windBuilt).toBe(1);
    expect(K.costs.wind).toBeGreaterThan(K.costs.coal * 2);
  });

  it("sky: a swarm triples the fleet and drifts; mirrors pay more and steady it", () => {
    const fork = forkNamed("sky");
    const run = runAt(fork);
    const swarm = performAction(def, run, forkActionId("swarm"));
    expect(swarm.resources.probes).toBeCloseTo(
      run.resources.probes * K.sky.swarmProbes
    );
    expect(driftPerSecond(swarm)).toBeGreaterThan(driftPerSecond(run));
    const mirrors = performAction(def, run, forkActionId("mirrors"));
    expect(driftPerSecond(mirrors)).toBeLessThan(driftPerSecond(run));
    expect(calmSkyIncomePerSecond(mirrors)).toBeGreaterThan(
      calmSkyIncomePerSecond(run) * 1.5
    );
    expect(calmSkyIncomePerSecond(swarm)).toBeGreaterThan(
      calmSkyIncomePerSecond(run)
    );
  });

  it("last: letting go is faster but colder; keeping holds the flame and rewards taps", () => {
    const fork = forkNamed("last");
    const run = runAt(fork);
    const letGo = performAction(def, run, forkActionId("release"));
    const keep = performAction(def, run, forkActionId("keep"));
    expect(resolvePerSecond(letGo)).toBeCloseTo(
      resolvePerSecond(run) * K.last.releaseResolve
    );
    expect(fadeRate(letGo)).toBeGreaterThan(fadeRate(run));
    expect(fadeRate(keep)).toBeLessThan(fadeRate(run) * 0.5);
    expect(lastTapResolve(keep)).toBeCloseTo(
      lastTapResolve(run) * K.last.keepTaps
    );
    expect(resolvePerSecond(keep)).toBeCloseTo(resolvePerSecond(run), 5);
  });

  it("shows each side's numbers before buying, and they move a lot", () => {
    for (const fork of FORKS) {
      const run = runAt(fork);
      for (const side of fork.sides) {
        const preview = forkPreview(run, fork, side.id);
        expect(preview).toContain("→");
        expect(preview.length).toBeGreaterThan(10);
      }
    }
  });

  it("states its numbers from the tuning so the words can't drift", () => {
    const text = (id: string) =>
      forkNamed(id).sides.map((s) => `${s.gives} ${s.catches}`);
    expect(text("coast")[0]).toContain(`${K.coast.fresnelFlash}×`);
    expect(text("coast")[1]).toContain(`${K.coast.crewsFlash}×`);
    expect(text("night")[0]).toContain(`${K.night.coalSupply}×`);
    expect(text("night")[1]).toContain(`${K.night.windSupply}×`);
    expect(text("sky")[0]).toContain(`${K.sky.swarmProbes}×`);
    expect(text("sky")[1]).toContain(`${K.sky.mirrorsEnergy}×`);
    expect(text("last")[0]).toContain(`${K.last.releaseResolve}×`);
    expect(text("last")[1]).toContain(`${K.last.keepTaps}×`);
  });

  it("reads an old save with no fork chosen as undecided, and plays on", () => {
    for (const fork of FORKS) {
      const old = runAt(fork);
      delete old.resources.forkWindAt;
      for (const side of fork.sides) delete old.flags[`fork-${side.id}`];
      const loaded = reconcileRun(def, old);
      expect(chosenSide(loaded, fork)).toBeNull();
      expect(isForkShown(loaded)).toBe(true);
      expect(
        Number.isFinite(tick(def, loaded, 1).resources[fork.currency])
      ).toBe(true);
    }
  });

  it("is chosen by the bots in every part of a whole run", () => {
    const r = simulate(def, {
      maxSeconds: 5 * 3600,
      step: 1,
      strategy: lightBots().tapper,
    });
    expect(r.finished).toBe(true);
    const picked = r.actionsDone.filter((a) => a.id.startsWith("fork-"));
    expect(picked).toHaveLength(4);
    for (const fork of FORKS)
      expect(chosenSide(r.finalRun, fork)).not.toBeNull();
  });
});
