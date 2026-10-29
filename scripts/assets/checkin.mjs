#!/usr/bin/env node
/**
 * Human check-in for remade parts: score them, screenshot the old and new
 * part in the game's lighting, and build one comparison sheet.
 *
 *   node scripts/assets/checkin.mjs <part> [--base http://localhost:3000]
 *        [--skip-score] [--keep-glb]
 *        [score args, e.g. --round-note "text" --blocker "text"]
 *   node scripts/assets/checkin.mjs <part> <part> ...   (family sheet)
 *
 * One part: writes assets/out/<spec>/checkin/{<view>-<build>.png, sheet.html,
 * sheet.png}, a row per view. Several parts (or a non-scoring variant such as
 * funnel-large): ONE sheet with a row per part, written to
 * assets/out/_family/<first-id>-<n>.png. Columns: refs (up to 3 crops with
 * masks), old in game, new in Blender, new in game (all three-quarter), and a
 * score/gates cell. A part id is a spec id or one of a spec's variants; each
 * spec is scored once.
 *
 * Exits 1 if a score run fails or any `new` page fails to load (error,
 * timeout or console error). --skip-score reuses the existing score.json and
 * glbs; --keep-glb leaves public/asset-studio/<spec>/ in place (otherwise it
 * is removed so a local build never ships WIP glbs). The dev server is
 * started on ASSETS_PORT (else a free port) unless --base names one; see
 * scripts/assets/devServer.mjs.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { ensureDevServer } from "./devServer.mjs";
import {
  buildFamilySheet,
  buildSheet,
  loadProblem,
  lookView,
  readText,
} from "./checkinSheet.mjs";
import { readSpecs, resolvePart, ROOT } from "./parts.mjs";

const LOAD_TIMEOUT_MS = 30_000;
const SIZE = 512;

const argv = process.argv.slice(2);
const ids = [];
let base;
let skipScore = false;
let keepGlb = false;
const scoreArgs = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--base") base = argv[++i];
  else if (arg === "--skip-score") skipScore = true;
  else if (arg === "--keep-glb") keepGlb = true;
  else if (arg === "--spec" || arg.startsWith("--spec=")) {
    console.error(
      "checkin does not support --spec: it screenshots the real part. " +
        "Run assets:score with --spec for experiments instead."
    );
    process.exit(1);
  } else if (arg.startsWith("--")) {
    scoreArgs.push(arg);
    // Score flags that take a value (--round-note "x", --blocker "y").
    if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      scoreArgs.push(argv[++i]);
    }
  } else ids.push(arg);
}
if (ids.length === 0) {
  console.error(
    "usage: checkin.mjs <part> [<part> ...] [--base url] [score args]"
  );
  process.exit(1);
}

const specs = readSpecs();
const parts = ids.map((id) => {
  const found = resolvePart(id, specs);
  if (!found) {
    console.error(
      `no spec for "${id}": run \`npm run assets:measure -- ${id}\` and model it first`
    );
    process.exit(1);
  }
  return { id, ...found, spec: specs[found.specId] };
});
const specIds = [...new Set(parts.map((p) => p.specId))];
/** One part at its spec's scoring variant: the classic per-view sheet. */
const singleSheet =
  parts.length === 1 && parts[0].variant === parts[0].spec.scoreVariant;

const outDirOf = (specId) => join(ROOT, "assets", "out", specId);
const publicDirOf = (specId) => join(ROOT, "public", "asset-studio", specId);

function cleanPublic() {
  if (keepGlb) return;
  for (const specId of specIds) {
    const dir = publicDirOf(specId);
    rmSync(dir, { recursive: true, force: true });
    try {
      rmdirSync(dirname(dir)); // only succeeds when empty
    } catch {
      // other parts still have files there, or the dir is already gone
    }
  }
}

let stopSpawnedServer = () => {};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopSpawnedServer();
    cleanPublic();
    process.exit(130);
  });
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

async function shoot(browser, serverUrl, part, view, build, dir) {
  const first = await shootOnce(browser, serverUrl, part, view, build, dir);
  if (!first.error?.startsWith("timed out")) return first;
  console.log(`${part.id} ${view}-${build}: ${first.error}; retrying`);
  return shootOnce(browser, serverUrl, part, view, build, dir);
}

