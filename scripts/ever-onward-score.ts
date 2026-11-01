// Run: npx tsx scripts/ever-onward-score.ts [--json]
// Plays Keep the Light On with every bot and prints the Engagement Scorecard.
import {
  formatCurve,
  type PhaseClicks,
} from "../lib/ever-onward/engine/clicks";
import { scoreUniverse, type Scorecard } from "../lib/ever-onward/engine/score";
import { lightBots } from "../lib/ever-onward/universes/light/bots";
import { lightUniverse } from "../lib/ever-onward/universes/light";

const pad = (text: string, width: number): string =>
  text.length >= width ? text : text + " ".repeat(width - text.length);

function print(card: Scorecard): void {
  console.log(
    `Engagement score: ${card.total.toFixed(1)} / 100` +
      (card.isCapped
        ? `  (capped from ${card.uncapped.toFixed(1)}: a gate failed)`
        : "")
  );
  console.log(
    `Worst metric: ${card.worstMetric.id} ${card.worstMetric.name} (-${card.worstMetric.pointsLost.toFixed(1)} pts)`
  );
  console.log(
    `Worst phase:  ${card.worstPhase.id} (${(card.worstPhase.score * 100).toFixed(0)}%)`
  );
  console.log(`Runtime: ${(card.runtimeMs / 1000).toFixed(1)} s\n`);

  console.log(
    pad("metric", 28) +
      pad("sub", 6) +
      pad("pts", 11) +
      pad("gate", 6) +
      "values"
  );
  for (const m of card.metrics) {
    console.log(
      pad(`${m.id} ${m.name}`, 28) +
        pad(m.score.toFixed(2), 6) +
        pad(`${m.points.toFixed(1)}/${m.weight}`, 11) +
        pad(m.gatePass ? "ok" : "FAIL", 6) +
        `band: ${m.band}`
    );
    for (const p of m.perPhase)
      console.log(
        `      ${pad(p.phase, 7)}${pad(p.sub.toFixed(2), 6)}${pad(
          p.gate ? "" : "FAIL",
          6
        )}${p.headline}`
      );
  }

  console.log("\nPhases");
  for (const p of card.phases)
    console.log(
      `  ${pad(p.id, 8)}${pad(`${p.minutes.toFixed(0)} min`, 9)}${(p.score * 100).toFixed(0)}%`
    );
  if (card.failingGates.length > 0) {
    console.log("\nFailing gates");
    for (const gate of card.failingGates) console.log(`  ${gate}`);
  }
  const curves: [string, PhaseClicks[] | null][] = [
    ["eager (3 taps/s, easing to 1/s by min 6)", card.clicks.eager],
    ["taps when it helps", card.clicks.helps],
  ];
  for (const [label, curve] of curves) {
    if (!curve) continue;
    console.log(`\nManual share by minute of each phase, ${label}`);
    for (const line of formatCurve(curve)) console.log(`  ${line}`);
    console.log(
      `  taps/min from min 6: ${curve
        .map((p) => `${p.phase} ${p.lateTapsPerMinute.toFixed(0)}`)
        .join(", ")}; other clicks/min: ${curve
        .map((p) => `${p.phase} ${p.lateActionsPerMinute.toFixed(1)}`)
        .join(", ")}`
    );
  }
  const hours = (s: number | null) =>
    s === null ? "no finish" : `${(s / 3600).toFixed(2)} h`;
  const { runs } = card;
  console.log(
    `\nFinish: eager ${hours(runs.tapperFinish)}, when it helps ${hours(runs.realisticFinish)}, idle ${hours(runs.idleFinish)}, run 2 ${hours(runs.run2Finish)}, run 3 ${hours(runs.run3Finish)}`
  );
}

const card = scoreUniverse(lightUniverse, { bots: lightBots() });
if (process.argv.includes("--json")) console.log(JSON.stringify(card, null, 2));
else print(card);
