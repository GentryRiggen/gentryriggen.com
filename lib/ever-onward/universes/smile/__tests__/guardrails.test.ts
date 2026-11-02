import fs from "node:fs";
import path from "node:path";
import { newRun } from "../../../engine/engine";
import { narrationLines } from "../../../narration/lines";
import { def, runAtPhaseStart } from "./fixtures";

const ROOT = path.resolve(__dirname, "../../../../..");

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : filesUnder(full);
    return [full];
  });
}

const SOURCE_DIRS = [
  "lib/ever-onward/universes/smile",
  "components/ever-onward/scenes/smile",
  "components/ever-onward/game/smile",
].map((d) => path.join(ROOT, d));

const SOURCE_FILES = [
  ...SOURCE_DIRS.flatMap(filesUnder),
  path.join(ROOT, "components/ever-onward/universes/smile.tsx"),
  path.join(ROOT, "components/ever-onward/audio/smileScores.ts"),
];

describe("Make Everyone Smile guardrails", () => {
  it("imports nothing from lib/analytics", () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(20);
    for (const f of SOURCE_FILES)
      expect(fs.readFileSync(f, "utf8")).not.toMatch(/analytics/);
  });

  it("never says people, population or residents in a resource label", () =>
    expect(
      def.resources.filter((r) =>
        /people|population|resident/i.test(r.label + r.id)
      )
    ).toEqual([]));

  it("keeps every story line gentle: nobody is hurt", () =>
    expect(
      def.story.filter((m) =>
        /\b(die|dead|death|kill|hurt|scared|blood|bleed|weapon|afraid)\b/i.test(
          m.text
        )
      )
    ).toEqual([]));

  it("has a real story: dozens of lines, in every part, each one voiced", () => {
    expect(def.story.length).toBeGreaterThan(55);
    for (const phase of def.phases)
      expect(
        def.story.filter((m) => m.phase === phase.id).length
      ).toBeGreaterThan(12);
    const voiced = new Set(narrationLines().map((l) => l.id));
    for (const m of def.story) expect(voiced.has(`smile/${m.id}`)).toBe(true);
  });

  it("gives every story line a unique id and some text", () => {
    const ids = def.story.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of def.story) expect(m.text.length).toBeGreaterThan(30);
  });

  it("ends the run in the last phase and nowhere else", () => {
    for (const i of [0, 1, 2]) expect(runAtPhaseStart(i).complete).toBe(false);
    expect(def.isComplete(newRun(def))).toBe(false);
    expect(def.isComplete(runAtPhaseStart(2))).toBe(false);
  });

  it("turns the tone: the world's words are wry, the quiet's are tender", () => {
    const world = def.story.filter((m) => m.phase === "world");
    expect(world.some((m) => /nice day/i.test(m.text))).toBe(true);
    const quiet = def.story.filter((m) => m.phase === "quiet");
    expect(quiet.some((m) => /smile/i.test(m.text))).toBe(true);
  });

  describe("styles", () => {
    const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    const marker = "/* ---- Make Everyone Smile";
    const block = css.slice(css.indexOf(marker));

    it("appends its CSS in one block at the very end of the file", () => {
      expect(css.indexOf(marker)).toBeGreaterThan(0);
      expect(css.indexOf(marker)).toBe(css.lastIndexOf(marker));
      expect(block.match(/@keyframes (?!ms-)/g)).toBeNull();
      expect(block.match(/\n\.(?!ms-)[a-z]/g)).toBeNull();
    });

    it("covers every ms- class with a prefers-reduced-motion rule", () => {
      const reduced = block.slice(
        block.indexOf("@media (prefers-reduced-motion: reduce)")
      );
      const classes = [
        ...new Set(
          [...block.matchAll(/^\.(ms-[a-z-]+)\s*\{/gm)].map((m) => m[1])
        ),
      ];
      expect(classes.length).toBeGreaterThan(25);
      for (const name of classes)
        expect([name, reduced.includes(`.${name}`)]).toEqual([name, true]);
    });

    it("uses every ms- class it defines somewhere in the picture", () => {
      const used = SOURCE_FILES.filter((f) => /\.tsx$/.test(f))
        .map((f) => fs.readFileSync(f, "utf8"))
        .join("\n");
      const classes = [
        ...new Set(
          [...block.matchAll(/^\.(ms-[a-z-]+)\s*\{/gm)].map((m) => m[1])
        ),
      ];
      const unused = classes.filter((name) => !used.includes(name));
      expect(unused).toEqual([]);
    });
  });

  describe("type", () => {
    it("never sets pixel text under 10 px", () => {
      for (const f of SOURCE_FILES.filter((p) => /\.tsx$/.test(p))) {
        const source = fs.readFileSync(f, "utf8");
        expect(source).not.toMatch(/text-\[[0-9]px\]/);
        for (const m of source.matchAll(/fontSize=\{(\d+)\}/g))
          expect(Number(m[1])).toBeGreaterThanOrEqual(10);
      }
    });
  });
});
