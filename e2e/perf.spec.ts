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
};

/** Waits for the probe to report a drawn frame, then samples frame times. */
async function measure(
  page: Page,
  probe: "__shipBuilderRenderInfo" | "__planeBuilderRenderInfo"
): Promise<Measurement> {
  await page.waitForFunction(
    (name) => {
      const info = (window as unknown as RenderInfoWindow)[name]?.();
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
      const info = (window as unknown as RenderInfoWindow)[name]!();
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
    await page.getByRole("button", { name: "Sea trial" }).click();
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
