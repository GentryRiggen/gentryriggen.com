/**
 * Writes public/<slug>-sw.js for every game in GENERATED_GAME_WORKERS from
 * lib/game-kit/serviceWorker/template.sw.txt, then formats the files.
 *
 * Usage: npx tsx scripts/generate-game-sw.ts
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  GENERATED_GAME_WORKERS,
  renderGameServiceWorker,
  workerFileName,
} from "../lib/game-kit/serviceWorker/generate";

const files = GENERATED_GAME_WORKERS.map((config) => {
  const file = path.join("public", workerFileName(config.slug));
  writeFileSync(file, renderGameServiceWorker(config));
  return file;
});
execFileSync("npx", ["prettier", "--write", ...files], { stdio: "inherit" });
