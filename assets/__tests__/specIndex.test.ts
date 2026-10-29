import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as rules from "../../scripts/assets/measureRules.mjs";

const isPristine = (
  rules as unknown as {
    isPristine: (spec: unknown) => boolean;
  }
).isPristine;

const PARTS_DIR = join(__dirname, "..", "parts");

interface Spec {
  id: string;
  script: string;
  slots: string[];
  slotColors?: Record<string, { color: string }>;
  scoreVariant: string;
  variants: {
    name: string;
    expectedBounds: { min: number[]; max: number[] };
  }[];
  views: { name: string }[];
  generated?: string;
}

const files = readdirSync(PARTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();
const specs = files.map(
  (f) => [f, JSON.parse(readFileSync(join(PARTS_DIR, f), "utf8"))] as const
);

describe("assets/parts/index.ts", () => {
  it("imports every spec json, and only those", () => {
    const source = readFileSync(join(PARTS_DIR, "index.ts"), "utf8");
    const imported = [...source.matchAll(/from "\.\/([^"]+\.json)"/g)].map(
      (m) => m[1]
    );
    expect(imported.sort()).toEqual(files);
  });
});

describe.each(specs)("spec %s", (file, spec: Spec) => {
  it("is named by its file and has a real scoring variant", () => {
    expect(file).toBe(`${spec.id}.json`);
    expect(spec.variants.map((v) => v.name)).toContain(spec.scoreVariant);
    expect(spec.views.map((v) => v.name)).toContain("three-quarter");
  });

  it("is not marked generated after someone edited it", () => {
    // `assets:measure --refresh-skeletons` rewrites a spec that still carries
    // a matching `generated` marker. If you edited this spec by hand, delete
    // its "generated" line.
    if ("generated" in spec) expect(isPristine(spec)).toBe(true);
  });

  it("has a non-empty expected box", () => {
    for (const { expectedBounds: b } of spec.variants) {
      for (let i = 0; i < 3; i++) expect(b.max[i]).toBeGreaterThan(b.min[i]);
    }
  });

  it("gives every slot a colour when it lists colours", () => {
    if (!spec.slotColors) return;
    expect(Object.keys(spec.slotColors).sort()).toEqual([...spec.slots].sort());
  });
});
