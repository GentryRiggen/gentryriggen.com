#!/usr/bin/env node
/**
 * Downloads reference images listed in assets/refs/manifest.json.
 *
 *   node scripts/assets/fetch-refs.mjs [part]
 *
 * Skips files that already exist (never overwrites). Prints
 * `fetched N, kept M, failed K` and lists the failures.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REFS = join(ROOT, "assets", "refs");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const only = process.argv[2];
const manifest = JSON.parse(readFileSync(join(REFS, "manifest.json"), "utf8"));
let fetched = 0;
let kept = 0;
const failures = [];

for (const [part, entries] of Object.entries(manifest)) {
  if (only && part !== only) continue;
  for (const entry of entries) {
    const target = join(REFS, part, entry.file);
    if (existsSync(target)) {
      kept++;
      continue;
    }
    try {
      const res = await fetch(entry.url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) {
        throw new Error(`not an image (content-type "${type}")`);
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(await res.arrayBuffer()));
      fetched++;
    } catch (err) {
      failures.push(`${part}/${entry.file}: ${entry.url} (${err.message})`);
    }
  }
}

console.log(`fetched ${fetched}, kept ${kept}, failed ${failures.length}`);
for (const f of failures) console.log(`  failed: ${f}`);
process.exit(failures.length ? 1 : 0);
