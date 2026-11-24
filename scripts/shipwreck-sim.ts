/**
 * Runs the Shipwreck sim headless and prints its timeline.
 *
 *   npx tsx scripts/shipwreck-sim.ts                 # the real night
 *   npx tsx scripts/shipwreck-sim.ts hold1 hold2     # What if? these open
 *   npx tsx scripts/shipwreck-sim.ts --first=5       # What if? first 5 forward
 *   npx tsx scripts/shipwreck-sim.ts --ship=lusitania          # her afternoon
 *   npx tsx scripts/shipwreck-sim.ts --ship=lusitania br3      # torpedo at br3
 *   npx tsx scripts/shipwreck-sim.ts --ship=fitzgerald         # her last afternoon
 *   npx tsx scripts/shipwreck-sim.ts --ship=fitzgerald hatch-1 vents  # What if? these spots
 *   npx tsx scripts/shipwreck-sim.ts --ship=carpathia          # her last morning
 *   npx tsx scripts/shipwreck-sim.ts --ship=carpathia --no-finisher   # no third torpedo
 *   npx tsx scripts/shipwreck-sim.ts --ship=carpathia --spots=hold3,finisher  # these spots
 *   --spots=a,b names What-if spots like the bare ids; --no-finisher drops a
 *   torpedo ship's later torpedo (FINISHER_SPOT) from them, or from her
 *   real spots when none are named;
 *   npx tsx scripts/shipwreck-sim.ts --ship=britannic          # her morning
 *   npx tsx scripts/shipwreck-sim.ts --ship=britannic br4 --doors-closed --engines-stopped
 *   add --water for each compartment's fill at each line, --shut to keep
 *   the portholes shut, --every=<s> for the line interval (default 10
 *   minutes, 1 minute for a torpedo ship, 15 minutes in a storm); for a
 *   storm ship --storm=calmer|worse|none (none: still water, no shelter,
 *   to 9:00 PM), --tight (every hatch cover clamped), --no-damage (none of
 *   her damage: no vents, no deck-edge split, no hull openings), --shoal
 *   (she touched Six Fathom Shoal: her real run already holds the graze); and for calibration sweeps (her data
 *   changed for the run): --fail-head=<m> (every cover's failure head),
 *   --leak=<m²> (every cover's leak), --split=<m²> (the deck-edge split,
 *   in all), --vent=<m²> (each broken vent), --sisters=<m>|none (the
 *   group's height), --sisters-at=<h:mm> (its time, PM); for a mine
 *   ship --doors-closed (every watertight door shut) and
 *   --engines-stopped (her engines stopped at the mine: no run for Kea);
 *   for a ship with a drift path --to-sea (drift by `headway.pathToSea`,
 *   the What if "blown out to sea")
 *   npx tsx scripts/shipwreck-sim.ts --ship=concordia          # her real night
 *   npx tsx scripts/shipwreck-sim.ts --ship=concordia --to-sea # blown out to sea
 *   npx tsx scripts/shipwreck-sim.ts --ship=concordia wtc5 wtc6 # What if? these
 *   (her clock is real time: shown time runs 6× once she is aground)
 *   npx tsx scripts/shipwreck-sim.ts --ship=poseidon           # her New Year's Eve
 *   npx tsx scripts/shipwreck-sim.ts --ship=poseidon ballroom vents  # What if? these spots
 *   for a wave ship --wave=real|smaller|ahead (her rogue wave, `spec.wave`:
 *   as it was, the smaller one, or from ahead; her clock is real time)
 */
