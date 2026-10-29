#!/usr/bin/env node
/**
 * Human check-in for a remade part: score it, screenshot the old and new
 * part in the game's lighting, and build one comparison sheet.
 *
 *   node scripts/assets/checkin.mjs <part> [--base http://localhost:3000]
 *        [--skip-score] [--keep-glb]
 *        [score args, e.g. --round-note "text" --blocker "text"]
 *
 * Writes assets/out/<part>/checkin/{<view>-<build>.png, sheet.html,
 * sheet.png}. Exits 1 if the score run fails or any `new` page fails to load
 * (error, timeout or console error). --skip-score reuses the existing
 * score.json and glbs; --keep-glb leaves public/asset-studio/<part>/ in place
 * (otherwise it is removed so a local build never ships WIP glbs).
 */
import { spawn, spawnSync } from "node:child_process";
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPAWN_PORT = 3123;
const LOAD_TIMEOUT_MS = 30_000;
const SERVER_TIMEOUT_MS = 120_000;
const SIZE = 512;

const argv = process.argv.slice(2);
const part = argv[0];
if (!part || part.startsWith("--")) {
  console.error("usage: checkin.mjs <part> [--base url] [score args]");
  process.exit(1);
}
let base = "http://localhost:3000";
let skipScore = false;
let keepGlb = false;
const scoreArgs = [];
for (let i = 1; i < argv.length; i++) {
  if (argv[i] === "--base") base = argv[++i];
  else if (argv[i] === "--skip-score") skipScore = true;
  else if (argv[i] === "--keep-glb") keepGlb = true;
  else if (argv[i] === "--spec" || argv[i].startsWith("--spec=")) {
    console.error(
      "checkin does not support --spec: it screenshots the real part. " +
        "Run assets:score with --spec for experiments instead."
    );
    process.exit(1);
  } else scoreArgs.push(argv[i]);
}

const outDir = join(ROOT, "assets", "out", part);
const checkinDir = join(outDir, "checkin");
const publicDir = join(ROOT, "public", "asset-studio", part);

function esc(text) {
  return String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}

