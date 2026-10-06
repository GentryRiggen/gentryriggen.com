/**
 * Saved-ship fixture corpus.
 *
 * Attach point ids (`davit:x:z`, `uw:side:cell`, `mast-fore`, ...) and the
 * grid geometry behind them are part of the SAVE FORMAT (see the comment above
 * CURRENT_VERSION in ../schema.ts). The model files that generate them can't
 * carry that warning themselves, so this test enforces it: every fixture here
 * is a save a player could have, and each must still load with no part
 * dropped and with the same stats. If a change to attach ids, geometry,
 * placement rules or stats formulas breaks this test, either revert it or add
 * a schema migration and regenerate the fixtures on purpose.
 *
 * Layout (see __fixtures__/README.md):
 *   templates/<id>.json   every template, serialised as a save stores it
 *   legacy/<name>.json    hand-built ships at schema versions v1..v6 (v6 has bulkheads)
 *   share/<name>.txt      share-link payloads (the text after `#ship=`)
 *   <name>.expected.json  part count and key stats beside each fixture
 *
 * Regenerate templates, share links and expectations after an intended change:
 *   UPDATE_FIXTURES=1 npx jest fixtures
 * The legacy ship JSON is hand-authored and never regenerated. Without the
 * flag this test only compares.
 */
import fs from "fs";
import path from "path";
import { compressToEncodedURIComponent } from "lz-string";
import { computeStats } from "../../model/stats";
import type { Ship } from "../../model/types";
import { TEMPLATES } from "../../templates";
import { CURRENT_VERSION, parseShip } from "../schema";
import { decodeShareHash, encodeShip } from "../share";

const ROOT = path.join(__dirname, "..", "__fixtures__");
const IS_UPDATING = process.env.UPDATE_FIXTURES === "1";
const ALL_TEMPLATES = Object.values(TEMPLATES).flat();
/** Templates also kept as share links, plus one legacy ship in an old format. */
const SHARED_TEMPLATE_IDS = ["titanic", "wonder-of-the-seas"];
const SHARED_LEGACY = "v4-cruise";

