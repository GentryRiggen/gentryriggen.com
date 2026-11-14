import { newRun, tick } from "../engine";
import {
  activeArtifacts,
  artifactAt,
  choices,
  freshRun,
  hasKeepsake,
  lastSquare,
  mapOf,
  newMapState,
  parseSquare,
  pendingFind,
  squareChanges,
  squareKey,
  stepMap,
  toggleArtifact,
} from "../map";
import { newUniverseSave, startOver } from "../prestige";
import { parseSave } from "../save";
import type { MapDef, RunState, UniverseDef, UniverseSave } from "../types";
import { fixture } from "./fixtures";

const glyph = ["A"];
const MAP: MapDef = {
  cols: 3,
  rows: 3,
  title: "Test chart",
  rightLabel: "Next door",
  downLabel: "Within",
  columns: [
    { text: "" },
    {
      text: "Faster",
      apply: (r) => void (r.mods.mult = (r.mods.mult ?? 1) * 2),
    },
    { text: "Head start", apply: (r) => void (r.resources.coins += 5) },
  ],
  rowChanges: [{ text: "" }, { text: "A dream" }, { text: "Deeper" }],
  artifacts: [
    {
      id: "gem",
      x: 1,
      y: 0,
      name: "Gem",
      effect: "Triples everything.",
      tier: "big",
      glyph,
      palette: { A: "#fff" },
      spot: { x: 0, y: 0, scale: 1 },
      apply: (r) => void (r.mods.mult = (r.mods.mult ?? 1) * 3),
    },
    {
      id: "thorn",
      x: 0,
      y: 1,
      name: "Thorn",
      effect: "Ten coins to start.",
      catch: "Everything is slower.",
      tier: "odd",
      glyph,
      palette: { A: "#fff" },
      spot: { x: 0, y: 0, scale: 1 },
      apply: (r) => {
        r.resources.coins += 10;
        r.mods.mult = (r.mods.mult ?? 1) * 0.5;
      },
    },
  ],
  tint: "#000",
  keepsake: { name: "Keepsake", glyph, palette: { A: "#fff" } },
};
const def: UniverseDef = { ...fixture, map: MAP };

function finished(run: RunState): RunState {
  let r = tick(
    def,
    { ...run, resources: { ...run.resources, total: 100 } },
    0.1
  );
  r = { ...r, resources: { ...r.resources, glow: 300 } };
  return tick(def, r, 0.1);
}

const at = (save: UniverseSave, key: string): UniverseSave => ({
  ...save,
  map: { ...mapOf(def, save), at: key },
  run: freshRun(def, { ...save, map: { ...mapOf(def, save), at: key } }),
});

const done = (save: UniverseSave): UniverseSave => ({
  ...save,
  run: { ...finished(save.run), time: 50 },
});

