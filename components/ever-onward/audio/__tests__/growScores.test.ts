import { isValidSpec, planBar } from "../../../game-audio/music";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { growUniverse } from "@/lib/ever-onward/universes/grow";
import { GROW_UI } from "../../universes/grow";
import { SCORES, UNEASE } from "../scores";
import {
  GROW_SCORES,
  GROW_TITLE_SCORE,
  GROW_UNEASE,
  areGrowScoresValid,
} from "../growScores";

describe("Grow scores", () => {
  it("has four valid phase scores and a valid title theme", () =>
    expect(areGrowScoresValid()).toBe(true));

  it.each(GROW_SCORES.map((s) => [s.id, s] as const))("%s plays", (_i, s) => {
    expect(isValidSpec(s)).toBe(true);
    expect(planBar(s, 0).length).toBeGreaterThan(0);
  });

  it("is its own music, not Light's", () => {
    const ids = [...GROW_SCORES, GROW_TITLE_SCORE].map((s) => s.id);
    expect(ids).not.toContain("eo-coast");
    expect(new Set(ids).size).toBe(5);
    const light = SCORES.map((s) => s.id);
    expect(ids.some((id) => light.includes(id))).toBe(false);
    expect(GROW_UI.audio.scores).toBe(GROW_SCORES);
    expect(GROW_UI.audio.titleScore).toBe(GROW_TITLE_SCORE);
  });

  it("builds unease from none in the yard to the most in the world", () => {
    expect(GROW_UNEASE).toHaveLength(4);
    expect(GROW_UNEASE[0]).toBeNull();
    const farm = GROW_UNEASE[1]!;
    const world = GROW_UNEASE[2]!;
    expect(farm.gain).toBeLessThan(world.gain);
    expect(world.meanGapS).toBeLessThan(farm.meanGapS);
    expect(world.gain).toBeLessThanOrEqual(0.06);
    expect(GROW_UNEASE[3]).toBeNull();
    expect(UNEASE).not.toBe(GROW_UNEASE);
  });

  it("cues buzz, ribbon, flutter and bloom as the machines move", () => {
    const before = newRun(growUniverse, {});
    const cues = GROW_UI.audio.cuesBetween!;
    const withRes = (r: Record<string, number>) => ({
      ...before,
      resources: { ...before.resources, ...r },
    });
    expect(cues(before, before)).toEqual([]);
    expect(cues(before, withRes({ beDances: 1 }))).toEqual(["buzz"]);
    expect(cues(before, withRes({ frFairs: 1 }))).toEqual(["ribbon"]);
    expect(cues(before, withRes({ mgFlights: 1 }))).toEqual(["flutter"]);
    expect(cues(before, withRes({ potStage: 1 }))).toEqual(["bloom"]);
  });
});