interface Expected {
  parts: number;
  stats: {
    passengers: number;
    crew: number;
    lifeboatSeats: number;
    teu: number;
    grossTonnage: number;
    topSpeedKnots: number;
    stability: string;
    stabilityRatio: number;
  };
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function summarise(ship: Ship): Expected {
  const stats = computeStats(ship);
  return {
    parts: ship.parts.length,
    stats: {
      passengers: stats.passengers.total,
      crew: stats.crew,
      lifeboatSeats: stats.lifeboatSeats,
      teu: stats.teu,
      grossTonnage: round(stats.grossTonnage),
      topSpeedKnots: round(stats.topSpeedKnots),
      stability: stats.stability,
      stabilityRatio: round(stats.stabilityRatio),
    },
  };
}

function fixturePath(dir: string, name: string, extension: string): string {
  return path.join(ROOT, dir, `${name}${extension}`);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeFile(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** One part per line keeps diffs readable and files small. */
function formatShip(ship: Ship): string {
  const { parts, ...rest } = ship;
  const head = JSON.stringify(rest);
  const lines = parts.map((part) => `    ${JSON.stringify(part)}`);
  return `${head.slice(0, -1)},"parts":[\n${lines.join(",\n")}\n]}\n`;
}

function writeExpected(dir: string, name: string, ship: Ship): void {
  writeFile(
    fixturePath(dir, name, ".expected.json"),
    `${JSON.stringify(summarise(ship), null, 2)}\n`
  );
}

function loadFixture(dir: string, name: string): Ship {
  const result = parseShip(readJson(fixturePath(dir, name, ".json")));
  if (!result.ok) throw new Error(`${dir}/${name}: ${result.error}`);
  expect(result.dropped).toBe(0);
  return result.ship;
}

function fixtureNames(dir: string, extension: string): string[] {
  const folder = path.join(ROOT, dir);
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(extension) && !file.includes(".expected."))
    .map((file) => file.slice(0, -extension.length))
    .sort();
}

function templateShip(id: string): Ship {
  const template = ALL_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`No template ${id}`);
  return template.build();
}

function regenerate(): void {
  for (const template of ALL_TEMPLATES) {
    const ship = template.build();
    writeFile(fixturePath("templates", template.id, ".json"), formatShip(ship));
    writeExpected("templates", template.id, ship);
  }
  for (const name of fixtureNames("legacy", ".json")) {
    writeExpected("legacy", name, loadFixture("legacy", name));
  }
  for (const id of SHARED_TEMPLATE_IDS) {
    const ship = templateShip(id);
    writeFile(fixturePath("share", id, ".txt"), `${encodeShip(ship)}\n`);
    writeExpected("share", id, ship);
  }
  // An old link carries an old-format ship: compress the legacy JSON as is.
  const legacy = readJson(fixturePath("legacy", SHARED_LEGACY, ".json"));
  writeFile(
    fixturePath("share", `legacy-${SHARED_LEGACY}`, ".txt"),
    `${compressToEncodedURIComponent(JSON.stringify(legacy))}\n`
  );
  writeExpected(
    "share",
    `legacy-${SHARED_LEGACY}`,
    loadFixture("legacy", SHARED_LEGACY)
  );
}

if (IS_UPDATING) regenerate();

describe("saved-ship fixtures", () => {
  it("has a fixture for every template", () => {
    expect(fixtureNames("templates", ".json")).toEqual(
      ALL_TEMPLATES.map((t) => t.id).sort()
    );
  });

  describe.each(ALL_TEMPLATES.map((t) => t.id))("template %s", (id) => {
    it("is stored exactly as a save of the template would be", () => {
      const stored = readJson(fixturePath("templates", id, ".json"));
      expect(stored).toEqual(JSON.parse(JSON.stringify(templateShip(id))));
    });

    it("loads in full with the expected stats", () => {
      const ship = loadFixture("templates", id);
      expect(summarise(ship)).toEqual(
        readJson(fixturePath("templates", id, ".expected.json"))
      );
    });
  });

  describe("older schema versions", () => {
    const names = fixtureNames("legacy", ".json");

    it("covers every version from v1 to v5", () => {
      const versions = names.map(
        (name) => (readJson(fixturePath("legacy", name, ".json")) as Ship).v
      );
      expect(versions.sort()).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    });

    it("keeps a v6 ship's bulkheads", () => {
      expect(loadFixture("legacy", "v6-bulkheads").hull.bulkheads).toEqual([
        { at: 2, height: "low" },
        { at: 4, height: "waterline" },
        { at: 6, height: "deck" },
      ]);
    });

    it.each(names)("%s loads in full with the expected stats", (name) => {
      const ship = loadFixture("legacy", name);
      expect(ship.v).toBe(CURRENT_VERSION);
      expect(summarise(ship)).toEqual(
        readJson(fixturePath("legacy", name, ".expected.json"))
      );
    });
  });

  describe("share links", () => {
    it.each(fixtureNames("share", ".txt"))(
      "%s decodes in full with the expected stats",
      (name) => {
        const encoded = fs
          .readFileSync(fixturePath("share", name, ".txt"), "utf8")
          .trim();
        const result = decodeShareHash(`#ship=${encoded}`);
        if (result.kind !== "ok") throw new Error(`${name}: ${result.kind}`);
        expect(result.dropped).toBe(0);
        expect(summarise(result.ship)).toEqual(
          readJson(fixturePath("share", name, ".expected.json"))
        );
      }
    );

    it("keeps one link per shared template and one old-format link", () => {
      expect(fixtureNames("share", ".txt")).toEqual(
        [...SHARED_TEMPLATE_IDS, `legacy-${SHARED_LEGACY}`].sort()
      );
    });
  });
});