describe("map", () => {
  it("keys squares and reads them back", () => {
    expect(squareKey(2, 1)).toBe("2,1");
    expect(parseSquare("2,1")).toEqual({ x: 2, y: 1 });
    expect(parseSquare("a,1")).toBeNull();
    expect(parseSquare("1")).toBeNull();
    expect(lastSquare(MAP)).toBe("2,2");
  });

  it("new saves for map universes start on the first square", () => {
    const save = newUniverseSave(def);
    expect(save.map).toEqual(newMapState());
    expect(save.map!.at).toBe("0,0");
    expect(newUniverseSave(fixture).map).toBeUndefined();
  });

  it("the start square changes nothing", () => {
    const save = newUniverseSave(def);
    expect(freshRun(def, save)).toEqual(newRun(def, {}));
  });

  it("names a square's changes, column then row", () => {
    expect(squareChanges(def, "0,0")).toEqual([]);
    expect(squareChanges(def, "1,2").map((c) => c.text)).toEqual([
      "Faster",
      "Deeper",
    ]);
  });

  it("applies the square's changes and depth to the run", () => {
    const run = freshRun(def, at(newUniverseSave(def), "2,1"));
    expect(run.resources.coins).toBe(5);
    expect(run.mods.depth).toBe(1);
  });

  it("offers right and down ahead, and every visited square back", () => {
    const state = { ...newMapState(), visited: ["0,0", "1,0"], at: "1,0" };
    expect(choices(def, state)).toEqual({
      ahead: ["2,0", "1,1"],
      back: ["0,0", "1,0"],
    });
    expect(choices(def, { ...state, at: "2,2" }).ahead).toEqual([]);
  });

  it("a finished run steps on, finds the artifact and counts the run", () => {
    let save = done(at(newUniverseSave(def), "1,0"));
    expect(pendingFind(def, save)?.id).toBe("gem");
    save = stepMap(def, save, "2,0");
    expect(save.map).toEqual({
      at: "2,0",
      visited: ["1,0"],
      found: ["gem"],
      off: [],
    });
    expect(save.completions).toBe(1);
    expect(save.best).toBe(50);
    expect(save.run.complete).toBe(false);
    expect(save.run.mods.mult).toBe(3);
    expect(save.run.flags["art:gem"]).toBe(true);
    expect(pendingFind(def, save)).toBeUndefined();
  });

  it("never finds the same artifact twice", () => {
    let save = done(at(newUniverseSave(def), "1,0"));
    save = stepMap(def, save, "1,0");
    save = stepMap(def, done(save), "1,0");
    expect(save.map!.found).toEqual(["gem"]);
    expect(save.map!.visited).toEqual(["1,0"]);
    expect(pendingFind(def, done(save))).toBeUndefined();
  });

  it("stepMap ignores illegal targets and unfinished runs", () => {
    const fresh = at(newUniverseSave(def), "1,0");
    expect(stepMap(def, fresh, "2,0")).toBe(fresh);
    const finishedSave = done(fresh);
    expect(stepMap(def, finishedSave, "2,2")).toBe(finishedSave);
    expect(stepMap(def, finishedSave, "0,0")).toBe(finishedSave);
    expect(stepMap(def, finishedSave, "9,9")).toBe(finishedSave);
  });

  it("can go back to any visited square", () => {
    let save = stepMap(def, done(newUniverseSave(def)), "1,0");
    save = stepMap(def, done(save), "0,0");
    expect(save.map!.at).toBe("0,0");
    expect(save.map!.visited).toEqual(["0,0", "1,0"]);
  });

  it("marks the map done when a run finishes on the last square", () => {
    const save = stepMap(def, done(at(newUniverseSave(def), "2,2")), "2,2");
    expect(save.map!.done).toBe(true);
  });

  it("switches off only found artifacts with a catch, from the next run", () => {
    // Not found yet (the run on its square hasn't finished): no switch.
    const unfinished = at(newUniverseSave(def), "0,1");
    expect(toggleArtifact(def, unfinished, "thorn")).toBe(unfinished);
    let save = done(unfinished);
    save = stepMap(def, save, "0,1");
    expect(save.run.resources.coins).toBe(10);
    const off = toggleArtifact(def, save, "thorn");
    expect(off.map!.off).toEqual(["thorn"]);
    expect(off.run).toBe(save.run);
    expect(activeArtifacts(def, off.map!)).toEqual([]);
    expect(toggleArtifact(def, off, "thorn").map!.off).toEqual([]);
    const withGem = { ...save, map: { ...save.map!, found: ["thorn", "gem"] } };
    expect(toggleArtifact(def, withGem, "gem")).toBe(withGem);
  });

  it("finds artifacts by square", () => {
    expect(artifactAt(def, "1,0")?.id).toBe("gem");
    expect(artifactAt(def, "0,0")).toBeUndefined();
  });

  it("keepsake keeps old levels", () => {
    const save = { ...newUniverseSave(def), prestigeUpgrades: { spark: 2 } };
    expect(hasKeepsake(save)).toBe(true);
    expect(hasKeepsake(newUniverseSave(def))).toBe(false);
    expect(freshRun(def, save).mods.mult).toBe(2);
    const stepped = stepMap(def, done(at(save, "1,0")), "1,0");
    // keepsake 2 × gem 3 × column 1 doubling 2
    expect(stepped.run.mods.mult).toBe(12);
  });

  it("starting over plays the same square again, no reward, no move", () => {
    const save = at(newUniverseSave(def), "1,0");
    const mid = {
      ...save,
      run: tick(
        def,
        { ...save.run, resources: { ...save.run.resources, total: 100 } },
        0.1
      ),
    };
    const again = startOver(def, mid);
    expect(again.map!.at).toBe("1,0");
    expect(again.embers).toBe(0);
    expect(again.completions).toBe(0);
    expect(again.run.phase).toBe(0);
    expect(again.run.mods.depth).toBeUndefined();
  });

  it("save round-trip keeps the map", () => {
    const save = stepMap(def, done(at(newUniverseSave(def), "1,0")), "2,0");
    const raw = JSON.parse(
      JSON.stringify({ version: 1, seenIntro: true, universes: { x: save } })
    );
    expect(parseSave(raw)!.universes.x.map).toEqual(save.map);
  });

  it("parse drops a bad map, keeps the universe", () => {
    const save = newUniverseSave(def);
    for (const map of [
      { at: 5, visited: [], found: [], off: [] },
      { at: "0,0", visited: ["x"], found: [], off: [] },
      { at: "0,0", visited: [], found: [3], off: [] },
      "nope",
    ]) {
      const raw = JSON.parse(
        JSON.stringify({
          version: 1,
          seenIntro: true,
          universes: { x: { ...save, map } },
        })
      );
      const parsed = parseSave(raw)!.universes.x;
      expect(parsed).toBeDefined();
      expect(parsed.map).toBeUndefined();
    }
  });

  it("a square off the board falls back to the start", () => {
    const save = {
      ...newUniverseSave(def),
      map: { ...newMapState(), at: "7,7" },
    };
    expect(mapOf(def, save).at).toBe("0,0");
    const unknown = {
      ...newUniverseSave(def),
      map: { ...newMapState(), found: ["ghost"] },
    };
    expect(activeArtifacts(def, mapOf(def, unknown))).toEqual([]);
  });

  it("a catch found by the run just finished can be switched off before stepping", () => {
    const save = done(at(newUniverseSave(def), "0,1"));
    const off = toggleArtifact(def, save, "thorn");
    expect(off.map!.off).toEqual(["thorn"]);
    const next = stepMap(def, off, "0,1");
    expect(next.map!.found).toEqual(["thorn"]);
    expect(next.run.resources.coins).toBe(0);
  });

  it("starting over after a finished run still counts it and keeps the find", () => {
    const save = startOver(def, done(at(newUniverseSave(def), "1,0")));
    expect(save.completions).toBe(1);
    expect(save.map!.found).toEqual(["gem"]);
    expect(save.map!.at).toBe("1,0");
    expect(save.run.complete).toBe(false);
  });
});
