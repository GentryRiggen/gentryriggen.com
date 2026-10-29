#!/usr/bin/env node
/**
 * Measures Ship Builder parts in the asset studio and writes their specs.
 *
 *   node scripts/assets/measure.mjs <part-id...> | --all  [--base url]
 *
 * For each part it loads the studio's old (procedural) build, drawn by the
 * game's real PartMesh, and reads the part's bounding box. Then:
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
 * Skeleton slots come from the `Surface` paints in the old mesh: one per
 * distinct colour and finish, named after the palette key when the colour is
 * one (else paint-<hex>). Names are guesses; the spec's `todo` says so.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { ensureDevServer } from "./devServer.mjs";
import {
  allPartTypes,
  readSpecs,
  resolvePart,
  ROOT,
  specPath,
} from "./parts.mjs";
import { prettify, writeSpecIndex } from "./specIndex.mjs";

const READY_TIMEOUT_MS = 90_000;

const DEFAULT_VIEWS = [
  { name: "front", azimuthDeg: 90, elevationDeg: 0, ortho: true },
  { name: "side", azimuthDeg: 0, elevationDeg: 0, ortho: true },
  { name: "three-quarter", azimuthDeg: 35, elevationDeg: 20, ortho: false },
];

const argv = process.argv.slice(2);
let base;
let all = false;
const ids = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--base") base = argv[++i];
  else if (argv[i] === "--all") all = true;
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
      };
    });
  } catch (err) {
    return { error: `${err.message.split("\n")[0]} ${consoleErrors[0] ?? ""}` };
  } finally {
    await page.close();
  }
}

/** Parts whose shape is not fixed by the part alone, and why. */
const DYNAMIC = {
  "wireless-aerial":
    "Bounds include the wire to another mast, whose distance depends on the studio ship. Model only the fixed hardware; keep the wire procedural (registry subParts) and set expectedBounds by hand.",
  "string-lights":
    "Bounds include the string to another mast, whose distance depends on the studio ship. Model only the fixed hardware; keep the string and bulbs procedural (registry subParts) and set expectedBounds by hand.",
  "nav-lights":
    "Width comes from the bridge it sits on (props), not the part. Keep the bridge-wide spread procedural or model one lamp and repeat it.",
  propeller:
    "The blades spin: bounds are read at the settle frame, so Y/Z are approximate. Model the hub and one blade; keep the spinning group procedural (registry subParts).",
};

function skeleton(id, measured) {
  const painted = measured.slots.filter((s) => s.name !== "unlit");
  const unlit = measured.slots.find((s) => s.name === "unlit");
  const slots = [];
  const slotColors = {};
  for (const s of painted) {
    let name = s.name;
    if (slotColors[name]) name = `${name}-${s.finish}`;
    slots.push(name);
    slotColors[name] =
      s.finish === "metal"
        ? { color: s.color, finish: "metal" }
        : { color: s.color };
  }
  const todo = [
    "Slot names are guesses from the old mesh's paints (palette key or paint-<hex>); rename them to match the Blender build and merge or split as the model needs.",
    "Fill variants[].dims if the part's size comes from props, and add a script assets/blender/parts/" +
      id +
      ".py exposing build(dims).",
    "Add reference images under assets/refs/manifest.json before scoring.",
  ];
  if (painted.length === 0) {
    todo.unshift("No Surface paints found: list the slots by hand.");
  }
  if (painted.some((s) => s.finish === "glass" || s.finish === "wood")) {
    todo.push(
      "Some slots use the glass or wood finish; slotColors only records paint and metal, so set the finish in the registry entry."
    );
  }
  if (DYNAMIC[id]) todo.push(DYNAMIC[id]);
  if (unlit) {
    todo.push(
      `${unlit.meshes} unlit mesh(es) (glow, lights) are not slots; keep them procedural via the registry's subParts.`
    );
  }
  return {
    id,
    script: id,
    slots,
    slotColors,
    todo,
    budget: { maxTriangles: 4000, maxBytes: 200000 },
    boundsTolerance: 0.03,
    rakeRadians: 0,
    weights: { silhouette: 0.6, detail: 0.4 },
    variants: [
      {
        name: id,
        dims: {},
        expectedBounds: measured.bounds,
      },
    ],
    views: DEFAULT_VIEWS,
    scoreVariant: id,
  };
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
        const spec = JSON.parse(readFileSync(specPath(found.specId), "utf8"));
        const variant = spec.variants.find((v) => v.name === found.variant);
        const before = variant.expectedBounds;
        const drift = Math.max(
          ...m.bounds.min.map((v, i) => Math.abs(v - before.min[i])),
          ...m.bounds.max.map((v, i) => Math.abs(v - before.max[i]))
        );
        if (drift > 0) {
          variant.expectedBounds = m.bounds;
          writeFileSync(specPath(found.specId), JSON.stringify(spec, null, 2));
          touched.add(specPath(found.specId));
        }
        rows.push({
          id,
          status: `updated ${found.specId}/${found.variant} (moved ${r4(drift)})`,
          extent: extent(m.bounds),
          slots: `${spec.slots.length} (spec)`,
        });
      } else {
        const spec = skeleton(id, m);
        writeFileSync(specPath(id), JSON.stringify(spec, null, 2));
        touched.add(specPath(id));
        specs[id] = spec;
        const painted = spec.slots.length;
        rows.push({
          id,
          status: painted ? "new skeleton" : "new skeleton (slots TODO)",
          extent: extent(m.bounds),
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
