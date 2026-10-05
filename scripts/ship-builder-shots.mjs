#!/usr/bin/env node
/**
 * Screenshots and draw-call counts for the Ship Builder detail budget.
 *
 *   node scripts/ship-builder-shots.mjs <baseURL> <outDir> [label]
 *
 * Needs a running dev server (`npx next dev`) at baseURL. For each look it
 * loads a template with a frozen clock and collapsed panels, saves
 * `<outDir>/<label>-<look>.png`, and prints the last frame's draw calls and
 * triangles (see scene/RenderInfoProbe.tsx). Uses software WebGL, like the
 * visual tests, so numbers are comparable run to run.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [baseURL = "http://localhost:3000", outDir = "shots", label = "now"] =
  process.argv.slice(2);

const LOOKS = [
  { id: "titanic-day", kind: "Ocean liner", name: "RMS Titanic", time: "Day" },
  {
    id: "titanic-night",
    kind: "Ocean liner",
    name: "RMS Titanic",
    time: "Night",
  },
  {
    id: "titanic-side",
    kind: "Ocean liner",
    name: "RMS Titanic",
    time: "Day",
    view: "Side",
  },
  // Close-ups: the camera can't get nearer, so these shoot at 3x pixel
  // density and crop to the middle of the ship (funnels, boats, bridge).
  {
    id: "titanic-close",
    kind: "Ocean liner",
    name: "RMS Titanic",
    time: "Day",
    crop: { x: 420, y: 300, width: 440, height: 260 },
  },
  {
    id: "titanic-close-night",
    kind: "Ocean liner",
    name: "RMS Titanic",
    time: "Night",
    crop: { x: 420, y: 300, width: 440, height: 260 },
  },
  {
    id: "titanic-bow",
    kind: "Ocean liner",
    name: "RMS Titanic",
    time: "Day",
    crop: { x: 760, y: 440, width: 300, height: 180 },
  },
  {
    id: "cruise-day",
    kind: "Cruise ship",
    name: "Wonder of the Seas",
    time: "Day",
  },
];

// Ambient occlusion is forced on so a slow software renderer cannot switch it
// off mid-run; set SHOTS_AO=0 to measure without it.
const ambientOcclusion = process.env.SHOTS_AO !== "0";

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const results = {};
try {
  for (const look of LOOKS) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: look.crop ? 3 : 1,
    });
    await page.addInitScript((ao) => {
      window.__SHIP_BUILDER_TEST__ = { freezeTime: 3, ao };
      window.localStorage.setItem(
        "ship-builder:ui:collapsed",
        JSON.stringify({ left: true, right: true })
      );
    }, ambientOcclusion);
    await page.goto(`${baseURL}/ship-builder`);
    await page.waitForFunction(() => Boolean(window.__shipBuilderStore), null, {
      timeout: 120_000,
    });
    await page.getByTestId("ship-canvas").locator("canvas").waitFor();
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New ship" });
    await dialog.getByRole("button", { name: new RegExp(look.kind) }).click();
    await dialog.getByRole("button", { name: new RegExp(look.name) }).click();
    await page.getByRole("button", { name: look.time, exact: true }).click();
    if (look.view) {
      await page.getByRole("button", { name: `${look.view} view` }).click();
    }
    // Let pop-ins, the camera glide and lazy effects settle.
    await page.waitForTimeout(4000);
    const info = await page.evaluate(() => window.__shipBuilderRenderInfo?.());
    results[look.id] = info ?? null;
    await page.screenshot({
      path: join(outDir, `${label}-${look.id}.png`),
      ...(look.crop ? { clip: look.crop } : {}),
    });
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(
  join(outDir, `${label}-render-info.json`),
  JSON.stringify(results, null, 2)
);
console.log(JSON.stringify(results, null, 2));
