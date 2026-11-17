import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GAME_EVENTS } from "@/lib/analytics/gameEvents";
import { COLOURS, EYES, FACES, HATS, NECKS, SHAPES } from "../../catalog";
import { FORMS } from "../../forms";
import { MAX_LEVEL, STAGES } from "../../progress";
import { MAX_NAME_LENGTH, RANDOM_NAMES } from "../../catalog";
import { CODE_ALPHABET, CODE_LENGTH } from "../card";
import { ONLINE_NAMES } from "../names";

const rules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

/** The quoted values of `<field> in [ ... ]` in the rules. */
function enumIn(field: string): string[] {
  const match = rules.match(
    new RegExp(`${field.replace(".", "\\.")} in \\[([^\\]]*)\\]`)
  );
  if (!match) throw new Error(`no "${field} in [...]" in firestore.rules`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

describe("firestore.rules stays in sync with the Flamelings catalog", () => {
  it("lists exactly the catalog's look values, with none for the slots", () => {
    expect(enumIn("l.colour")).toEqual([...COLOURS]);
    expect(enumIn("l.shape")).toEqual([...SHAPES]);
    expect(enumIn("l.eyes")).toEqual([...EYES]);
    expect(enumIn("l.hat")).toEqual(["none", ...HATS]);
    expect(enumIn("l.face")).toEqual(["none", ...FACES]);
    expect(enumIn("l.neck")).toEqual(["none", ...NECKS]);
  });

  it("lists exactly the stages and forms", () => {
    expect(enumIn("d.stage")).toEqual(STAGES.map((s) => s.id));
    expect(enumIn("d.form")).toEqual(["none", ...FORMS]);
  });

  it("bounds the level by MAX_LEVEL", () => {
    expect(rules).toContain(
      `d.level is int && d.level >= 1 && d.level <= ${MAX_LEVEL}`
    );
  });

  it("bounds nameId by the length of ONLINE_NAMES", () => {
    expect(rules).toContain(
      `d.nameId is int && d.nameId >= 0 && d.nameId < ${ONLINE_NAMES.length}`
    );
  });

  it("has the code alphabet and length of the client", () => {
    const match = rules.match(/matches\('\^\[([A-Z0-9]+)\]\{(\d+)\}\$'\)/);
    expect(match?.[1]).toBe(CODE_ALPHABET);
    expect(Number(match?.[2])).toBe(CODE_LENGTH);
  });

  it("allows exactly the fl_friend actions of the analytics schema", () => {
    const match = rules.match(/p\.action in \['add', 'playdate', 'visited'\]/);
    expect(match).not.toBeNull();
    const props = GAME_EVENTS.fl_friend.props.action;
    expect(props.values).toEqual(["add", "playdate", "visited"]);
  });
});

describe("ONLINE_NAMES", () => {
  it("has no duplicates, empties or names over the length limit", () => {
    expect(new Set(ONLINE_NAMES.map((n) => n.toLowerCase())).size).toBe(
      ONLINE_NAMES.length
    );
    for (const name of ONLINE_NAMES) {
      expect(name.length).toBeGreaterThan(0);
      expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      expect(name).toMatch(/^[A-Za-z]+$/);
    }
  });

  it("includes every dice-button name", () => {
    for (const name of RANDOM_NAMES) expect(ONLINE_NAMES).toContain(name);
  });

  it("has about 150 names", () => {
    expect(ONLINE_NAMES.length).toBeGreaterThanOrEqual(140);
  });
});
