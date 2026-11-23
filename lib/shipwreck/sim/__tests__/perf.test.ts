import { RUNNER_BUDGET_MS } from "../../playback";
import { carpathia, fitzgerald, titanic } from "../../ships";
import { createSimRunner, simulate } from "../run";

/**
 * Budgets: a whole real night in under 2 s on a dev machine (the test allows
 * 3 s for a busy CI box and logs the real time), and no chunk of the UI's
 * incremental runner longer than 10 ms when asked for 8. The times gate only
 * with `SHIPWRECK_PERF=1` (run this file alone: under the full suite's
 * parallel workers, or on a shared CI box, they are noise); otherwise they
 * are logged and only the results are checked.
 */
const GATE = process.env.SHIPWRECK_PERF === "1";
describe("performance", () => {
  it("simulates the whole real night quickly", () => {
    simulate(titanic, titanic.realNight, { endT: 600 }); // warm up
    // The faster of two runs: a busy machine (the full suite in parallel)
    // can stall either one.
    let track: ReturnType<typeof simulate> | null = null;
    const times = [0, 1].map(() => {
      const t0 = performance.now();
      track = simulate(titanic, titanic.realNight);
      return performance.now() - t0;
    });
    const ms = Math.min(...times);
    // The work it timed is the real night: she breaks and goes down.
    expect(track!.outcome).not.toBe("floated");
    expect(track!.sankAtT).not.toBeNull();
    console.log(
      `Shipwreck real night simulated in ${ms.toFixed(0)} ms (runs: ${times
        .map((t) => t.toFixed(0))
        .join(", ")} ms)`
    );
    if (GATE) expect(ms).toBeLessThan(3000);
  });

  it("simulates the Fitzgerald's afternoon within 1.5× the night's budget", () => {
    // Her run is longer (about 3 h 45 min of storm at 1 s steps, the deck
    // openings sampling the waves four times a step): 1.5 × 3 s.
    simulate(fitzgerald, fitzgerald.realNight, { endT: 600 }); // warm up
    let track: ReturnType<typeof simulate> | null = null;
    const times = [0, 1].map(() => {
      const t0 = performance.now();
      track = simulate(fitzgerald, fitzgerald.realNight);
      return performance.now() - t0;
    });
    const ms = Math.min(...times);
    expect(track!.outcome).toBe("sank");
    expect(track!.brokeAtT).not.toBeNull();
    console.log(
      `Shipwreck Fitzgerald simulated in ${ms.toFixed(0)} ms (runs: ${times
        .map((t) => t.toFixed(0))
        .join(", ")} ms)`
    );
    if (GATE) expect(ms).toBeLessThan(1.5 * 3000);
  });

  it("simulates the Carpathia's morning within 1.5× the night's budget", () => {
    // About 1 h 45 min of shown time, most of it quiet at 1 s steps.
    simulate(carpathia, carpathia.realNight, { endT: 600 }); // warm up
    let track: ReturnType<typeof simulate> | null = null;
    const times = [0, 1].map(() => {
      const t0 = performance.now();
      track = simulate(carpathia, carpathia.realNight);
      return performance.now() - t0;
    });
    const ms = Math.min(...times);
    expect(track!.outcome).toBe("sank");
    console.log(
      `Shipwreck Carpathia simulated in ${ms.toFixed(0)} ms (runs: ${times
        .map((t) => t.toFixed(0))
        .join(", ")} ms)`
    );
    if (GATE) expect(ms).toBeLessThan(1.5 * 3000);
  });

  it("advance(8) stays within about 10 ms a call", () => {
    // The slowest call of a whole run, measured over two runs and the better
    // run kept: under the full suite another worker can stall any one call.
    const pass = () => {
      const runner = createSimRunner(titanic, titanic.realNight);
      let worst = 0;
      let calls = 0;
      while (!runner.done) {
        const t0 = performance.now();
        runner.advance(8);
        worst = Math.max(worst, performance.now() - t0);
        calls += 1;
      }
      expect(runner.progress()).toBe(1);
      return { worst, calls, track: runner.track() };
    };
    const runs = [pass(), pass()];
    const worst = Math.min(...runs.map((r) => r.worst));
    console.log(
      `Shipwreck advance(8): ${runs[0].calls} calls, slowest ${worst.toFixed(
        2
      )} ms (runs: ${runs.map((r) => r.worst.toFixed(2)).join(", ")} ms)`
    );
    if (GATE) expect(worst).toBeLessThanOrEqual(10);
    expect(runs[0].track).toEqual(simulate(titanic, titanic.realNight));
  });

  it("the Fitzgerald's runner keeps every call at the UI's budget under 8 ms", () => {
    // The game pumps her runner at RUNNER_BUDGET_MS a frame: no call may
    // block a frame (the 1.0 budget, 8 ms), storm sampling and all.
    const pass = () => {
      const runner = createSimRunner(fitzgerald, fitzgerald.realNight);
      let worst = 0;
      let calls = 0;
      while (!runner.done) {
        const t0 = performance.now();
        runner.advance(RUNNER_BUDGET_MS);
        worst = Math.max(worst, performance.now() - t0);
        calls += 1;
      }
      expect(runner.progress()).toBe(1);
      return { worst, calls, track: runner.track() };
    };
    const runs = [pass(), pass()];
    const worst = Math.min(...runs.map((r) => r.worst));
    console.log(
      `Shipwreck Fitzgerald advance(${RUNNER_BUDGET_MS}): ${runs[0].calls} calls, slowest ${worst.toFixed(
        2
      )} ms (runs: ${runs.map((r) => r.worst.toFixed(2)).join(", ")} ms)`
    );
    if (GATE) expect(worst).toBeLessThan(8);
    expect(runs[0].track.outcome).toBe("sank");
  });
});
