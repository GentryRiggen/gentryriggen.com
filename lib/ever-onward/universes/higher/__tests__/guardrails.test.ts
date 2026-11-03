import fs from "node:fs";
import path from "node:path";
import { visitorHereFlag } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import { higherBots } from "../bots";
import { ENDING_STORY_IDS } from "../story";
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

describe("Build It Higher guardrails", () => {
  it("imports nothing from lib/analytics", () => {
    const dirs = [
      "lib/ever-onward/universes/higher",
      "components/ever-onward/scenes/higher",
      "components/ever-onward/game/higher",
    ].map((d) => path.join(ROOT, d));
    const files = [
      ...dirs.flatMap(filesUnder),
      path.join(ROOT, "components/ever-onward/universes/higher.tsx"),
    ];
    expect(files.length).toBeGreaterThan(20);
    for (const f of files)
      expect(fs.readFileSync(f, "utf8")).not.toMatch(/analytics/);
  });

  it("counts no people", () =>
    expect(
      def.resources.filter((r) =>
        /people|population|resident|town folk|crowd/i.test(r.label + r.id)
      )
    ).toEqual([]));

  it("keeps every line gentle: nobody is hurt, and nobody is scared", () => {
    const lines = [
      ...def.story.map((m) => m.text),
      ...def.phases.flatMap((p) => [
        p.intro ?? "",
        p.goal ?? "",
        ...(p.cutscene ?? []).map((f) => f.text),
        ...(p.tips ?? []),
      ]),
      ...(def.visitors ?? []).map((v) => v.name),
    ];
    expect(lines.length).toBeGreaterThan(80);
    expect(
      lines.filter((text) =>
        /\b(die[sd]?|dead|death|kill\w*|hurt|scared|scary|blood|crash\w*|collaps\w*)\b/i.test(
          text
        )
      )
    ).toEqual([]);
  });

  it("has no gambling, betting or stock-market talk in any name or line", () => {
    const words = [
      ...def.upgrades.flatMap((u) => [u.name, u.description]),
      ...def.projects!.flatMap((p) => [p.name, p.description]),
      ...def.resources.map((r) => r.label),
      ...def.story.map((m) => m.text),
    ];
    expect(
      words.filter((w) =>
        /\b(gambl\w*|bet|bets|betting|wager|casino|lottery|jackpot|dice|stocks?|stock market|odds|invest(or|ors|ment)?)\b/i.test(
          w
        )
      )
    ).toEqual([]);
  });

  it("tells the empty streets only in story lines, never in a label or a number", () => {
    const labels = [
      ...def.resources.map((r) => r.label),
      ...def.upgrades.map((u) => u.name),
    ];
    expect(
      labels.filter((w) =>
        /\b(moved?|moving|relocat\w*|empty|vacated|abandon\w*|left behind)\b/i.test(
          w
        )
      )
    ).toEqual([]);
    expect(
      def.story.filter((m) =>
        /\b\d+\s*(people|residents|families|towns|villages)\b/i.test(m.text)
      )
    ).toEqual([]);
  });

  it("ends the run in the last phase and nowhere else", () => {
    for (const i of [0, 1, 2]) expect(runAtPhaseStart(i).complete).toBe(false);
    const end = simulate(def, {
      strategy: higherBots().tapper,
      maxSeconds: 8 * 3600,
    });
    expect(end.finished).toBe(true);
    expect(end.finalRun.phase).toBe(3);
  });

  describe("the story", () => {
    const ids = def.story.map((m) => m.id);

    it("has unique ids and plain text", () => {
      expect(new Set(ids).size).toBe(ids.length);
      for (const m of def.story)
        expect(m.text.trim().length).toBeGreaterThan(20);
    });

    it("gives every visitor a line with the same id, in the visitor's phase", () => {
      for (const v of def.visitors ?? []) {
        const line = def.story.find((m) => m.id === v.id);
        expect([v.id, line?.phase]).toEqual([v.id, v.phase]);
      }
    });

    it("has every closing line, and fires them when the kid arrives", () => {
      for (const id of ENDING_STORY_IDS) expect(ids).toContain(id);
      const end = simulate(def, {
        strategy: higherBots().tapper,
        maxSeconds: 8 * 3600,
      }).finalRun;
      expect(end.flags[visitorHereFlag("kid-on-the-grass")]).toBe(true);
      for (const id of ENDING_STORY_IDS) expect(end.story).toContain(id);
    });

    it("fires plenty of lines in every part of a normal run", () => {
      const end = simulate(def, {
        strategy: higherBots().realistic,
        maxSeconds: 8 * 3600,
      }).finalRun;
      for (const phase of def.phases) {
        const fired = def.story.filter(
          (m) => m.phase === phase.id && end.story.includes(m.id)
        );
        expect([phase.id, fired.length >= 14]).toEqual([phase.id, true]);
      }
    });
  });
});
