import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import type { Progress } from "@/lib/plane-builder/economy/progress";
import { MAX_TIER } from "@/lib/plane-builder/plane/catalog";

/**
 * Performance budget. Each fixed scene is rendered in software WebGL and its
 * draw calls and triangles (shadow passes included) are compared with
 * `e2e/perf-budget.json`; more than 5% over budget fails. Both counts are
 * deterministic, so they gate. Frame times on SwiftShader are noisy, so the
 * median and p95 of requestAnimationFrame deltas are only reported.
 *
 * After an intended change, run `PERF_UPDATE=1 npx playwright test
 * e2e/perf.spec.ts --project=chromium` to rewrite the budget from the measured
 * numbers. Each run writes `perf-results.json` (a CI artifact) and prints a
 * table of every scene.
 */

/** How far over budget a count may go before the run fails. */
const TOLERANCE = 0.05;
/** Frames whose requestAnimationFrame gaps make up the frame-time sample. */
const FRAME_SAMPLE = 20;
const BUDGET_PATH = path.join(__dirname, "perf-budget.json");
const RESULTS_DIR = path.join(__dirname, "..", "test-results", "perf");
const RESULTS_PATH = path.join(__dirname, "..", "perf-results.json");
const UPDATE = Boolean(process.env.PERF_UPDATE);
const FROZEN_SECONDS = 3;
/** Sim seconds into an iceberg trial that catch the Titanic mid-sinking. */
const SINKING_SECONDS = 4.5;
const HOLD_FLIGHT_SECONDS = 1.5;

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(150_000);

test.use({
  viewport: { width: 1024, height: 768 },
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  },
});

interface Counts {
  calls: number;
  triangles: number;
}

interface Measurement extends Counts {
  /** Reported only: SwiftShader frame times are too noisy to gate on. */
  frameMedianMs: number;
  frameP95Ms: number;
}

type Budget = Record<string, Counts>;

function readBudget(): Budget {
  return JSON.parse(fs.readFileSync(BUDGET_PATH, "utf8")) as Budget;
}

type RenderInfoWindow = {
  __shipBuilderRenderInfo?: () => Counts;
  __planeBuilderRenderInfo?: () => Counts;
  __planetSmasherRenderInfo?: () => Counts;
  /** Shipwreck's is the last frame's numbers, not a function. */
  __shipwreckRenderInfo?: Counts;
};

type Probe = keyof RenderInfoWindow;

/** Waits for the probe to report a drawn frame, then samples frame times. */
async function measure(page: Page, probe: Probe): Promise<Measurement> {
  await page.waitForFunction(
    (name) => {
      const v = (window as unknown as RenderInfoWindow)[name];
      const info = typeof v === "function" ? v() : v;
      return Boolean(info && info.calls > 0);
    },
    probe,
    { timeout: 60_000 }
  );
  return page.evaluate(
    async ({ name, frames }) => {
      const times: number[] = [];
      let previous = await new Promise<number>((r) => requestAnimationFrame(r));
      for (let i = 0; i < frames; i++) {
        const now = await new Promise<number>((r) => requestAnimationFrame(r));
        times.push(now - previous);
        previous = now;
      }
      times.sort((a, b) => a - b);
      const at = (q: number) =>
        times[Math.min(times.length - 1, Math.floor(q * times.length))];
      const v = (window as unknown as RenderInfoWindow)[name]!;
      const info = typeof v === "function" ? v() : v;
      return {
        calls: info.calls,
        triangles: info.triangles,
        frameMedianMs: Math.round(at(0.5) * 10) / 10,
        frameP95Ms: Math.round(at(0.95) * 10) / 10,
      };
    },
    { name: probe, frames: FRAME_SAMPLE }
  );
}

/** Records a scene's numbers for the report and fails it if over budget. */
function record(scene: string, measured: Measurement) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RESULTS_DIR, `${scene}.json`),
    JSON.stringify(measured)
  );
  if (UPDATE) return;
  const budget = readBudget()[scene];
  expect(
    budget,
    `no budget for "${scene}"; run with PERF_UPDATE=1`
  ).toBeTruthy();
  expect(
    measured.calls,
    `${scene}: draw calls over budget (${budget.calls})`
  ).toBeLessThanOrEqual(Math.floor(budget.calls * (1 + TOLERANCE)));
  expect(
    measured.triangles,
    `${scene}: triangles over budget (${budget.triangles})`
  ).toBeLessThanOrEqual(Math.floor(budget.triangles * (1 + TOLERANCE)));
}

