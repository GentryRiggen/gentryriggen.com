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
import { pickFamilyRefs } from "./checkinRefs.mjs";
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

function esc(text) {
  return String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}

/** Removes the copied glbs so a local build never ships WIP parts. */
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

/** One definition of a failed page load: error, timeout or console error. */
function loadProblem(shot) {
  if (shot.error) return shot.error;
  if (shot.consoleErrors.length) {
    return `console errors: ${shot.consoleErrors.join(" | ")}`;
  }
  return null;
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}

/** One screenshot; a timeout is retried once (a cold dev server, or webpack
 * recompiling mid-load, can stall the first attempt). */
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

function gateRows(score, variant, loadErrors) {
  const rows = score.gates
    .filter((g) => !variant || g.variant === variant)
    .map(
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
function refHtml(specId, ref, general = false) {
  const src = pathToFileURL(
    join(ROOT, "assets", "refs", specId, ref.file)
  ).href;
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

const STYLE = `
body{font:14px system-ui,sans-serif;margin:16px;background:#fff;color:#111;width:1700px}
table{border-collapse:collapse}
th,td{border:1px solid #bbb;padding:6px;vertical-align:top;text-align:left}
.grid img{width:400px;height:400px;display:block}
.grid td{width:400px}
.family img{width:340px;height:340px;display:block}
.family td.refs{width:300px}
.family td.score{width:300px;font-size:13px}
.bad{color:#b00020}
.ref{display:inline-block;vertical-align:top;margin:0 8px 8px 0}
.ref canvas{display:inline-block;vertical-align:top;margin-right:6px;border:1px solid #ddd}
.ref p{margin:4px 0;font-size:11px;color:#555}
pre{white-space:pre-wrap;border:1px solid #bbb;padding:8px;background:#f6f6f6}`;

function buildSheet(spec, score, history, shots, manifestEntries, loadErrors) {
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const url = (p) => pathToFileURL(p).href;
  const outDir = outDirOf(spec.id);
  const rows = spec.views
    .map((v) => {
      const refs = pickFamilyRefs(manifestEntries, view);
      const refCell = refs.length
        ? refs.map((r) => refHtml(spec.id, r)).join("")
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
    ? `<tr><th>general refs</th><td colspan="4">${general.map((r) => refHtml(spec.id, r, true)).join("")}</td></tr>`
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
  return `<!doctype html><meta charset="utf-8"><title>${esc(spec.id)} check-in</title>
<style>${STYLE}</style>
<h1>${esc(spec.id)} check-in, round ${score.round} (scorer v${score.scorerVersion ?? 1})</h1>
<table class="grid"><tr><th></th><th>reference</th><th>old (in game)</th><th>new (Blender)</th><th>new (in game)</th></tr>${rows}${generalRow}</table>
<h2>Score: ${fmt(score.total)}${delta(score.total, prev?.total)}</h2>
<p>sil ${fmt(score.silhouette)}${delta(score.silhouette, prev?.silhouette)}, det ${fmt(score.detail)}${delta(score.detail, prev?.detail)}</p>
<p>triangles: ${tris}<br>bytes: ${bytes}</p>
<table><tr><th>ok</th><th>gate</th><th>detail</th></tr>${gateRows(score, null, loadErrors)}</table>
<h2>Score history</h2>
<table><tr><th>round</th><th>total</th><th>sil</th><th>det</th><th>run s</th><th>since last s</th><th>note</th><th>blockers</th></tr>${historyRows}</table>
${process_ ? `<h2>Process</h2><pre>${esc(process_)}</pre>` : ""}
${judge ? `<h2>Judge</h2><pre>${esc(judge)}</pre>` : ""}
<script>${REF_SCRIPT}</script>`;
}

/** The three-quarter view name of a spec (else its last view). */
function lookView(spec) {
  return (
    spec.views.find((v) => v.name === "three-quarter") ?? spec.views.at(-1)
  ).name;
}

/** The Blender look render for a part: the score variant's view render, or
 * the per-variant render score.py writes for the other variants. */
function blenderLook(part) {
  const renders = join(outDirOf(part.specId), "renders");
  const view = lookView(part.spec);
  const file =
    part.variant === part.spec.scoreVariant
      ? join(renders, `${view}-look.png`)
      : join(renders, `variant-${part.variant}-look.png`);
  return existsSync(file) ? file : null;
}

function scoreCell(part, score, loadErrors) {
  const total = score.triangles?.[part.variant];
  const gates = score.gates.filter((g) => g.variant === part.variant);
  const marks = gates
    .map((g) => `${g.ok ? "✓" : "✗"} ${esc(g.name)}`)
    .concat(`${loadErrors.length ? "✗" : "✓"} load`)
    .join("<br>");
  const own = part.variant === part.spec.scoreVariant;
  return `<b>total ${fmt(score.total)}</b>${own ? "" : " (spec total)"}<br>sil ${fmt(score.silhouette)}<br>det ${fmt(score.detail)}<br>tris ${total ?? "n/a"}<br>${marks}`;
}

function buildFamilySheet(rowsData) {
  const rows = rowsData
    .map(({ part, score, manifestEntries, shots }) => {
      const view = lookView(part.spec);
      const img = (p) => `<img src="${pathToFileURL(p).href}">`;
      const pick = (build) => {
        const s = shots.find((x) => x.build === build);
        const problem = loadProblem(s);
        return `${existsSync(s.file) ? img(s.file) : ""}${problem ? `<p class="bad">${esc(problem)}</p>` : ""}`;
      };
      const refs = manifestEntries
        .filter((e) => e.mask && (e.view === view || !e.view))
        .concat(
          manifestEntries.filter((e) => e.mask && e.view && e.view !== view)
        )
        .slice(0, 3);
      const refCell = refs.length
        ? refs.map((r) => refHtml(part.specId, r)).join("")
        : "no ref";
      const look = blenderLook(part);
      const newShot = shots.find((x) => x.build === "new");
      const loadErrors = loadProblem(newShot) ? [loadProblem(newShot)] : [];
      return `<tr><th>${esc(part.id)}<br><small>${esc(part.specId)}/${esc(part.variant)}</small></th><td class="refs">${refCell}</td><td>${pick("old")}</td><td>${look ? img(look) : "no render"}</td><td>${pick("new")}</td><td class="score">${scoreCell(part, score, loadErrors)}</td></tr>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>family check-in</title>
<style>${STYLE}</style>
<h1>${esc(ids.join(", "))}</h1>
<table class="family"><tr><th></th><th>refs</th><th>old (in game)</th><th>new (Blender)</th><th>new (in game)</th><th>score / gates</th></tr>${rows}</table>
<script>${REF_SCRIPT}</script>`;
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
      writeFileSync(html, buildFamilySheet(data));
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
