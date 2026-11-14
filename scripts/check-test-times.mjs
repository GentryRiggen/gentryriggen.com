#!/usr/bin/env node
/**
 * Fails when a fast-lane test file is slow, so simulations can't creep back
 * into the tests that hold up a deploy. Reads Jest's --json output.
 *
 *   node scripts/check-test-times.mjs jest-results.json [maxSeconds=30]
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const [file, max = "30"] = process.argv.slice(2);
if (!file) {
  console.error("usage: check-test-times.mjs <jest --json file> [maxSeconds]");
  process.exit(2);
}
const limit = Number(max);
const { testResults } = JSON.parse(readFileSync(file, "utf8"));

const timed = testResults.map((r) => r.endTime - r.startTime);
if (timed.length === 0 || !timed.every(Number.isFinite)) {
  console.error(
    "Jest's results have no per-file times: is this --json output?"
  );
  process.exit(2);
}

const slow = testResults
  .map((r) => ({
    path: relative(process.cwd(), r.name),
    seconds: (r.endTime - r.startTime) / 1000,
  }))
  .filter((r) => r.seconds > limit)
  .sort((a, b) => b.seconds - a.seconds);

if (slow.length === 0) {
  console.log(`No test file took over ${limit} s.`);
  process.exit(0);
}
for (const { path, seconds } of slow)
  console.error(
    `::error file=${path}::${path} took ${seconds.toFixed(1)} s (limit ${limit} s). ` +
      "A test that plays whole runs belongs in jest.sims.js, which keeps it out of the deploy path; otherwise make it faster."
  );
process.exit(1);