const SCENES = [
  "ship-titanic-build",
  "ship-titanic-sailing",
  "ship-titanic-iceberg-sinking",
  "ship-cruise-build",
  "plane-hangar",
  "plane-meadow-flight",
  "plane-jungle-flight",
  "plane-city-flight",
  "planet-earth-idle",
  "planet-earth-shatter",
  "shipwreck-1145pm-cinematic",
  "shipwreck-breakup-cinematic",
  "shipwreck-xray-staircase",
  "shipwreck-underwater",
  "shipwreck-walk-boat-deck",
  "shipwreck-walk-look-under",
  "shipwreck-walk-staircase",
  "shipwreck-walk-scotland-road",
  "shipwreck-lusitania-hit",
  "shipwreck-lusitania-list",
  "shipwreck-lusitania-grounded",
  "shipwreck-lusitania-wreck",
  "shipwreck-fitzgerald-storm",
  "shipwreck-fitzgerald-dive",
  "shipwreck-fitzgerald-wreck",
  "shipwreck-carpathia-hit",
  "shipwreck-carpathia-settled",
  "shipwreck-carpathia-wreck",
  "shipwreck-britannic-blast",
  "shipwreck-britannic-boats",
  "shipwreck-britannic-grounded",
  "shipwreck-concordia-salute",
  "shipwreck-concordia-drift",
  "shipwreck-concordia-aground",
  "shipwreck-poseidon-party",
  "shipwreck-poseidon-wave",
  "shipwreck-poseidon-keelup",
] as const;

