#!/usr/bin/env node
/**
 * Screenshots and draw counts for the Shipwreck night scene.
 *
 *   node scripts/shipwreck-scene-shots.mjs <baseURL> <outDir> [quality] [only]
 *
 * Needs a running dev server (`npx next dev --webpack`). Opens
 * `/shipwreck?scene&quality=<q>` (default high) at iPad landscape 1133x744
 * and portrait 744x1133, waits for the real night to be computed, then for
 * each shot seeks, sets the camera, X-ray and place, waits for the camera
 * to settle and saves `<outDir>/<id>-<land|port>.png`. Writes each shot's
 * draw calls and triangles (all passes) to `<outDir>/render-info.json`.
 * `only` is a comma list of shot ids.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [
  baseURL = "http://localhost:3000",
  outDir = ".screenshots/task-4",
  quality = "high",
  only = "",
] = process.argv.slice(2);

const H = (h, m, s = 0) => {
  // Clock time to seconds after 11:40 PM.
  const clock = h * 3600 + m * 60 + s;
  const start = 23 * 3600 + 40 * 60;
  return (clock - start + 86400) % 86400;
};

// Times that follow the sim's own events use `at` (resolved in the page).
const SHOTS = [
  { id: "1145-cinematic", t: H(23, 45), camera: "cinematic", wait: 2500 },
  {
    id: "1141-iceberg",
    t: 40,
    camera: "orbit",
    view: { target: [60, -40, 10], cam: [260, -260, 50] },
    wait: 2500,
  },
  {
    id: "0100-lifeboat",
    at: "rocket",
    index: 2,
    offset: 5,
    camera: "lifeboat",
    wait: 2500,
  },
  { id: "0000-steam", t: H(0, 0), camera: "cinematic", wait: 2500 },
  {
    id: "0130-xray",
    t: H(1, 30),
    camera: "orbit",
    xray: true,
    view: { target: [40, 0, 10], cam: [10, -170, 70] },
    wait: 2500,
  },
  { id: "0200-staircase", t: H(2, 0), place: "grand-staircase", wait: 4500 },
  { id: "0210-bow-under", t: H(2, 10), camera: "cinematic", wait: 2500 },
  { id: "breakup", at: "breakup", offset: 6, camera: "cinematic", wait: 2500 },
  {
    id: "plunge",
    at: "stern-under",
    offset: -40,
    camera: "lifeboat",
    wait: 2500,
  },
  {
    id: "descent",
    at: "stern-under",
    offset: 6,
    camera: "underwater",
    wait: 3000,
  },
  { id: "wreck", at: "end", offset: 0, camera: "underwater", wait: 3000 },
  {
    id: "breakup-xray",
    at: "breakup",
    offset: 20,
    camera: "cinematic",
    xray: true,
    wait: 2500,
  },
  { id: "0020-boiler-room-6", t: H(0, 20), place: "boiler-room-6", wait: 4500 },
  { id: "0130-engine-room", t: H(1, 30), place: "engine-room", wait: 4500 },
  { id: "0100-bridge", t: H(1, 0), place: "bridge", wait: 4500 },
  {
    id: "boat-deck-close",
    t: H(0, 30),
    camera: "orbit",
    view: { target: [30, -8, 30], cam: [12, -24, 36] },
    wait: 2500,
  },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const results = {};
const errors = [];
const pick = only ? only.split(",") : null;
try {
  for (const [orient, viewport] of [
    ["land", { width: 1133, height: 744 }],
    ["port", { width: 744, height: 1133 }],
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${baseURL}/shipwreck?scene&quality=${quality}`);
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
        const e = window.__shipwreck
          .getEvents()
          .find(
            (x) =>
              x.kind === s.at && (s.index === undefined || x.index === s.index)
          );
        return e ? e.t + (s.offset ?? 0) : st.computedT;
      }, shot);
      await page.evaluate(
        ({ shot, t }) => {
          const h = window.__shipwreck;
          h.setXray(Boolean(shot.xray));
          h.flyToPlace(null);
          h.seek(t);
          if (shot.place) h.flyToPlace(shot.place);
          else h.setCamera(shot.camera);
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
