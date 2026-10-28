#!/usr/bin/env node
/**
 * Human check-in for a remade part: score it, screenshot the old and new
 * part in the game's lighting, and build one comparison sheet.
 *
 *   node scripts/assets/checkin.mjs <part> [--base http://localhost:3000]
 *        [score args, e.g. --round-note "text" --blocker "text"]
 *
 * Writes assets/out/<part>/checkin/{<view>-<build>.png, sheet.html,
 * sheet.png}. Exits 1 if the score run fails or any `new` page fails to load.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
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
const scoreArgs = [];
for (let i = 1; i < argv.length; i++) {
  if (argv[i] === "--base") base = argv[++i];
  else scoreArgs.push(argv[i]);
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
  const d = now - prev;
  return ` (${d >= 0 ? "+" : ""}${d.toFixed(3)})`;
}

function buildSheet(spec, score, history, shots, manifestEntries, loadErrors) {
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const url = (p) => pathToFileURL(p).href;
  const rows = spec.views
    .map((v) => {
      const ref = manifestEntries.find((e) => e.view === v.name);
      const refCell = ref
        ? `<img src="${url(join(ROOT, "assets", "refs", part, ref.file))}">`
        : "no ref";
      const img = (p) => `<img src="${url(p)}">`;
      const look = join(outDir, "renders", `${v.name}-look.png`);
      const cell = (build) => {
        const s = shots.find((x) => x.view === v.name && x.build === build);
        const note = s.error ? `<p class="bad">${esc(s.error)}</p>` : "";
        const errs = s.consoleErrors.length
          ? `<p class="bad">console: ${esc(s.consoleErrors.join(" | "))}</p>`
          : "";
        return `${existsSync(s.file) ? img(s.file) : ""}${note}${errs}`;
      };
      return `<tr><th>${esc(v.name)}</th><td>${refCell}</td><td>${cell("old")}</td><td>${img(look)}</td><td>${cell("new")}</td></tr>`;
    })
    .join("");
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
pre{white-space:pre-wrap;border:1px solid #bbb;padding:8px;background:#f6f6f6}
</style>
<h1>${esc(part)} check-in, round ${score.round}</h1>
<table class="grid"><tr><th></th><th>reference</th><th>old (in game)</th><th>new (Blender)</th><th>new (in game)</th></tr>${rows}</table>
<h2>Score: ${fmt(score.total)}${delta(score.total, prev?.total)}</h2>
<p>sil ${fmt(score.silhouette)}${delta(score.silhouette, prev?.silhouette)}, det ${fmt(score.detail)}${delta(score.detail, prev?.detail)}</p>
<p>triangles: ${tris}<br>bytes: ${bytes}</p>
<table><tr><th>ok</th><th>gate</th><th>detail</th></tr>${gateRows(score, loadErrors)}</table>
<h2>Score history</h2>
<table><tr><th>round</th><th>total</th><th>sil</th><th>det</th><th>run s</th><th>since last s</th><th>note</th><th>blockers</th></tr>${historyRows}</table>
${process_ ? `<h2>Process</h2><pre>${esc(process_)}</pre>` : ""}
${judge ? `<h2>Judge</h2><pre>${esc(judge)}</pre>` : ""}`;
}

async function main() {
  const score = spawnSync(
    "npm",
    ["run", "assets:score", "--", part, ...scoreArgs],
    { cwd: ROOT, stdio: "inherit" }
  );
  if (score.status !== 0) {
    console.error("score run failed");
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

  const server = await ensureServer();
  let browser;
  try {
    browser = await chromium.launch({
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
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
      .filter((s) => s.build === "new" && (s.error || s.consoleErrors.length))
      .map((s) => `${s.view}: ${s.error ?? s.consoleErrors.join(" | ")}`);
    const loadFailed = shots.some((s) => s.build === "new" && s.error);

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
    const png = join(checkinDir, "sheet.png");
    await page.screenshot({ path: png, fullPage: true });
    await page.close();
    spawnSync("open", [png]);
    console.log(`sheet: ${png}`);
    console.log(`load gate: ${loadFailed ? "FAIL" : "ok"}`);
    return loadFailed ? 1 : 0;
  } finally {
    await browser?.close();
    server.stop();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
