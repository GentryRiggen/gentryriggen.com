#!/usr/bin/env node
/**
 * Screenshots and draw-call counts for the Shipwreck model.
 *
 *   node scripts/shipwreck-model-shots.mjs <baseURL> <outDir> [ship]
 *
 * Needs a running dev server (`npx next dev --webpack`) at baseURL. Opens
 * the model viewer (`/shipwreck?model`, `&ship=<id>` when given) at
 * 1133x744, sets each view with
 * `window.__shipwreck.setModelView`, saves `<outDir>/<id>.png` and writes
 * the last frame's draw calls and triangles to `<outDir>/render-info.json`.
 * Software WebGL, like the other shot scripts, so numbers compare run to run.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [
  baseURL = "http://localhost:3000",
  outDir = ".screenshots/task-3",
  ship = "titanic",
] = process.argv.slice(2);

// Where each ship's sim breaks her (the Fitzgerald near hatch No. 9).
const BREAK_X = { lusitania: 4, fitzgerald: 18 }[ship] ?? -27.1;
const SHOTS = [
  { id: "bow-day", view: { camera: "bow" } },
  { id: "stern-day", view: { camera: "stern" } },
  { id: "side-day", view: { camera: "side" } },
  { id: "top-day", view: { camera: "top" } },
  { id: "bridge-day", view: { camera: "bridge" } },
  { id: "boat-deck-day", view: { camera: "boat-deck" } },
  { id: "bow-close-day", view: { camera: "bow-close" } },
  { id: "stern-close-day", view: { camera: "stern-close" } },
  { id: "astern-day", view: { camera: "astern" } },
  { id: "broken-day", view: { camera: "break", breakX: BREAK_X } },
  {
    id: "broken-close-day",
    view: { camera: "break-close", breakX: BREAK_X },
  },
  { id: "night-power-1", view: { camera: "bow", stage: "night", power: 1 } },
  { id: "night-power-0", view: { camera: "bow", stage: "night", power: 0 } },
  { id: "side-medium", view: { camera: "side", quality: "medium" } },
  { id: "side-low", view: { camera: "side", quality: "low" } },
];
const BASE = {
  breakX: null,
  power: 0,
  flicker: 0,
  quality: "high",
  camera: "bow",
  stage: "day",
};

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const results = {};
try {
  const page = await browser.newPage({
    viewport: { width: 1133, height: 744 },
  });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error("console", m.text());
  });
  await page.goto(
    `${baseURL}/shipwreck?model${ship === "titanic" ? "" : `&ship=${ship}`}`
  );
  // The dev build's corner badge is not part of the model.
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.waitForFunction(
    () => window.__shipwreck?.getModelInfo?.()?.ready === true,
    null,
    { timeout: 180_000 }
  );
  for (const shot of SHOTS) {
    const only = process.env.SHOTS_ONLY;
    if (only && !only.split(",").includes(shot.id)) continue;
    await page.evaluate((v) => window.__shipwreck.setModelView(v), {
      ...BASE,
      ...shot.view,
    });
    await page.waitForFunction(
      () => window.__shipwreck?.getModelInfo?.()?.ready === true,
      null,
      { timeout: 120_000 }
    );
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => window.__shipwreck.getModelInfo());
    results[shot.id] = info;
    await page.screenshot({ path: join(outDir, `${shot.id}.png`) });
    console.log(shot.id, JSON.stringify(info));
  }
} finally {
  await browser.close();
}
writeFileSync(
  join(outDir, "render-info.json"),
  JSON.stringify(results, null, 2)
);
