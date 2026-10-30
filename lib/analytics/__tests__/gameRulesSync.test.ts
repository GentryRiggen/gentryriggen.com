import { readFileSync } from "node:fs";
import { GAME_EVENTS, TEMPLATE_IDS, type PropSpec } from "../gameEvents";
import { TEMPLATES } from "@/lib/ship-builder/templates";

const rules = readFileSync("firestore.rules", "utf8");

function quotedList(source: string): string[] {
  return [...source.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("firestore.rules stays in step with the game event schema", () => {
  it("lists exactly the registry's template ids", () => {
    const line = rules.match(/p\.template in \[([^\]]*)\]/);
    expect(line).not.toBeNull();
    const inRules = quotedList(line?.[1] ?? "");
    const registry = Object.values(TEMPLATES)
      .flat()
      .map((t) => t.id);
    expect([...inRules].sort()).toEqual([...registry].sort());
    expect([...TEMPLATE_IDS].sort()).toEqual([...registry].sort());
  });

  it("has no free-form string check left for template ids", () => {
    expect(rules).not.toMatch(/template\.matches/);
  });

  it("mentions every enum value of every event prop", () => {
    const gameRules = rules.slice(rules.indexOf("Gameplay analytics"));
    for (const [name, event] of Object.entries(GAME_EVENTS)) {
      expect(gameRules).toContain(`'${name}'`);
      const props: Record<string, PropSpec> = event.props;
      for (const spec of Object.values(props)) {
        if (spec.kind !== "enum") continue;
        for (const value of spec.values) {
          expect(gameRules).toContain(`'${value}'`);
        }
      }
    }
  });

  it("only ever stores enums and whole numbers in props", () => {
    for (const event of Object.values(GAME_EVENTS)) {
      const props: Record<string, PropSpec> = event.props;
      for (const spec of Object.values(props)) {
        expect(["enum", "int"]).toContain(spec.kind);
      }
    }
  });
});
