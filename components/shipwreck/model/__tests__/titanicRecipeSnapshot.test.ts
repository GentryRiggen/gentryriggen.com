import * as fs from "fs";
import * as path from "path";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { fitzgeraldRecipe } from "../fitzgeraldRecipe";
import { lusitaniaRecipe } from "../lusitaniaRecipe";
import { recipeFor } from "../shipModel";
import { titanicRecipe, type ShipRecipe } from "../titanicRecipe";

/**
 * The Titanic's, the Lusitania's and the Fitzgerald's recipes, frozen. The
 * Titanic's fixture
 * was written by the 1.0 recipe before the Lusitania (1.1) touched any
 * shared model code, the Lusitania's by the 1.1 recipe before the
 * Fitzgerald (1.3) did, the Fitzgerald's by the 1.3 recipe before the
 * Carpathia and the Britannic touched it: every later change must leave their placements,
 * layout and hull exactly as they were. Regenerate only on purpose:
 * `UPDATE_RECIPE_SNAPSHOT=1 npx jest titanicRecipeSnapshot`.
 *
 * Numbers match to 1e-9 (relative, or absolute near zero), everything else
 * exactly: the fixture was written on one machine, and Math and trig results
 * differ in the last bit across V8 versions and OSes. The recipe is plain
 * geometry with no feedback, so a real change moves it far more than that.
 */

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

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
      : `${at}: ${now} (1.0: ${before})`;
  }
  if (before === null || typeof before !== "object")
    return now === before
      ? null
      : `${at}: ${JSON.stringify(now)} (1.0: ${JSON.stringify(before)})`;
  if (
    now === null ||
    typeof now !== "object" ||
    Array.isArray(now) !== Array.isArray(before)
  )
    return `${at}: ${JSON.stringify(now)} (1.0: ${JSON.stringify(before)})`;
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

const SHIPS: [string, ShipSpec, (s: ShipSpec) => ShipRecipe, string][] = [
  ["Titanic", titanic, titanicRecipe, "titanicRecipe.json"],
  ["Lusitania", lusitania, lusitaniaRecipe, "lusitaniaRecipe.json"],
  ["Fitzgerald", fitzgerald, fitzgeraldRecipe, "fitzgeraldRecipe.json"],
];

describe.each(SHIPS)("the %s's recipe", (_name, spec, make, file) => {
  const now = serialize(make(spec));
  const FIXTURE = fixture(file);

  if (process.env.UPDATE_RECIPE_SNAPSHOT) {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(now));
  }

  it("is the frozen recipe", () => {
    const before = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    expect(firstDiff(now, before, "recipe")).toBeNull();
  });

  it("is what the model builds for her", () => {
    expect(serialize(recipeFor(spec))).toEqual(now);
  });
});
