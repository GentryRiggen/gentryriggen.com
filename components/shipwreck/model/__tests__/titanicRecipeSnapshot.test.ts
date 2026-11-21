import * as fs from "fs";
import * as path from "path";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { recipeFor } from "../shipModel";
import { titanicRecipe, type ShipRecipe } from "../titanicRecipe";

/**
 * The Titanic's recipe, frozen. The fixture was written by the 1.0 recipe
 * before the Lusitania (1.1) touched any shared model code: every later
 * change must leave the Titanic's placements, layout and hull exactly as
 * they were. Regenerate only on purpose:
 * `UPDATE_RECIPE_SNAPSHOT=1 npx jest titanicRecipeSnapshot`.
 */

const FIXTURE = path.join(__dirname, "fixtures", "titanicRecipe.json");

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

describe("the Titanic's recipe", () => {
  const now = serialize(titanicRecipe(titanic));

  if (process.env.UPDATE_RECIPE_SNAPSHOT) {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(now));
  }

  it("is exactly the 1.0 recipe", () => {
    const before = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    // Field by field first, so a failure names what moved.
    for (const k of Object.keys(before))
      expect([k, now[k]]).toEqual([k, before[k]]);
    expect(Object.keys(now).sort()).toEqual(Object.keys(before).sort());
  });

  it("is what the model builds for her", () => {
    expect(serialize(recipeFor(titanic))).toEqual(now);
  });
});