import { SHIPS, type ShipId } from "../lib/shipwreck/ships";
import {
  type RunOpening,
  type ShipSpec,
  isDeckOpening,
} from "../lib/shipwreck/ships/types";
import {
  FINISHER_SPOT,
  type SimOptions,
  simulate,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../lib/shipwreck/sim/run";
import { sampleTrack } from "../lib/shipwreck/sim/track";

const args = process.argv.slice(2);
const option = (name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const shipId = (option("ship") ?? "titanic") as ShipId;
const base = SHIPS[shipId];
if (!base) throw new Error(`unknown ship ${shipId}`);

/** Her data with the calibration overrides applied (storm ships only). */
function withOverrides(s: ShipSpec): ShipSpec {
  if (s.cause !== "storm") return s;
  const num = (name: string) => {
    const v = option(name);
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`--${name}=<number>, not ${v}`);
    return n;
  };
  const failHead = num("fail-head");
  const leak = num("leak");
  const split = num("split");
  const vent = num("vent");
  const splits = (s.deckOpenings ?? []).filter((d) => d.kind === "split");
  const deckOpenings = (s.deckOpenings ?? []).map((d) => {
    if (d.kind === "hatch")
      return {
        ...d,
        ...(failHead === undefined ? {} : { failHeadM: failHead }),
        ...(leak === undefined ? {} : { areaM2: leak }),
      };
    if (d.kind === "split" && split !== undefined)
      return { ...d, areaM2: split / splits.length };
    if (d.kind === "vent" && vent !== undefined) return { ...d, areaM2: vent };
    return d;
  });
  let storm = s.storm;
  const sisters = option("sisters");
  const at = option("sisters-at");
  if (storm && (sisters !== undefined || at !== undefined)) {
    const [h, m] = (at ?? "").split(":").map(Number);
    const groups =
      sisters === "none"
        ? []
        : (storm.groups ?? []).map((g) => ({
            ...g,
            ...(sisters === undefined ? {} : { heightM: Number(sisters) }),
            ...(at === undefined
              ? {}
              : { t: (h + 12 - 15) * 3600 + (m - 30) * 60 }),
          }));
    storm = { ...storm, groups };
  }
  if (option("storm") === "none")
    return { ...s, deckOpenings, storm: undefined, shelter: undefined };
  return { ...s, deckOpenings, storm };
}
const spec = withOverrides(base);

function clock(t: number): string {
  const s = Math.round(spec.clockStartS + t) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Her clock: real time for a ship whose shown time runs slower aground
 *  or once capsized. */
const when = (e: { t: number; realT: number }) =>
  spec.agroundTimeScale === undefined && spec.capsizeTimeScale === undefined
    ? e.t
    : e.realT;

const storm = spec.cause === "storm";
const showWater = args.includes("--water");
const portholesOpen = !args.includes("--shut");
const first = option("first");
const every = Number(
  option("every") ??
    (spec.cause === "torpedo" || spec.cause === "mine" || spec.cause === "wave"
      ? 60
      : storm
        ? 900
        : 600)
);
const noFinisher = args.includes("--no-finisher");
const named = [
  ...args.filter((a) => !a.startsWith("--")),
  ...(option("spots")?.split(",").filter(Boolean) ?? []),
];
const ids =
  noFinisher && named.length === 0
    ? whatIfRealIds(spec).filter((id) => id !== FINISHER_SPOT)
    : named.filter((id) => !noFinisher || id !== FINISHER_SPOT);
let label =
  spec.cause === "torpedo"
    ? spec.clockStartS < 12 * 3600
      ? "The real morning"
      : "The real afternoon"
    : spec.cause === "mine"
      ? "The real morning"
      : storm
        ? "Her last afternoon"
        : "The real night";
const waveOption = option("wave");
if (waveOption && !["real", "smaller", "ahead"].includes(waveOption))
  throw new Error(`--wave=real|smaller|ahead, not ${waveOption}`);
const wave = (waveOption ?? "real") as NonNullable<SimOptions["wave"]>;
let openings: readonly RunOpening[] =
  spec.wave && wave !== "real"
    ? whatIfOpenings(spec, whatIfRealIds(spec), wave)
    : spec.realNight;
if (first) {
  const n = Number(first);
  const forward = whatIfSpots(spec).slice(-n);
  openings = whatIfOpenings(spec, forward, wave);
  label = `What if: the first ${n} forward (${forward.join(", ")})`;
} else if (ids.length > 0) {
  openings = whatIfOpenings(spec, ids, wave);
  label =
    named.length === 0
      ? `${label}, no later torpedo`
      : `What if: ${ids.join(", ")}`;
}
const stormOption = option("storm");
if (stormOption && !["real", "calmer", "worse", "none"].includes(stormOption))
  throw new Error(`--storm=real|calmer|worse|none, not ${stormOption}`);
const noDamage = args.includes("--no-damage");
// No damage at all: no topside damage and none of her hull openings.
if (noDamage) openings = openings.filter(isDeckOpening);
const opts: SimOptions = {
  portholesOpen,
  storm: (stormOption === "none"
    ? "real"
    : (stormOption ?? "real")) as SimOptions["storm"],
  // Still water: run to 9:00 PM (no shelter to end it).
  ...(stormOption === "none" ? { endT: 5.5 * 3600 } : {}),
  hatchesTight: args.includes("--tight"),
  topsideDamage: !noDamage,
  shoal: args.includes("--shoal"),
  doorsClosed: args.includes("--doors-closed"),
  enginesStopped: args.includes("--engines-stopped"),
  toSea: args.includes("--to-sea"),
  ...(spec.wave ? { wave } : {}),
};
if (spec.wave && wave !== "real")
  label += wave === "smaller" ? ", the smaller wave" : ", the wave from ahead";
if (opts.doorsClosed) label += ", doors closed";
if (opts.enginesStopped) label += ", engines stopped";
if (opts.toSea) label += ", blown out to sea";
if (storm)
  label +=
    (stormOption === "none" ? ", no storm" : `, the ${opts.storm} storm`) +
    (opts.hatchesTight ? ", hatches tight" : "") +
    (opts.topsideDamage ? "" : ", no damage") +
    (opts.shoal ? ", on the shoal" : "");

const t0 = performance.now();
const track = simulate(spec, openings, opts);
const ms = performance.now() - t0;

console.log(
  `${spec.name}: ${label}` +
    (spec.portholes
      ? portholesOpen
        ? ", portholes open"
        : ", portholes shut"
      : "")
);
const hull = openings.filter((o) => !isDeckOpening(o));
const deck = openings.filter(isDeckOpening);
console.log(
  `  openings: ${hull.map((o) => `${o.compartmentId} ${o.areaM2} m²`).join(", ") || "none in the hull"}` +
    ` (total ${hull.reduce((a, o) => a + o.areaM2, 0).toFixed(2)} m²)` +
    (deck.length > 0
      ? `; deck: ${deck.filter((d) => !d.tight).length} leaking, ${deck.filter((d) => d.tight).length} tight`
      : "")
);
console.log(
  `  simulated in ${ms.toFixed(0)} ms, ${track.frames.length} frames\n`
);
console.log("Events:");
for (const e of track.events) {
  const frame = sampleTrack(track, e.t);
  console.log(
    `  ${clock(when(e)).padStart(11)}  ${e.kind}${e.index === undefined ? "" : ` ${e.index}`}` +
      `  (trim ${frame.trimDeg.toFixed(1)}°, list ${frame.listDeg.toFixed(1)}°)`
  );
}
console.log(`\nEvery ${every >= 60 ? `${every / 60} min` : `${every} s`}:`);
const names = spec.compartments.map((c) => c.id);
const lastT = track.brokeAtT ?? track.endT;
for (let t = 0; t <= lastT + 1; t += every) {
  const f = sampleTrack(track, Math.min(t, lastT));
  const whole = f.bodies[0];
  let line =
    `  ${clock(when(f)).padStart(11)}  trim ${f.trimDeg.toFixed(2).padStart(6)}°` +
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
    (track.sankAtT === null
      ? ""
      : `, under at ${clock(when(sampleTrack(track, track.sankAtT)))}`) +
    (track.brokeAtT === null
      ? ", no breakup"
      : `, broke at ${clock(when(sampleTrack(track, track.brokeAtT)))} at x = ${track.breakX?.toFixed(1)} m (${pct?.toFixed(1)}% of LBP from the stern)`)
);