async function shootOnce(browser, serverUrl, part, view, build, dir) {
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
  });
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  const query = new URLSearchParams({
    part: part.id,
    build,
    view,
    time: "Day",
  });
  const file = join(dir, `${part.id}-${view}-${build}.png`);
  let error = null;
  try {
    await page.goto(`${serverUrl}/asset-studio?${query}`, {
      timeout: 90_000,
    });
    await page.waitForFunction(
      () =>
        document.body.dataset.studioReady === "1" ||
        document.body.dataset.studioError,
      null,
      { timeout: LOAD_TIMEOUT_MS }
    );
    error = await page.evaluate(
      () => document.body.dataset.studioError ?? null
    );
    await page.screenshot({ path: file });
  } catch (err) {
    error = `timed out or failed: ${err.message.split("\n")[0]}`;
  }
  await page.close();
  return { part: part.id, view, build, file, error, consoleErrors };
}

async function renderSheet(browser, htmlPath, pngPath, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(() => window.__refsDone);
  await page.screenshot({ path: pngPath, fullPage: true });
  await page.close();
}

async function main() {
  if (!skipScore) {
    for (const specId of specIds) {
      const score = spawnSync(
        "npm",
        ["run", "assets:score", "--", specId, ...scoreArgs],
        { cwd: ROOT, stdio: "inherit" }
      );
      if (score.status !== 0) {
        console.error(`score run failed for ${specId}`);
        return 1;
      }
    }
  }
  for (const specId of specIds) {
    if (!existsSync(join(outDirOf(specId), "score.json"))) {
      console.error(`--skip-score: no score.json for ${specId} yet`);
      return 1;
    }
    mkdirSync(publicDirOf(specId), { recursive: true });
    for (const f of readdirSync(outDirOf(specId)).filter((n) =>
      n.endsWith(".glb")
    )) {
      copyFileSync(join(outDirOf(specId), f), join(publicDirOf(specId), f));
    }
  }

  const manifest = readJson(join(ROOT, "assets", "refs", "manifest.json"), {});
  const familyDir = join(ROOT, "assets", "out", "_family");
  const dirs = singleSheet
    ? [join(outDirOf(parts[0].specId), "checkin")]
    : [familyDir];
  for (const dir of dirs) {
    if (singleSheet) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  const shotDir = dirs[0];

  let server;
  let browser;
  try {
    server = await ensureDevServer(ROOT, { base });
    stopSpawnedServer = server.stop;
    browser = await chromium.launch({
      args: [
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
        // The sheet reads reference pixels to draw mask thumbnails.
        "--allow-file-access-from-files",
      ],
    });
    const data = [];
    for (const part of parts) {
      const views = singleSheet
        ? part.spec.views.map((v) => v.name)
        : [lookView(part.spec)];
      const shots = [];
      for (const view of views) {
        for (const build of ["old", "new"]) {
          const s = await shoot(
            browser,
            server.url,
            part,
            view,
            build,
            shotDir
          );
          console.log(`${part.id} ${view}-${build}: ${s.error ?? "ok"}`);
          shots.push(s);
        }
      }
      data.push({
        part,
        shots,
        score: readJson(join(outDirOf(part.specId), "score.json")),
        manifestEntries: manifest[part.specId] ?? [],
      });
    }
    const loadErrors = data.flatMap((d) =>
      d.shots
        .filter((s) => s.build === "new" && loadProblem(s))
        .map((s) => `${s.part} ${s.view}: ${loadProblem(s)}`)
    );
    const loadFailed = loadErrors.length > 0;

    let png;
    if (singleSheet) {
      const { part, shots, score, manifestEntries } = data[0];
      const history = readText(join(outDirOf(part.specId), "history.jsonl"))
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      const html = join(shotDir, "sheet.html");
      writeFileSync(
        html,
        buildSheet(
          part.spec,
          score,
          history,
          shots,
          manifestEntries,
          loadErrors
        )
      );
      png = join(shotDir, "sheet.png");
      await renderSheet(browser, html, png, 1740);
    } else {
      const html = join(familyDir, `${ids[0]}-${ids.length}.html`);
      writeFileSync(html, buildFamilySheet(data, ids));
      png = join(familyDir, `${ids[0]}-${ids.length}.png`);
      await renderSheet(browser, html, png, 1740);
    }
    spawnSync("open", [png]);
    console.log(`sheet: ${png}`);
    console.log(`load gate: ${loadFailed ? "FAIL" : "ok"}`);
    return loadFailed ? 1 : 0;
  } finally {
    await browser?.close();
    server?.stop();
    cleanPublic();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