test.afterAll(() => {
  const results: Record<string, Measurement> = {};
  for (const scene of SCENES) {
    const file = path.join(RESULTS_DIR, `${scene}.json`);
    if (fs.existsSync(file)) {
      results[scene] = JSON.parse(fs.readFileSync(file, "utf8"));
    }
  }
  if (Object.keys(results).length === 0) return;
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(results, null, 2)}\n`);
  const rows = Object.entries(results).map(
    ([scene, m]) =>
      `${scene.padEnd(30)}${String(m.calls).padStart(8)}${String(
        m.triangles
      ).padStart(12)}${String(m.frameMedianMs).padStart(12)}${String(
        m.frameP95Ms
      ).padStart(10)}`
  );
  console.log(
    [
      `${"scene".padEnd(30)}${"calls".padStart(8)}${"triangles".padStart(12)}${"median ms".padStart(12)}${"p95 ms".padStart(10)}`,
      ...rows,
    ].join("\n")
  );
  if (UPDATE) {
    const next: Budget = {};
    for (const [scene, m] of Object.entries(results)) {
      next[scene] = { calls: m.calls, triangles: m.triangles };
    }
    fs.writeFileSync(
      BUDGET_PATH,
      `${JSON.stringify({ ...(fs.existsSync(BUDGET_PATH) ? readBudget() : {}), ...next }, null, 2)}\n`
    );
  }
});

// ── Ship Builder ──

async function openShip(
  page: Page,
  config: {
    time?: "Day" | "Night";
    template: [string, string];
    trialSeconds?: number;
  }
) {
  await page.addInitScript(
    ({ freezeTime, trialSeconds }) => {
      window.__SHIP_BUILDER_TEST__ = {
        freezeTime,
        trialSeconds,
        ao: true,
        driveObstacles: [
          { kind: "iceberg", x: 90, z: -30, radius: 8 },
          { kind: "rock", x: 70, z: 25, radius: 5 },
          { kind: "buoy", x: 55, z: -10, radius: 2 },
          { kind: "ship", x: 120, z: 10, radius: 12 },
        ],
      };
      window.localStorage.setItem(
        "ship-builder:ui:collapsed",
        JSON.stringify({ left: true, right: true })
      );
    },
    { freezeTime: FROZEN_SECONDS, trialSeconds: config.trialSeconds }
  );
  await page.goto("/ship-builder");
  await expect(page.getByRole("heading", { name: "Ship Builder" })).toBeVisible(
    { timeout: 60_000 }
  );
  await expect(page.getByTestId("ship-canvas").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New ship" });
  await dialog
    .getByRole("button", { name: new RegExp(config.template[0]) })
    .click();
  await dialog
    .getByRole("button", { name: new RegExp(config.template[1]) })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: config.time ?? "Day", exact: true })
    .click();
  await page.getByRole("button", { name: "Calm sea" }).click();
  await modelsLoaded(page);
  await batchSettled(page);
}

/**
 * Waits for the ship's static batch to be built: it follows the last model
 * load by a quiet period, so the draw calls fall and then hold still.
 */
async function batchSettled(page: Page) {
  let previous = -1;
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(900);
        const calls = await page.evaluate(
          () => window.__shipBuilderRenderInfo?.().calls ?? -1
        );
        const steady = calls > 0 && calls === previous;
        previous = calls;
        return steady;
      },
      { timeout: 60_000 }
    )
    .toBe(true);
}

/** Waits until no glb is still drawing its stand-in. */
async function modelsLoaded(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          const status = window.__shipBuilderModels?.();
          return status
            ? { pending: status.pending, failed: status.failed }
            : null;
        }),
      { timeout: 60_000 }
    )
    .toEqual({ pending: 0, failed: 0 });
}

const TITANIC: [string, string] = ["Ocean liner", "RMS Titanic"];

test.describe("Ship Builder budget", () => {
  test("Titanic in build view", async ({ page }) => {
    await openShip(page, { template: TITANIC });
    const measured = await measure(page, "__shipBuilderRenderInfo");
    // A hard ceiling, apart from the budget: it fails if the static batch
    // silently stops merging (the ship was about 1,700 calls unbatched).
    expect(
      measured.calls,
      "Titanic build view should stay batched"
    ).toBeLessThan(400);
    record("ship-titanic-build", measured);
  });

  test("Titanic sailing, chase camera", async ({ page }) => {
    await openShip(page, { template: TITANIC });
    await page.getByRole("button", { name: "Drive" }).click();
    const picker = page.getByRole("dialog", { name: "Set sail" });
    await picker.getByRole("button", { name: "Set sail" }).click();
    await expect(picker).toHaveCount(0);
    await page
      .getByRole("group", { name: "Camera view" })
      .getByRole("button", { name: "Chase" })
      .click();
    await modelsLoaded(page);
    await batchSettled(page);
    record(
      "ship-titanic-sailing",
      await measure(page, "__shipBuilderRenderInfo")
    );
  });

  test("Titanic mid-sinking in the iceberg trial", async ({ page }) => {
    await openShip(page, {
      time: "Night",
      template: TITANIC,
      trialSeconds: SINKING_SECONDS,
    });
    await page.getByRole("button", { name: "Boom!" }).click();
    await page.getByRole("menuitem", { name: "Iceberg" }).click();
    await expect(page.getByText("Tap where the iceberg hits")).toBeVisible();
    const box = await page.getByTestId("ship-canvas").boundingBox();
    if (!box) throw new Error("no canvas box");
    // The camera glides to the side view first, so keep tapping until it takes.
    await expect(async () => {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.58);
      const status = await page.evaluate(
        () => window.__shipBuilderStore!.getState().trial.status
      );
      expect(status).toBe("running");
    }).toPass({ timeout: 30_000 });
    await modelsLoaded(page);
    await batchSettled(page);
    record(
      "ship-titanic-iceberg-sinking",
      await measure(page, "__shipBuilderRenderInfo")
    );
  });

  test("cruise ship in build view", async ({ page }) => {
    await openShip(page, { template: ["Cruise ship", "Wonder of the Seas"] });
    record("ship-cruise-build", await measure(page, "__shipBuilderRenderInfo"));
  });
});

// ── Plane Builder ──

async function openPlane(page: Page, holdFlightSeconds?: number) {
  if (holdFlightSeconds !== undefined) {
    await page.addInitScript((seconds) => {
      window.__PLANE_BUILDER_TEST__ = { holdFlightSeconds: seconds };
    }, holdFlightSeconds);
  }
  await page.goto("/plane-builder");
  await expect(
    page.getByRole("heading", { name: "Plane Builder" })
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__planeBuilderStore));
}

/** Unlocks every world and maxes the plane there, so the scene is the fullest. */
async function seedMaxed(page: Page, tier: number) {
  await page.evaluate((maxTier) => {
    const store = window.__planeBuilderStore!.getState();
    const progress: Progress = store.progress;
    const levels = Object.fromEntries(
      Object.entries(progress.levels).map(([id, level]) => [
        id,
        {
          ...level,
          tiers: Object.fromEntries(
            Object.keys(level.tiers).map((track) => [track, maxTier])
          ),
        },
      ])
    ) as Progress["levels"];
    store.hydrate({
      ...progress,
      levels,
      unlocked: Object.keys(levels) as Progress["unlocked"],
    });
  }, tier);
}

async function planeModelsLoaded(page: Page) {
  await page.waitForFunction(() => {
    const status = window.__shipBuilderModels?.();
    return !status || status.pending === 0;
  });
}

test.describe("Plane Builder budget", () => {
  // Stops the hangar turntable, so the hangar frame is the same every run.
  test.use({ reducedMotion: "reduce" });

  test("hangar with a maxed plane", async ({ page }) => {
    await openPlane(page);
    await seedMaxed(page, MAX_TIER);
    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await expect(page.getByRole("region", { name: "Hangar" })).toBeVisible();
    // The turntable's models mount a beat after the screen does.
    await page.waitForTimeout(3000);
    await planeModelsLoaded(page);
    record("plane-hangar", await measure(page, "__planeBuilderRenderInfo"));
  });

  for (const [scene, level] of [
    ["plane-meadow-flight", "meadow"],
    ["plane-jungle-flight", "jungle"],
    ["plane-city-flight", "city"],
  ] as const) {
    test(`${level} mid-flight`, async ({ page }) => {
      await openPlane(page, HOLD_FLIGHT_SECONDS);
      await seedMaxed(page, 2);
      await page.evaluate((id) => {
        const store = window.__planeBuilderStore!.getState();
        store.openLevel(id);
        store.beginFlight({ pitch: 0.35, yaw: 0, power: 0.9 });
      }, level);
      await expect(
        page.getByRole("progressbar", { name: "Fuel" })
      ).toBeVisible();
      // The chase camera eases toward the held plane; give it time to settle.
      await page.waitForTimeout(4000);
      await planeModelsLoaded(page);
      record(scene, await measure(page, "__planeBuilderRenderInfo"));
    });
  }
});

// ── Planet Smasher ──

async function openPlanet(page: Page) {
  await page.goto("/planet-smasher");
  await expect(page.getByTestId("planet-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForFunction(() => Boolean(window.__planetSmasher), null, {
    timeout: 60_000,
  });
}

test.describe("Planet Smasher budget", () => {
  // Stops the auto-rotate and the fades, so the frame is the same every run.
  test.use({ reducedMotion: "reduce" });

  test("earth at rest", async ({ page }) => {
    await openPlanet(page);
    await page.waitForTimeout(3000);
    record(
      "planet-earth-idle",
      await measure(page, "__planetSmasherRenderInfo")
    );
  });

  test("earth shattering", async ({ page }) => {
    await openPlanet(page);
    await page.evaluate(() => window.__planetSmasher!.forceEnding("shatter"));
    await page.waitForTimeout(1200);
    record(
      "planet-earth-shatter",
      await measure(page, "__planetSmasherRenderInfo")
    );
  });
});

// ── Shipwreck ──

test.describe("Shipwreck budget", () => {
  // The whole night is computed first (software WebGL runs slowly).
  test.setTimeout(420_000);

  test("the night at the top tier: 11:45 PM, the breakup, X-ray, under water, walking", async ({
    page,
  }) => {
    // The night scene alone at the high tier (frame-rate monitor off).
    await page.goto("/shipwreck?scene&quality=high");
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 300_000 }
    );
    const at = async (setup: () => void, settleMs = 2500) => {
      await page.evaluate(setup);
      await page.waitForTimeout(settleMs);
      return measure(page, "__shipwreckRenderInfo");
    };

    record(
      "shipwreck-1145pm-cinematic",
      await at(() => {
        const h = window.__shipwreck!;
        h.pause!();
        h.seek!(5 * 60); // 11:45 PM
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-breakup-cinematic",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "breakup")!;
        h.seek!(e.t + 2);
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-xray-staircase",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(3 * 3600 - 25 * 60); // 2:15 AM (2 h 35 min after 11:40 PM)
        h.setXray!(true);
        h.flyToPlace!("grand-staircase");
      }, 3500)
    );
    record(
      "shipwreck-underwater",
      await at(() => {
        const h = window.__shipwreck!;
        h.flyToPlace!(null);
        h.setXray!(false);
        const e = h.getEvents!().find((x) => x.kind === "stern-under")!;
        h.seek!(e.t + 90);
        h.setCamera!("underwater");
      })
    );
    record(
      "shipwreck-walk-boat-deck",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(2 * 3600 - 10 * 60); // 1:30 AM (1 h 50 min after 11:40 PM)
        h.startWalk!();
        h.turnWalk!(Math.PI); // look aft
      })
    );
    // Inside (1.15): the Grand Staircase's top foyer under its dome, and
    // Scotland Road, both at 1:30 AM.
    record(
      "shipwreck-walk-staircase",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(2 * 3600 - 10 * 60);
        h.startWalk!();
        h.placeWalk!("gs-boat", 34, 4, 0);
      })
    );
    record(
      "shipwreck-walk-scotland-road",
      await at(() => {
        const h = window.__shipwreck!;
        h.placeWalk!("scotland-road", 20, 4.3, 0);
      })
    );
    // In the water 10 s before her stern goes under, looking under: she is
    // in view, going down. (After it the way down is shown 6x faster: 20 s
    // later she is 1.6 km down and out of sight.)
    await page.evaluate(() => {
      const h = window.__shipwreck!;
      const e = h.getEvents!().find((x) => x.kind === "stern-under")!;
      h.seek!(e.t - 10);
    });
    await page.waitForFunction(
      () => window.__shipwreck?.getWalk?.()?.phase === "water",
      null,
      { timeout: 20_000 }
    );
    record(
      "shipwreck-walk-look-under",
      await at(() => window.__shipwreck!.setLookUnder!(true))
    );
    // The spec's ceiling at the top tier, apart from the budget.
    for (const scene of SCENES.filter(
      (s) =>
        s.startsWith("shipwreck-") &&
        !s.startsWith("shipwreck-lusitania") &&
        !s.startsWith("shipwreck-fitzgerald") &&
        !s.startsWith("shipwreck-carpathia") &&
        !s.startsWith("shipwreck-britannic") &&
        !s.startsWith("shipwreck-concordia") &&
        !s.startsWith("shipwreck-poseidon")
    )) {
      const m = JSON.parse(
        fs.readFileSync(path.join(RESULTS_DIR, `${scene}.json`), "utf8")
      ) as Measurement;
      expect(m.calls, `${scene}: draw calls`).toBeLessThanOrEqual(160);
      expect(m.triangles, `${scene}: triangles`).toBeLessThanOrEqual(450_000);
    }
  });
});

test.describe("Shipwreck budget: the Lusitania", () => {
  test.setTimeout(420_000);

  test("her afternoon at the top tier: the hit, the list, the bow on the floor, the wreck", async ({
    page,
  }) => {
    await page.goto("/shipwreck?scene&ship=lusitania&quality=high");
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 300_000 }
    );
    const at = async (setup: () => void, settleMs = 2500) => {
      await page.evaluate(setup);
      await page.waitForTimeout(settleMs);
      return measure(page, "__shipwreckRenderInfo");
    };
    record(
      "shipwreck-lusitania-hit",
      await at(() => {
        const h = window.__shipwreck!;
        h.pause!();
        h.seek!(2); // the column of water at 2:10 PM
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-lusitania-list",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(10 * 60); // 2:20 PM: the list, the boats
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-lusitania-grounded",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "bow-lands")!;
        h.seek!(e.t + 10); // the bow on the floor, the stern in the air
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-lusitania-wreck",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "stern-under")!;
        h.seek!(e.t + 90); // on her starboard side, 93 m down
        h.setCamera!("underwater");
      })
    );
    for (const scene of SCENES.filter((s) =>
      s.startsWith("shipwreck-lusitania")
    )) {
      const m = JSON.parse(
        fs.readFileSync(path.join(RESULTS_DIR, `${scene}.json`), "utf8")
      ) as Measurement;
      expect(m.calls, `${scene}: draw calls`).toBeLessThanOrEqual(160);
      expect(m.triangles, `${scene}: triangles`).toBeLessThanOrEqual(450_000);
    }
  });
});

test.describe("Shipwreck budget: the Fitzgerald", () => {
  test.setTimeout(420_000);

  test("her storm at the top tier: 5:30 PM on deck, the dive, the wreck", async ({
    page,
  }) => {
    await page.goto("/shipwreck?scene&ship=fitzgerald&quality=high");
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 300_000 }
    );
    const at = async (setup: () => void, settleMs = 2500) => {
      await page.evaluate(setup);
      await page.waitForTimeout(settleMs);
      return measure(page, "__shipwreckRenderInfo");
    };
    record(
      "shipwreck-fitzgerald-storm",
      await at(() => {
        const h = window.__shipwreck!;
        h.pause!();
        h.seek!(2 * 3600); // 5:30 PM: night, on her deck in the storm
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-fitzgerald-dive",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "bow-under")!;
        h.seek!(e.t + 20); // about 7:13 PM: her bow going down
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-fitzgerald-wreck",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "stern-lands")!;
        h.seek!(e.t + 30); // both parts on the floor, 162 m down
        h.setCamera!("underwater");
      })
    );
    for (const scene of SCENES.filter((s) =>
      s.startsWith("shipwreck-fitzgerald")
    )) {
      const m = JSON.parse(
        fs.readFileSync(path.join(RESULTS_DIR, `${scene}.json`), "utf8")
      ) as Measurement;
      expect(m.calls, `${scene}: draw calls`).toBeLessThanOrEqual(160);
      expect(m.triangles, `${scene}: triangles`).toBeLessThanOrEqual(450_000);
    }
  });
});

test.describe("Shipwreck budget: the Carpathia", () => {
  test.setTimeout(420_000);

  test("her morning at the top tier: the first hit, 10:00 AM settled, the wreck", async ({
    page,
  }) => {
    await page.goto("/shipwreck?scene&ship=carpathia&quality=high");
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 300_000 }
    );
    const at = async (setup: () => void, settleMs = 2500) => {
      await page.evaluate(setup);
      await page.waitForTimeout(settleMs);
      return measure(page, "__shipwreckRenderInfo");
    };
    record(
      "shipwreck-carpathia-hit",
      await at(() => {
        const h = window.__shipwreck!;
        h.pause!();
        h.seek!(2); // the first column of water at 9:15 AM
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-carpathia-settled",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(45 * 60); // 10:00 AM: settled by the head, her boats away
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-carpathia-wreck",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "stern-lands")!;
        h.seek!(e.t + 30); // upright on the floor, 150 m down
        h.setCamera!("underwater");
      })
    );
    for (const scene of SCENES.filter((s) =>
      s.startsWith("shipwreck-carpathia")
    )) {
      const m = JSON.parse(
        fs.readFileSync(path.join(RESULTS_DIR, `${scene}.json`), "utf8")
      ) as Measurement;
      expect(m.calls, `${scene}: draw calls`).toBeLessThanOrEqual(160);
      expect(m.triangles, `${scene}: triangles`).toBeLessThanOrEqual(450_000);
    }
  });
});

test.describe("Shipwreck budget: the Britannic", () => {
  test.setTimeout(420_000);

  test("her morning at the top tier: the mine, 8:40 with her boats out, the bow on the floor", async ({
    page,
  }) => {
    // Her hospital paint (the default livery).
    await page.goto("/shipwreck?scene&ship=britannic&quality=high");
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 300_000 }
    );
    const at = async (setup: () => void, settleMs = 2500) => {
      await page.evaluate(setup);
      await page.waitForTimeout(settleMs);
      return measure(page, "__shipwreckRenderInfo");
    };
    record(
      "shipwreck-britannic-blast",
      await at(() => {
        const h = window.__shipwreck!;
        h.pause!();
        h.seek!(2); // the mine's column at 8:12 AM
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-britannic-boats",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(28 * 60); // 8:40 AM: down by the head, her boats away
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-britannic-grounded",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "bow-lands")!;
        h.seek!(e.t + 10); // the bow on the floor, the stern in the air
        h.setCamera!("cinematic");
      })
    );
    for (const scene of SCENES.filter((s) =>
      s.startsWith("shipwreck-britannic")
    )) {
      const m = JSON.parse(
        fs.readFileSync(path.join(RESULTS_DIR, `${scene}.json`), "utf8")
      ) as Measurement;
      expect(m.calls, `${scene}: draw calls`).toBeLessThanOrEqual(160);
      expect(m.triangles, `${scene}: triangles`).toBeLessThanOrEqual(450_000);
    }
  });
});

test.describe("Shipwreck budget: the Costa Concordia", () => {
  test.setTimeout(420_000);

  test("her night by Giglio at the top tier: lit past the island, the drift, on her side", async ({
    page,
  }) => {
    await page.goto("/shipwreck?scene&ship=concordia&quality=high");
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 300_000 }
    );
    const at = async (setup: () => void, settleMs = 2500) => {
      await page.evaluate(setup);
      await page.waitForTimeout(settleMs);
      return measure(page, "__shipwreckRenderInfo");
    };
    record(
      "shipwreck-concordia-salute",
      await at(() => {
        const h = window.__shipwreck!;
        h.pause!();
        h.seek!(-20); // lit from end to end, passing the island
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-concordia-drift",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(2900); // 22:33: the blackout, listing about 10°, the harbour behind
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-concordia-aground",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "floating-steady")!;
        h.seek!(e.t + 5); // on her side at 65°, Giglio Porto's lights
        h.setCamera!("cinematic");
      })
    );
    for (const scene of SCENES.filter((s) =>
      s.startsWith("shipwreck-concordia")
    )) {
      const m = JSON.parse(
        fs.readFileSync(path.join(RESULTS_DIR, `${scene}.json`), "utf8")
      ) as Measurement;
      expect(m.calls, `${scene}: draw calls`).toBeLessThanOrEqual(160);
      expect(m.triangles, `${scene}: triangles`).toBeLessThanOrEqual(450_000);
    }
  });
});

test.describe("Shipwreck budget: the Poseidon", () => {
  test.setTimeout(420_000);

  test("her wave night at the top tier: lit on the swell, the hit and the roll, keel up", async ({
    page,
  }) => {
    await page.goto("/shipwreck?scene&ship=poseidon&quality=high");
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 300_000 }
    );
    const at = async (setup: () => void, settleMs = 2500) => {
      await page.evaluate(setup);
      await page.waitForTimeout(settleMs);
      return measure(page, "__shipwreckRenderInfo");
    };
    record(
      "shipwreck-poseidon-party",
      await at(() => {
        const h = window.__shipwreck!;
        h.pause!();
        h.seek!(-35); // lit end to end on the swell, the wave rising behind
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-poseidon-wave",
      await at(() => {
        const h = window.__shipwreck!;
        h.seek!(2); // the crest at her, the spray sheet, the roll starting
        h.setCamera!("cinematic");
      })
    );
    record(
      "shipwreck-poseidon-keelup",
      await at(() => {
        const h = window.__shipwreck!;
        const e = h.getEvents!().find((x) => x.kind === "capsized")!;
        h.seek!(e.t + 30); // keel up, propellers in the air, air bubbling
        h.setCamera!("cinematic");
      })
    );
    for (const scene of SCENES.filter((s) =>
      s.startsWith("shipwreck-poseidon")
    )) {
      const m = JSON.parse(
        fs.readFileSync(path.join(RESULTS_DIR, `${scene}.json`), "utf8")
      ) as Measurement;
      expect(m.calls, `${scene}: draw calls`).toBeLessThanOrEqual(160);
      expect(m.triangles, `${scene}: triangles`).toBeLessThanOrEqual(450_000);
    }
  });
});
