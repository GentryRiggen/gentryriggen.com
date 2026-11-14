import { artifactAt, legalTargets } from "../../engine/map";
import { newUniverseSave } from "../../engine/prestige";
import { lightUniverse as def } from "../../universes/light";
import { jumpToMap } from "../bots";
import { mapPreset } from "../mapJump";

describe("Test mode map presets", () => {
  it("first: standing on the nearest artifact, nothing found", () => {
    const state = mapPreset(def, "first");
    expect(state.found).toEqual([]);
    expect(artifactAt(def, state.at)).toBeDefined();
  });

  it("half: about half found, standing on one still to find", () => {
    const state = mapPreset(def, "half");
    expect(state.found.length).toBeGreaterThanOrEqual(7);
    const waiting = artifactAt(def, state.at);
    expect(waiting).toBeDefined();
    expect(state.found).not.toContain(waiting!.id);
  });

  it("end: everything found, one step from the last square", () => {
    const state = mapPreset(def, "end");
    expect(state.found).toHaveLength(14);
    const save = {
      ...newUniverseSave(def),
      map: state,
      run: { ...newUniverseSave(def).run, complete: true },
    };
    expect(legalTargets(def, save)).toContain("7,7");
  });

  it("plays a finished run on the square", () => {
    const jump = jumpToMap("light", "half")!;
    expect(jump.run.complete).toBe(true);
    expect(jump.map).toEqual(mapPreset(def, "half"));
    expect(jumpToMap("nowhere", "half")).toBeNull();
  });
});
