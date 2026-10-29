/** Spec and part-id lookups shared by the asset scripts. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export function specPath(id) {
  return join(ROOT, "assets", "parts", `${id}.json`);
}

/** Every committed spec, keyed by spec id. */
export function readSpecs() {
  const dir = join(ROOT, "assets", "parts");
  const specs = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const spec = JSON.parse(readFileSync(join(dir, file), "utf8"));
    specs[spec.id] = spec;
  }
  return specs;
}

/**
 * The spec and variant behind a part id: the spec with that id (its scoring
 * variant), else the spec listing the id as a variant. Null for a new part.
 */
export function resolvePart(id, specs = readSpecs()) {
  if (specs[id]) return { specId: id, variant: specs[id].scoreVariant };
  for (const spec of Object.values(specs)) {
    if (spec.variants.some((v) => v.name === id)) {
      return { specId: spec.id, variant: id };
    }
  }
  return null;
}

/** Every Ship Builder part type, read from lib/ship-builder/model/types.ts. */
export function allPartTypes() {
  const source = readFileSync(
    join(ROOT, "lib", "ship-builder", "model", "types.ts"),
    "utf8"
  );
  const list = (name) => {
    const match = source.match(
      new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`)
    );
    if (!match) throw new Error(`cannot find ${name} in types.ts`);
    return [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
  };
  const pirate = list("PIRATE_PART_TYPES");
  return list("PART_TYPES").concat(pirate);
}

/** True when the glb for a spec variant is in the work dir. */
export function hasGlb(specId, variant) {
  return existsSync(join(ROOT, "assets", "out", specId, `${variant}.glb`));
}
