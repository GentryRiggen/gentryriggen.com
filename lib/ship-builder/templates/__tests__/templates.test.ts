import { validateShip } from "../../model/placement";
import { SHIP_KINDS } from "../../model/kinds";
import { parseShip } from "../../persist/schema";
import { TEMPLATES, findTemplate } from "..";

const ALL = SHIP_KINDS.flatMap((kind) => TEMPLATES[kind]);

describe("ship templates", () => {
  it("have unique ids", () => {
    const ids = ALL.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each builds a valid ship of its kind that round-trips the schema", () => {
    for (const template of ALL) {
      const ship = template.build();
      expect(ship.kind).toBe(template.kind);
      expect(ship.name).toBe(template.name);
      expect([template.id, validateShip(ship)]).toEqual([
        template.id,
        { ok: true },
      ]);
      expect(parseShip(JSON.parse(JSON.stringify(ship)))).toEqual({
        ok: true,
        ship,
      });
    }
  });

  it("builds a fresh ship each time", () => {
    for (const template of ALL) {
      expect(template.build()).not.toBe(template.build());
    }
  });

  it("finds templates by id", () => {
    for (const template of ALL) {
      expect(findTemplate(template.id)).toBe(template);
    }
    expect(findTemplate("nope")).toBeUndefined();
  });
});
