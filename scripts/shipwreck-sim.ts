/**
 * Runs the Shipwreck sim headless and prints its timeline.
 *
 *   npx tsx scripts/shipwreck-sim.ts                 # the real night
 *   npx tsx scripts/shipwreck-sim.ts hold1 hold2     # What if? these open
 *   npx tsx scripts/shipwreck-sim.ts --first=5       # What if? first 5 forward
 *   add --water for each compartment's fill every 10 minutes
 */
import { titanic } from "../lib/shipwreck/ships/titanic";
import { simulate, whatIfOpenings } from "../lib/shipwreck/sim/run";
import { sampleTrack } from "../lib/shipwreck/sim/track";

const CLOCK_START_S = 23 * 3600 + 40 * 60;

function clock(t: number): string {
  const s = Math.round(CLOCK_START_S + t) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const args = process.argv.slice(2);
const showWater = args.includes("--water");
const first = args.find((a) => a.startsWith("--first="));
const ids = args.filter((a) => !a.startsWith("--"));
const spec = titanic;
let label = "The real night";
let openings = spec.realNight;
if (first) {
  const n = Number(first.split("=")[1]);
  const forward = spec.compartments.slice(-n).map((c) => c.id);
  openings = whatIfOpenings(spec, forward);
  label = `What if: the first ${n} forward (${forward.join(", ")})`;
} else if (ids.length > 0) {
  openings = whatIfOpenings(spec, ids);
  label = `What if: ${ids.join(", ")}`;
}

const t0 = performance.now();
const track = simulate(spec, openings);
const ms = performance.now() - t0;

console.log(`${label}`);
console.log(
  `  openings: ${openings.map((o) => `${o.compartmentId} ${o.areaM2} m²`).join(", ")}` +
    ` (total ${openings.reduce((a, o) => a + o.areaM2, 0).toFixed(2)} m²)`
);
console.log(
  `  simulated in ${ms.toFixed(0)} ms, ${track.frames.length} frames\n`
);
console.log("Events:");
for (const e of track.events) {
  const frame = sampleTrack(track, e.t);
  console.log(
    `  ${clock(e.t).padStart(11)}  ${e.kind}${e.index === undefined ? "" : ` ${e.index}`}` +
      `  (trim ${frame.trimDeg.toFixed(1)}°, list ${frame.listDeg.toFixed(1)}°)`
  );
}
console.log("\nEvery 10 minutes:");
const names = spec.compartments.map((c) => c.id);
const lastT = track.brokeAtT ?? track.endT;
for (let t = 0; t <= lastT + 1; t += 600) {
  const f = sampleTrack(track, Math.min(t, lastT));
  const whole = f.bodies[0];
  let line =
    `  ${clock(t).padStart(11)}  trim ${f.trimDeg.toFixed(2).padStart(6)}°` +
    `  list ${f.listDeg.toFixed(2).padStart(5)}°` +
    `  sinkage ${(-whole.z).toFixed(2).padStart(6)} m` +
    `  water ${Math.round(f.waterAboardT).toString().padStart(6)} t`;
  if (showWater)
    line +=
      "  " +
      f.water
        .map((w, i) => `${names[i]}:${Math.round(w * 100)}`)
        .filter((s) => !s.endsWith(":0"))
        .join(" ");
  console.log(line);
}
const pct =
  track.breakX === null
    ? null
    : ((track.breakX + spec.lbp / 2) / spec.lbp) * 100;
console.log(
  `\nOutcome: ${track.outcome}` +
    (track.sankAtT === null ? "" : `, under at ${clock(track.sankAtT)}`) +
    (track.brokeAtT === null
      ? ", no breakup"
      : `, broke at ${clock(track.brokeAtT)} at x = ${track.breakX?.toFixed(1)} m (${pct?.toFixed(1)}% of LBP from the stern)`)
);
