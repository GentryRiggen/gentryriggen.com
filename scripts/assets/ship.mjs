#!/usr/bin/env node
/**
 * Ships a remade part to the game: scores it (every gate must pass) and
 * copies its variant glbs to public/ship-builder/models/<part>/, which is
 * committed.
 *
 *   node scripts/assets/ship.mjs <part> [score args, e.g. --round-note "text"]
 *
 * Exits 1 if the score run fails, any gate fails or a variant glb is missing.
 * `assets/__tests__/shippedModels.test.ts` checks the committed files against
 * the spec, so a stale or hand-edited model fails CI.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const [part, ...scoreArgs] = process.argv.slice(2);
if (!part || part.startsWith("--")) {
  console.error("usage: ship.mjs <part> [score args]");
  process.exit(1);
}
if (scoreArgs.some((arg) => arg === "--spec" || arg.startsWith("--spec="))) {
  console.error("ship does not support --spec: it ships the real part.");
  process.exit(1);
}

const score = spawnSync(
  join(ROOT, "scripts", "assets", "blender.sh"),
  ["-P", "assets/blender/score.py", "--", part, ...scoreArgs],
  { cwd: ROOT, stdio: "inherit" }
);
if (score.status !== 0) {
  console.error(`ship: the score run for ${part} failed`);
  process.exit(1);
}

const outDir = join(ROOT, "assets", "out", part);
const result = JSON.parse(readFileSync(join(outDir, "score.json"), "utf8"));
const failed = result.gates.filter((gate) => !gate.ok);
if (failed.length > 0) {
  for (const gate of failed) {
    console.error(`ship: gate ${gate.name} [${gate.variant}]: ${gate.detail}`);
  }
  process.exit(1);
}

const spec = JSON.parse(
  readFileSync(join(ROOT, "assets", "parts", `${part}.json`), "utf8")
);
const game = spec.game === "plane" ? "plane-builder" : "ship-builder";
const shipDir = join(ROOT, "public", game, "models", part);
mkdirSync(shipDir, { recursive: true });
for (const { name } of spec.variants) {
  const from = join(outDir, `${name}.glb`);
  if (!existsSync(from)) {
    console.error(`ship: ${from} is missing`);
    process.exit(1);
  }
  copyFileSync(from, join(shipDir, `${name}.glb`));
  console.log(`shipped public/${game}/models/${part}/${name}.glb`);
}
