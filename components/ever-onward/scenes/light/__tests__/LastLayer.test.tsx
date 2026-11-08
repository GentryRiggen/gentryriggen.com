import { render, within } from "@testing-library/react";
import {
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "@/lib/ever-onward/engine/engine";
import {
  lightUniverse as def,
  sceneInfo,
} from "@/lib/ever-onward/universes/light";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  letGoActionId,
  startWarmth,
} from "@/lib/ever-onward/universes/light/warmth";
import LastLayer from "../LastLayer";

function lastRun(resources: Record<string, number> = {}): RunState {
  const base = newRun(def);
  const run = reconcileRun(def, {
    ...base,
    phase: 3,
    resources: { ...base.resources, lights: 12, ...resources },
  });
  startWarmth(run);
  Object.assign(run.resources, resources);
  return tick(def, run, 0.01);
}

/** Draws the layer on its own; the queries look only inside this picture, so several can be drawn in one test. */
function draw(run: RunState) {
  const { container } = render(
    <svg>
      <LastLayer info={sceneInfo(run)} />
    </svg>
  );
  return within(container);
}

describe("LastLayer", () => {
  it("draws eleven lamps along the shore and no flowers while every light burns", () => {
    const { queryAllByTestId } = draw(lastRun());
    expect(queryAllByTestId("lm-last-lamp")).toHaveLength(11);
    expect(queryAllByTestId("lm-scene-flower")).toHaveLength(0);
    expect(queryAllByTestId("lm-goodbye")).toHaveLength(0);
  });

  it("lifts a lantern, blooms a flower and says goodbye (small, at the edge) when a light goes", () => {
    const gone = performAction(def, lastRun(), letGoActionId(3));
    const { getByTestId, queryAllByTestId } = draw(gone);
    expect(queryAllByTestId("lm-scene-flower")).toHaveLength(1);
    expect(getByTestId("lm-scene-flower")).toHaveAttribute("data-new", "yes");
    const goodbye = getByTestId("lm-goodbye");
    expect(goodbye).toHaveTextContent("GOODBYE, LITTLE LIGHT");
    const text = goodbye.querySelector("text");
    expect(Number(text?.getAttribute("y"))).toBeLessThanOrEqual(40);
    expect(Number(text?.getAttribute("font-size"))).toBeLessThanOrEqual(12);
  });

  it("keeps the flower once the goodbye is over, but not the lantern or the words", () => {
    let run = performAction(def, lastRun(), letGoActionId(3));
    for (let t = 0; t < 12; t += 1) run = tick(def, run, 1);
    const { queryAllByTestId } = draw(run);
    expect(queryAllByTestId("lm-scene-flower")).toHaveLength(1);
    expect(queryAllByTestId("lm-scene-flower")[0]).toHaveAttribute(
      "data-new",
      "no"
    );
    expect(queryAllByTestId("lm-goodbye")).toHaveLength(0);
  });

  it("wraps the boat in a golden haze that grows with the warmth", () => {
    const radius = (flame: number): number => {
      const { getByTestId } = draw(lastRun({ flame }));
      return Number(getByTestId("lm-boat-haze").getAttribute("r"));
    };
    expect(radius(900)).toBeGreaterThan(radius(100) + 20);
  });

  it("brings fog in as the flame cools, and none when it is warm", () => {
    expect(
      draw(lastRun({ flame: 900 })).queryAllByTestId("lm-fog")
    ).toHaveLength(0);
    expect(
      draw(lastRun({ flame: 40 })).queryAllByTestId("lm-fog")
    ).toHaveLength(1);
  });

  it("surges the boat when the flame is strong", () => {
    expect(
      draw(lastRun({ flame: 900 })).queryAllByTestId("lm-boat-surge")
    ).toHaveLength(1);
    expect(
      draw(lastRun({ flame: 200 })).queryAllByTestId("lm-boat-surge")
    ).toHaveLength(0);
  });

  it("shows the cold wind coming and blowing", () => {
    const coming = draw(
      lastRun({ wmChillIn: 10, wmChillLeft: 0, wmChillSize: 2 })
    );
    expect(coming.getByTestId("lm-wind-scene")).toHaveAttribute(
      "data-blowing",
      "no"
    );
    expect(coming.getByTestId("lm-wind-scene")).toHaveTextContent(
      "BITTER WIND COMING"
    );
    const blowing = draw(lastRun({ wmChillLeft: 20, wmChillSize: 1 }));
    expect(blowing.getByTestId("lm-wind-scene")).toHaveAttribute(
      "data-blowing",
      "yes"
    );
  });

  it("lifts every lantern at the ending", () => {
    const done = lastRun();
    done.flags.finished = true;
    for (let i = 0; i < 11; i += 1)
      done.owned[
        `letgo-${["porch", "signs", "stadium", "bridges", "harbor", "towers", "festival", "fire", "moon", "sun", "night"][i]}`
      ] = 1;
    const { getByTestId } = draw(done);
    expect(getByTestId("lm-last-all-go")).toBeInTheDocument();
  });
});