async function answers(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

/** Removes the copied glbs so a local build never ships WIP parts. */
function cleanPublic() {
  if (keepGlb) return;
  rmSync(publicDir, { recursive: true, force: true });
  try {
    rmdirSync(dirname(publicDir)); // only succeeds when empty
  } catch {
    // other parts still have files there, or the dir is already gone
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

/** One definition of a failed page load: error, timeout or console error. */
function loadProblem(shot) {
  if (shot.error) return shot.error;
  if (shot.consoleErrors.length) {
    return `console errors: ${shot.consoleErrors.join(" | ")}`;
  }
  return null;
}

/** Reuses a server at `base`, else spawns one; returns a stop function. */
async function ensureServer() {
  if (await answers(base)) return { url: base, stop: () => {} };
  const url = `http://localhost:${SPAWN_PORT}`;
  console.log(`no server at ${base}; starting next dev on ${SPAWN_PORT}`);
  const child = spawn("npx", ["next", "dev", "-p", String(SPAWN_PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };
  stopSpawnedServer = stop;
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (!(await answers(url))) {
    if (Date.now() > deadline || child.exitCode !== null) {
      stop();
      throw new Error("dev server did not start");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { url, stop };
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}

async function shoot(browser, serverUrl, spec, view, build) {
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
  });
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  const query = new URLSearchParams({
    part,
    variant: spec.scoreVariant,
    build,
    view,
    time: "Day",
  });
  const file = join(checkinDir, `${view}-${build}.png`);
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
  return { view, build, file, error, consoleErrors };
}

function gateRows(score, loadErrors) {
  const rows = score.gates.map(
    (g) =>
      `<tr><td>${g.ok ? "✓" : "✗"}</td><td>${esc(g.name)} [${esc(g.variant)}]</td><td>${esc(g.detail)}</td></tr>`
  );
  rows.push(
    `<tr><td>${loadErrors.length ? "✗" : "✓"}</td><td>load [new]</td><td>${esc(loadErrors.join("; ") || "all new pages rendered")}</td></tr>`
  );
  return rows.join("");
}

function fmt(v) {
  return v == null ? "n/a" : v.toFixed(3);
}

function delta(now, prev) {
  if (now == null || prev == null) return "";
  const text = (now - prev).toFixed(3);
  if (Number(text) === 0) return " (0.000)"; // never "-0.000"
  return ` (${Number(text) > 0 ? "+" : ""}${text})`;
}

/** One reference: its crop (or, for a general ref, the whole image scaled
 * down), plus a mask thumbnail when it has a mask. Drawn on canvases by the
 * script at the end of the sheet. */
function refHtml(ref, general = false) {
  const src = pathToFileURL(join(ROOT, "assets", "refs", part, ref.file)).href;
  const data = esc(
    JSON.stringify({
      src,
      file: ref.file,
      crop: general ? null : (ref.crop ?? null),
      mask: general ? null : (ref.mask ?? null),
    })
  );
  return `<div class="ref" data-ref="${data}"><canvas class="refimg"></canvas>${
    !general && ref.mask ? '<canvas class="refmask"></canvas>' : ""
  }<p>${esc(ref.file)}</p></div>`;
}

const REF_SCRIPT = `
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
window.__refsDone = Promise.all(
  [...document.querySelectorAll(".ref")].map(async (el) => {
    const cfg = JSON.parse(el.dataset.ref);
    const img = new Image();
    img.src = cfg.src;
    try {
      await img.decode();
    } catch {
      el.innerHTML = '<p class="bad">missing: ' + cfg.file + "</p>";
      return;
    }
    const [x, y, w, h] = cfg.crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
    const draw = (canvas, width) => {
      const scale = Math.min(width / w, 400 / h);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
      return ctx;
    };
    const main = el.querySelector(".refimg");
    draw(main, 260);
    const thumb = el.querySelector(".refmask");
    if (!thumb || !cfg.mask) return;
    const ctx = draw(thumb, 110);
    const data = ctx.getImageData(0, 0, thumb.width, thumb.height);
    const m = cfg.mask;
    const t = (m.threshold ?? 0.5) * 255;
    for (let i = 0; i < data.data.length; i += 4) {
      const [r, g, b, a] = data.data.slice(i, i + 4);
      let on = m.mode === "alpha" ? a > t : luma(r, g, b) < t;
      if (m.mode !== "alpha" && m.invert) on = !on;
      data.data.set(on ? [255, 255, 255, 255] : [0, 0, 0, 255], i);
    }
    ctx.putImageData(data, 0, 0);
  })
);`;

function buildSheet(spec, score, history, shots, manifestEntries, loadErrors) {
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const url = (p) => pathToFileURL(p).href;
  const rows = spec.views
    .map((v) => {
      const refs = manifestEntries.filter((e) => e.view === v.name);
      const refCell = refs.length
        ? refs.map((r) => refHtml(r)).join("")
        : "no ref";
      const img = (p) => `<img src="${url(p)}">`;
      const look = join(outDir, "renders", `${v.name}-look.png`);
      const cell = (build) => {
        const s = shots.find((x) => x.view === v.name && x.build === build);
        const problem = loadProblem(s);
        const note = problem ? `<p class="bad">${esc(problem)}</p>` : "";
        return `${existsSync(s.file) ? img(s.file) : ""}${note}`;
      };
      return `<tr><th>${esc(v.name)}</th><td>${refCell}</td><td>${cell("old")}</td><td>${img(look)}</td><td>${cell("new")}</td></tr>`;
    })
    .join("");
  const general = manifestEntries.filter((e) => !e.view);
  const generalRow = general.length
    ? `<tr><th>general refs</th><td colspan="4">${general.map((r) => refHtml(r, true)).join("")}</td></tr>`
    : "";
  const historyRows = history
    .map(
      (h) =>
        `<tr><td>${h.round}</td><td>${fmt(h.total)}</td><td>${fmt(h.silhouette)}</td><td>${fmt(h.detail)}</td><td>${h.runSeconds ?? ""}</td><td>${h.sinceLastSeconds ?? ""}</td><td>${esc(h.note ?? "")}</td><td>${esc((h.blockers ?? []).join("; "))}</td></tr>`
    )
    .join("");
  const tris = Object.entries(score.triangles)
    .map(([k, v]) => `${esc(k)}: ${v}`)
    .join(", ");
  const bytes = Object.entries(score.bytes)
    .map(([k, v]) => `${esc(k)}: ${v}`)
    .join(", ");
  const judge = readText(join(outDir, "judge.md"));
  const process_ = readText(join(outDir, "process.md"));
  return `<!doctype html><meta charset="utf-8"><title>${esc(part)} check-in</title>
<style>
body{font:14px system-ui,sans-serif;margin:16px;background:#fff;color:#111;width:1700px}
table{border-collapse:collapse}
th,td{border:1px solid #bbb;padding:6px;vertical-align:top;text-align:left}
.grid img{width:400px;height:400px;display:block}
.grid td{width:400px}
.bad{color:#b00020}
.ref{display:inline-block;vertical-align:top;margin:0 8px 8px 0}
.ref canvas{display:inline-block;vertical-align:top;margin-right:6px;border:1px solid #ddd}
.ref p{margin:4px 0;font-size:11px;color:#555}
pre{white-space:pre-wrap;border:1px solid #bbb;padding:8px;background:#f6f6f6}
</style>
<h1>${esc(part)} check-in, round ${score.round} (scorer v${score.scorerVersion ?? 1})</h1>
<table class="grid"><tr><th></th><th>reference</th><th>old (in game)</th><th>new (Blender)</th><th>new (in game)</th></tr>${rows}${generalRow}</table>
<h2>Score: ${fmt(score.total)}${delta(score.total, prev?.total)}</h2>
<p>sil ${fmt(score.silhouette)}${delta(score.silhouette, prev?.silhouette)}, det ${fmt(score.detail)}${delta(score.detail, prev?.detail)}</p>
<p>triangles: ${tris}<br>bytes: ${bytes}</p>
<table><tr><th>ok</th><th>gate</th><th>detail</th></tr>${gateRows(score, loadErrors)}</table>
<h2>Score history</h2>
<table><tr><th>round</th><th>total</th><th>sil</th><th>det</th><th>run s</th><th>since last s</th><th>note</th><th>blockers</th></tr>${historyRows}</table>
${process_ ? `<h2>Process</h2><pre>${esc(process_)}</pre>` : ""}
${judge ? `<h2>Judge</h2><pre>${esc(judge)}</pre>` : ""}
<script>${REF_SCRIPT}</script>`;
}

async function main() {
  if (!skipScore) {
    const score = spawnSync(
      "npm",
      ["run", "assets:score", "--", part, ...scoreArgs],
      { cwd: ROOT, stdio: "inherit" }
    );
    if (score.status !== 0) {
      console.error("score run failed");
      return 1;
    }
  } else if (!existsSync(join(outDir, "score.json"))) {
    console.error(`--skip-score: no score.json for ${part} yet`);
    return 1;
  }

  mkdirSync(publicDir, { recursive: true });
  for (const f of readdirSync(outDir).filter((n) => n.endsWith(".glb"))) {
    copyFileSync(join(outDir, f), join(publicDir, f));
  }
  rmSync(checkinDir, { recursive: true, force: true });
  mkdirSync(checkinDir, { recursive: true });

  const spec = readJson(join(ROOT, "assets", "parts", `${part}.json`));
  const scoreJson = readJson(join(outDir, "score.json"));
  const history = readText(join(outDir, "history.jsonl"))
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const manifest = readJson(join(ROOT, "assets", "refs", "manifest.json"), {});

  let server;
  let browser;
  try {
    server = await ensureServer();
    browser = await chromium.launch({
      args: [
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
        // The sheet reads reference pixels to draw mask thumbnails.
        "--allow-file-access-from-files",
      ],
    });
    const shots = [];
    for (const v of spec.views) {
      for (const build of ["old", "new"]) {
        const s = await shoot(browser, server.url, spec, v.name, build);
        console.log(`${v.name}-${build}: ${s.error ?? "ok"}`);
        shots.push(s);
      }
    }
    const loadErrors = shots
      .filter((s) => s.build === "new" && loadProblem(s))
      .map((s) => `${s.view}: ${loadProblem(s)}`);
    const loadFailed = loadErrors.length > 0;

    const sheetHtml = join(checkinDir, "sheet.html");
    writeFileSync(
      sheetHtml,
      buildSheet(
        spec,
        scoreJson,
        history,
        shots,
        manifest[part] ?? [],
        loadErrors
      )
    );
    const page = await browser.newPage({
      viewport: { width: 1740, height: 900 },
    });
    await page.goto(pathToFileURL(sheetHtml).href);
    await page.evaluate(() => window.__refsDone);
    const png = join(checkinDir, "sheet.png");
    await page.screenshot({ path: png, fullPage: true });
    await page.close();
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
