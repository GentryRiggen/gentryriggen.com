/** `assets:measure --game plane`: measures Plane Builder pieces. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, specPath } from "./parts.mjs";

const READY_TIMEOUT_MS = 90_000;
const DEFAULT_VIEWS = [
  { name: "front", azimuthDeg: 90, elevationDeg: 0, ortho: true },
  { name: "side", azimuthDeg: 0, elevationDeg: 0, ortho: true },
  { name: "top", azimuthDeg: 0, elevationDeg: 89, ortho: true },
  { name: "three-quarter", azimuthDeg: 35, elevationDeg: 20, ortho: false },
];

/** assets/plane-pieces.json: { piece: { units: { unit: { level, spin? } } } }. */
export function readPlanePieces() {
  return JSON.parse(
    readFileSync(join(ROOT, "assets", "plane-pieces.json"), "utf8")
  );
}

async function measureUnit(browser, url, piece, unit) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  try {
    await page.goto(
      `${url}/asset-studio?game=plane&part=${piece}&variant=${unit}&build=old`,
      { timeout: READY_TIMEOUT_MS }
    );
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

const extent = (b) =>
  b.max.map((v, i) => Math.round((v - b.min[i]) * 1e4) / 1e4).join(" x ");

/**
 * Measures every unit of one piece (the old procedural build in the plane
 * studio) and writes assets/parts/plane-<piece>.json: a skeleton when there
 * is none (slots from the unit's paints, named body/trim/dark/...), else only
 * the units' expectedBounds, and never those of a spec with boundsFixed.
 */
export async function measurePlanePiece(browser, url, piece, touched) {
  const pieces = readPlanePieces();
  if (!pieces[piece]) {
    return [
      {
        id: piece,
        status: "FAILED: unknown plane piece",
        extent: "",
        slots: "",
      },
    ];
  }
  const id = `plane-${piece}`;
  const file = specPath(id);
  const existing = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : null;
  const rows = [];
  const variants = [];
  const slotColors = {};
  for (const unit of Object.keys(pieces[piece].units)) {
    const m = await measureUnit(browser, url, piece, unit);
    if (m.error) {
      rows.push({
        id: unit,
        status: `FAILED: ${m.error}`,
        extent: "",
        slots: "",
      });
      console.log(`${unit}: FAILED ${m.error}`);
      continue;
    }
    for (const s of m.slots) {
      slotColors[s.name] ??= { color: s.color };
    }
    variants.push({ name: unit, dims: {}, expectedBounds: m.bounds });
    rows.push({
      id: unit,
      status: existing ? "bounds measured" : "new skeleton",
      extent: extent(m.bounds),
      slots: m.slots.map((s) => s.name).join(","),
    });
    console.log(`${unit}: ${extent(m.bounds)}`);
  }
  if (variants.length === 0) return rows;
  let spec;
  if (existing) {
    spec = existing;
    if (!spec.boundsFixed) {
      for (const v of variants) {
        const found = spec.variants.find((x) => x.name === v.name);
        if (found) found.expectedBounds = v.expectedBounds;
        else spec.variants.push(v);
      }
    } else {
      for (const r of rows) r.status = "skipped: boundsFixed";
    }
  } else {
    spec = {
      id,
      game: "plane",
      script: id,
      slots: Object.keys(slotColors),
      slotColors,
      todo: [
        "Slot names are the plane's paints (body, trim, dark): keep only the ones the Blender build uses.",
        `Add a script assets/blender/parts/${id}.py exposing build(dims) that returns one object per slot, for the unit named in dims.unit.`,
        "Add reference images under assets/refs/manifest.json before scoring.",
      ],
      budget: { maxTriangles: 4000, maxBytes: 200000 },
      boundsTolerance: 0.03,
      rakeRadians: 0,
      weights: { silhouette: 0.6, detail: 0.4 },
      variants: variants.map((v) => ({ ...v, dims: { unit: v.name } })),
      views: DEFAULT_VIEWS,
      scoreVariant: variants[0].name,
      ao: { ground: false },
    };
  }
  writeFileSync(file, JSON.stringify(spec, null, 2));
  touched.add(file);
  return rows;
}
