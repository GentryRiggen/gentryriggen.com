#!/usr/bin/env node
/**
 * Screenshots and draw counts for the Lusitania's afternoon scene.
 *
 *   node scripts/shipwreck-afternoon-shots.mjs <baseURL> <outDir> [quality] [only] [sizes]
 *
 * Needs a running server (dev or the e2e export). Opens
 * `/shipwreck?scene&ship=lusitania&quality=<q>` at 1133x744 and 744x1133
 * (`sizes`: land,port), waits for the afternoon to be computed, then for
 * each shot seeks, sets the camera (or a free view) and saves
 * `<outDir>/<id>-<land|port>.png` and `render-info-<q>.json`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [
  baseURL = "http://localhost:3000",
  outDir = ".screenshots/lusitania-task-6",
  quality = "high",
  only = "",
  sizes = "land,port",
] = process.argv.slice(2);

// Times are shown seconds after 2:10 PM, or after one of the sim's events.
const SHOTS = [
  // The torpedo's run-in (the pre-roll): 30, 15 and 3 s before the hit.
  { id: "1a-approach-30s", t: -30, camera: "cinematic", wait: 3500 },
  { id: "1b-approach-15s", t: -15, camera: "cinematic", wait: 3500 },
  { id: "1c-approach-3s", t: -3, camera: "cinematic", wait: 3500 },
  { id: "1-torpedo-track", t: 0.4, camera: "cinematic", wait: 3000 },
  { id: "2-hit", t: 1.6, camera: "cinematic", wait: 3000 },
  { id: "3-second-explosion", t: 11, camera: "cinematic", wait: 3000 },
  { id: "4-list-boats-0218", t: 480, camera: "cinematic", wait: 3000 },
  { id: "4b-port-boats", t: 600, camera: "cinematic", wait: 3000 },
  { id: "4c-list-wide", t: 120, camera: "cinematic", wait: 3000 },
  { id: "5-bow-down", t: 960, camera: "cinematic", wait: 3000 },
  {
    id: "6-stern-up-above",
    at: "bow-lands",
    offset: 10,
    camera: "cinematic",
    wait: 3000,
  },
  {
    id: "7-stern-up-below",
    at: "bow-lands",
    offset: 32,
    camera: "cinematic",
    wait: 3500,
  },
  { id: "8-wreck", at: "end", offset: 0, camera: "cinematic", wait: 3500 },
  {
    id: "9-underwater-cam",
    at: "end",
    offset: 0,
    camera: "underwater",
    wait: 3500,
  },
  { id: "10-lifeboat-cam", t: 900, camera: "lifeboat", wait: 3000 },
  { id: "11-bridge-cam", t: 300, camera: "bridge", wait: 3000 },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const results = {};
const errors = [];
const pick = only ? only.split(",") : null;
const all = [
  ["land", { width: 1133, height: 744 }],
  ["port", { width: 744, height: 1133 }],
].filter(([o]) => sizes.split(",").includes(o));
try {
  for (const [orient, viewport] of all) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(
      `${baseURL}/shipwreck?scene&ship=lusitania&quality=${quality}`
    );
    await page.waitForFunction(
      () => window.__shipwreck?.getState?.().done === true,
      null,
      { timeout: 400000 }
    );
    await page.evaluate(() => window.__shipwreck.pause());
    for (const shot of SHOTS) {
      if (pick && !pick.includes(shot.id)) continue;
      const t = await page.evaluate((s) => {
        const st = window.__shipwreck.getState();
        if (s.t !== undefined) return s.t;
        if (s.at === "end") return st.computedT;
        const e = window.__shipwreck.getEvents().find((x) => x.kind === s.at);
        return e ? e.t + (s.offset ?? 0) : st.computedT;
      }, shot);
      await page.evaluate(
        ({ shot, t }) => {
          const h = window.__shipwreck;
          h.setXray(Boolean(shot.xray));
          h.flyToPlace(null);
          h.seek(t);
          h.setCamera(shot.camera ?? "orbit");
          if (shot.view) h.flyToView(shot.view.target, shot.view.cam, true);
        },
        { shot, t }
      );
      await page.waitForTimeout(shot.wait);
      const file = join(outDir, `${shot.id}-${orient}.png`);
      await page.screenshot({ path: file });
      const info = await page.evaluate(() =>
        window.__shipwreck.getRenderInfo()
      );
      results[`${shot.id}-${orient}`] = { t, ...info };
      console.log(file, JSON.stringify(info));
    }
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(
  join(outDir, `render-info-${quality}.json`),
  JSON.stringify(results, null, 2)
);
if (errors.length) {
  console.error("errors:\n" + [...new Set(errors)].join("\n"));
}
