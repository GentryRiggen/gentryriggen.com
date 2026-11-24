import * as fs from "fs";
import * as path from "path";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { funLiveries } from "@/lib/shipwreck/ships/types";
import { concordiaRecipe } from "../concordiaRecipe";
import { recipeFor } from "../shipModel";
import type { ShipRecipe } from "../titanicRecipe";

/**
 * The Costa Concordia's recipe and each of her fun paints' recipes, frozen
 * by the 1.10 recipe before the Poseidon's cruise kit was lifted out of
 * `concordiaRecipe.ts`: the lift (and anything after it) must leave her
 * placements, layout, hull and paints exactly as they were. Regenerate only
 * on purpose: `UPDATE_RECIPE_SNAPSHOT=1 npx jest concordiaRecipeSnapshot`.
 *
 * Numbers match to 1e-9 (relative, or absolute near zero), everything else
 * exactly, as `titanicRecipeSnapshot`.
 */

const FIXTURE = path.join(__dirname, "fixtures", "concordiaRecipe.json");

/** Every data field of a recipe, the hull sampled, functions dropped. */
function serialize(r: ShipRecipe): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === "spec" || k === "hull" || typeof v === "function") continue;
    out[k] = v;
  }
  const hull: number[][] = [];
  for (let x = r.hull.xMin; x <= r.hull.xMax; x += 3.7) {
    const s = r.hull.section(x);
    hull.push([x, s.zb, s.zt, ...s.hb]);
  }
  out.hull = { xMin: r.hull.xMin, xMax: r.hull.xMax, sections: hull };
  out.deckZ = r.spec.decks.map((d) => [
    r.deckZ(d.name, -100),
    r.deckZ(d.name, 0),
    r.deckZ(d.name, 100),
  ]);
  return JSON.parse(JSON.stringify(out));
}

const TOL = 1e-9;

/** The first place `now` differs from `before` (numbers to TOL), or null. */
function firstDiff(now: unknown, before: unknown, at: string): string | null {
  if (typeof before === "number" && typeof now === "number") {
    const scale = Math.max(1, Math.abs(now), Math.abs(before));
    return Math.abs(now - before) <= TOL * scale
      ? null
      : `${at}: ${now} (1.10: ${before})`;
  }
  if (before === null || typeof before !== "object")
    return now === before
      ? null
      : `${at}: ${JSON.stringify(now)} (1.10: ${JSON.stringify(before)})`;
  if (
    now === null ||
    typeof now !== "object" ||
    Array.isArray(now) !== Array.isArray(before)
  )
    return `${at}: ${JSON.stringify(now)} (1.10: ${JSON.stringify(before)})`;
  const n = now as Record<string, unknown>;
  const b = before as Record<string, unknown>;
  const keys = Object.keys(b);
  const extra = Object.keys(n).filter((k) => !(k in b));
  if (extra.length > 0) return `${at}: new fields ${extra.join(", ")}`;
  for (const k of keys) {
    if (!(k in n)) return `${at}.${k}: missing`;
    const d = firstDiff(n[k], b[k], `${at}.${k}`);
    if (d) return d;
  }
  return null;
}

/** Her real recipe and each fun paint's, by livery id. */
function recipes(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {
    "costa-2012": serialize(concordiaRecipe(concordia)),
  };
  for (const l of funLiveries(concordia))
    out[l.id] = serialize(recipeFor(concordia, l.id));
  return out;
}

describe("the Concordia's recipes", () => {
  const now = recipes();

  if (process.env.UPDATE_RECIPE_SNAPSHOT) {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(now));
  }

  const before = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Record<
    string,
    unknown
  >;

  it("has every paint the fixture has, and no more", () => {
    expect(Object.keys(now).sort()).toEqual(Object.keys(before).sort());
    expect(Object.keys(now).length).toBeGreaterThan(1);
  });

  it.each(Object.keys(now))("%s is the frozen recipe", (id) => {
    expect(firstDiff(now[id], before[id], id)).toBeNull();
  });

  it("is what the model builds for her", () => {
    expect(serialize(recipeFor(concordia))).toEqual(now["costa-2012"]);
  });
});
