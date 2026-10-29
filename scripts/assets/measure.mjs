#!/usr/bin/env node
/**
 * Measures Ship Builder parts in the asset studio and writes their specs.
 *
 *   node scripts/assets/measure.mjs <part-id...> | --all  [--base url]
 *
 * For each part it loads the studio's old (procedural) build, drawn by the
 * game's real PartMesh, and reads the part's bounding box. Then:
 *  - a part whose bounds are hand-written (a `boundsFixed` spec, or a dynamic
 *    shape such as a wire or a spinning prop) is skipped and reported;
 *  - a part with a spec (its id, or a variant of another spec such as
 *    funnel-large) gets that variant's `expectedBounds` updated;
 *  - a part without one gets a skeleton assets/parts/<id>.json (see below).
 * assets/parts/index.ts is regenerated. Prints a summary table.
 *
 * Bounds are in the part's local frame: origin at the part's anchor (a
 * fitting's attach point; a grid block's footprint centre on its level's
 * floor), world axes (Y up, bow toward +X, starboard toward +Z), before any
 * transform the game applies outside the mesh code. A funnel's rake is
 * turned back out (the spec's `rakeRadians`). Animated sub-parts are read at
 * the studio's settle frame; a propeller's spin makes its Y/Z extent
 * approximate. Unlit glow meshes count in the bounds.
 *
 * `--refresh-skeletons` regenerates specs that still hold the generated todo
 * list untouched. Skeleton slots come from the `Surface` paints in the old mesh: one per
 * distinct colour and finish, named after the palette key when the colour is
 * one (else paint-<hex>). Names are guesses; the spec's `todo` says so.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { ensureDevServer } from "./devServer.mjs";
import {
  allPartTypes,
  readSpecs,
  resolvePart,
  ROOT,
  specPath,
} from "./parts.mjs";
import {
  boundsLocked,
  GENERATED_TODO,
  HAND_BOUNDS,
  skeleton,
} from "./measureRules.mjs";
import { prettify, writeSpecIndex } from "./specIndex.mjs";

const READY_TIMEOUT_MS = 90_000;

const argv = process.argv.slice(2);
let base;
let all = false;
let refreshSkeletons = false;
const ids = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--base") base = argv[++i];
  else if (argv[i] === "--all") all = true;
  else if (argv[i] === "--refresh-skeletons") refreshSkeletons = true;
  else if (argv[i].startsWith("--")) {
    console.error(`unknown flag ${argv[i]}`);
    process.exit(1);
  } else ids.push(argv[i]);
}
if (!all && ids.length === 0) {
  console.error("usage: measure.mjs <part-id...> | --all [--base url]");
  process.exit(1);
}
const targets = all ? allPartTypes() : ids;

const r4 = (v) => Math.round(v * 1e4) / 1e4;

async function measureOne(browser, url, id) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  try {
    await page.goto(`${url}/asset-studio?part=${id}&build=old`, {
      timeout: READY_TIMEOUT_MS,
    });
    await page.waitForFunction(
      () =>
        document.body.dataset.studioReady === "1" ||
        document.body.dataset.studioError,
      null,
      { timeout: READY_TIMEOUT_MS }
    );
    return await page.evaluate(() => {
      const d = document.body.dataset;
      if (d.studioError) return { error: d.studioError };
      return {
        bounds: JSON.parse(d.studioBounds),
        slots: JSON.parse(d.studioSlots),
        rake: Number(d.studioRake ?? 0),
      };
    });
  } catch (err) {
    return { error: `${err.message.split("\n")[0]} ${consoleErrors[0] ?? ""}` };
  } finally {
    await page.close();
  }
}

function extent(b) {
  return b.max.map((v, i) => r4(v - b.min[i])).join(" x ");
}

async function main() {
  const specs = readSpecs();
  const server = await ensureDevServer(ROOT, { base });
  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const rows = [];
  const touched = new Set();
  try {
    for (const id of targets) {
      const found = resolvePart(id, specs);
      const m = await measureOne(browser, server.url, id);
      if (m.error) {
        rows.push({ id, status: `FAILED: ${m.error}`, extent: "", slots: "" });
        console.log(`${id}: FAILED ${m.error}`);
        continue;
      }
      if (found) {
        const file = specPath(found.specId);
        const spec = JSON.parse(readFileSync(file, "utf8"));
        const variant = spec.variants.find((v) => v.name === found.variant);
        const extentOf = extent(m.bounds);
        if (refreshSkeletons && spec.todo?.[0] === GENERATED_TODO) {
          const fresh = skeleton(id, m);
          if (spec.boundsFixed) fresh.boundsFixed = true;
          if (boundsLocked(id, spec) && !HAND_BOUNDS[id]) {
            fresh.variants = spec.variants;
          }
          writeFileSync(file, JSON.stringify(fresh, null, 2));
          touched.add(file);
          rows.push({
            id,
            status: "skeleton refreshed",
            extent: extentOf,
            slots: `${fresh.slots.length} derived`,
          });
        } else if (boundsLocked(id, spec)) {
          // Measured bounds are not the part's own (wires, spin, props):
          // the spec's hand-written box stays.
          rows.push({
            id,
            status: `skipped: bounds are hand-written (${spec.boundsFixed ? "boundsFixed" : "dynamic shape"}); measured ${extentOf}`,
            extent: extent(variant.expectedBounds),
            slots: `${spec.slots.length} (spec)`,
          });
        } else {
          const before = variant.expectedBounds;
          const drift = Math.max(
            ...m.bounds.min.map((v, i) => Math.abs(v - before.min[i])),
            ...m.bounds.max.map((v, i) => Math.abs(v - before.max[i]))
          );
          const rakeMoved = Math.abs(m.rake - (spec.rakeRadians ?? 0)) > 1e-9;
          if (drift > 0 || rakeMoved) {
            variant.expectedBounds = m.bounds;
            spec.rakeRadians = m.rake;
            writeFileSync(file, JSON.stringify(spec, null, 2));
            touched.add(file);
          }
          rows.push({
            id,
            status:
              drift > 0 || rakeMoved
                ? `updated ${found.specId}/${found.variant} (moved ${r4(drift)}${rakeMoved ? ", rake set" : ""})`
                : `unchanged ${found.specId}/${found.variant}`,
            extent: extentOf,
            slots: `${spec.slots.length} (spec)`,
          });
        }
      } else {
        const spec = skeleton(id, m);
        writeFileSync(specPath(id), JSON.stringify(spec, null, 2));
        touched.add(specPath(id));
        specs[id] = spec;
        const painted = spec.slots.length;
        rows.push({
          id,
          status: painted ? "new skeleton" : "new skeleton (slots TODO)",
          extent: extent(spec.variants[0].expectedBounds),
          slots: painted ? `${painted} derived` : "TODO",
        });
      }
      console.log(`${id}: ${rows.at(-1).status}`);
    }
  } finally {
    await browser.close();
    server.stop();
  }
  prettify(ROOT, ...touched);
  writeSpecIndex(ROOT);
  console.log(
    "\n| part | extent (x y z) | slots | result |\n|---|---|---|---|"
  );
  for (const r of rows) {
    console.log(`| ${r.id} | ${r.extent} | ${r.slots} | ${r.status} |`);
  }
  return rows.some((r) => r.status.startsWith("FAILED")) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
