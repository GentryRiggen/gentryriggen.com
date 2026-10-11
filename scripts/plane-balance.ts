// Run: npx tsx scripts/plane-balance.ts
import { LEVEL_ORDER } from "../lib/plane-builder/levels";
import { playLevel } from "../lib/plane-builder/balance/pilot";

for (const id of LEVEL_ORDER) {
  const log = playLevel(id);
  console.log(`\n${id}: ${log.length} flights`);
  log.forEach((f, i) =>
    console.log(
      `${String(i + 1).padStart(2)}  ${Math.round(f.distance).toString().padStart(5)} m  +${f.earned}  (cheapest ${f.cheapest ?? "-"})`
    )
  );
}
