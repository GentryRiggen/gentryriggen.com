// Run: npx tsx scripts/plane-balance.ts [--verbose]
import { LEVEL_ORDER, LEVELS } from "../lib/plane-builder/levels";
import { playLevel, pilotFlight } from "../lib/plane-builder/balance/pilot";
import { STARTER_TIERS } from "../lib/plane-builder/plane/catalog";
import { planeStats } from "../lib/plane-builder/plane/stats";

const verbose = process.argv.includes("--verbose");

console.log("level      flights  starter%  dry  jump  half-at  max s");
for (const id of LEVEL_ORDER) {
  const log = playLevel(id);
  const finish = LEVELS[id].finishDistance;
  const starter = pilotFlight(
    id,
    planeStats(LEVELS[id].plane, STARTER_TIERS)
  ).distance;
  let dry = 0;
  let maxDry = 0;
  let best = 0;
  let maxJump = 0;
  for (const f of log.slice(0, -1)) {
    dry = f.cheapest !== null && f.earned < f.cheapest ? dry + 1 : 0;
    maxDry = Math.max(maxDry, dry);
  }
  for (const f of log) {
    if (best >= finish * 0.1) maxJump = Math.max(maxJump, f.distance / best);
    best = Math.max(best, f.distance);
  }
  const halfAt = log.findIndex((f) => f.distance >= finish / 2) + 1;
  console.log(
    `${id.padEnd(10)} ${String(log.length).padStart(7)}  ${(
      (starter / finish) *
      100
    )
      .toFixed(1)
      .padStart(7)}  ${String(maxDry).padStart(3)}  ${maxJump
      .toFixed(2)
      .padStart(
        4
      )}  ${halfAt}/${log.length}  ${Math.max(...log.map((f) => f.time)).toFixed(0)}`
  );
  if (verbose)
    log.forEach((f, i) =>
      console.log(
        `  ${String(i + 1).padStart(2)}  ${Math.round(f.distance)
          .toString()
          .padStart(
            5
          )} m  +${f.earned}  (cheapest ${f.cheapest ?? "-"})  ${f.endReason} ${f.time.toFixed(0)}s`
      )
    );
}
