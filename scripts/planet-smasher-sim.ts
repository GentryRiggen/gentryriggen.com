// Run: npx tsx scripts/planet-smasher-sim.ts [minutes]
// Plays 3 bots x 3 seeds through the real store and prints the scorecard.
import { writeFileSync } from "node:fs";
import { BOT_IDS } from "../lib/planet-smasher/sim/bots";
import {
  METRICS,
  scorecard,
  type Scorecard,
} from "../lib/planet-smasher/sim/scorecard";
import { simulate, type Trace } from "../lib/planet-smasher/sim/simulate";

const SEEDS = [1, 2, 3];
const minutes = Number(process.argv[2]) || 150;

const pad = (x: string | number, w: number) => String(x).padEnd(w);
const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "never");

const traces: Trace[] = [];
for (const bot of BOT_IDS)
  for (const seed of SEEDS) traces.push(simulate({ bot, seed, minutes }));
const card: Scorecard = scorecard(traces);

console.log(
  pad("bot", 11) +
    pad("seed", 5) +
    pad("score", 7) +
    METRICS.map((m) => pad(m.id, 21)).join("") +
    "planets"
);
for (const s of card.scores) {
  const t = traces.find((x) => x.bot === s.bot && x.seed === s.seed)!;
  console.log(
    pad(s.bot, 11) +
      pad(s.seed, 5) +
      pad(s.total.toFixed(1) + (s.capped ? "*" : ""), 7) +
      s.metrics
        .map((m) => pad(fmt(m.value) + (m.gateFailed ? " X" : ""), 21))
        .join("") +
      t.planetsWrecked
  );
}
console.log("\n* capped at 59 (a gate failed); X = gate failed");
for (const [bot, mean] of Object.entries(card.byBot))
  console.log(`${pad(bot, 11)} mean ${mean.toFixed(1)}`);
console.log(`MEAN ${card.mean.toFixed(1)} / 100`);
console.log(
  `Worst metric: ${card.worst.id} (-${card.worst.pointsLost.toFixed(1)} pts avg)`
);

writeFileSync(
  "docs/planet-smasher/sim-latest.json",
  JSON.stringify(
    {
      minutes,
      mean: card.mean,
      byBot: card.byBot,
      worst: card.worst,
      scores: card.scores,
      traces: traces.map((t) => ({
        bot: t.bot,
        seed: t.seed,
        planetsWrecked: t.planetsWrecked,
        allUnlockedSec: t.allUnlockedSec,
        events: t.events,
        stars: t.stars,
      })),
    },
    null,
    1
  ) + "\n"
);
