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
    resources: { ...base.resources, lights: 11, ...resources },
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

  it("lifts a big lantern, blooms a flower and says goodbye in words a phone can read, clear of the top edge", () => {
    const gone = performAction(def, lastRun(), letGoActionId(3));
    const { getByTestId, queryAllByTestId } = draw(gone);
    expect(queryAllByTestId("lm-scene-flower")).toHaveLength(1);
    expect(getByTestId("lm-scene-flower")).toHaveAttribute("data-new", "yes");
    expect(getByTestId("lm-goodbye-lantern")).toBeInTheDocument();
    const goodbye = getByTestId("lm-goodbye");
    expect(goodbye).toHaveTextContent("GOODBYE,");
    expect(goodbye).toHaveTextContent("BRIDGE LIGHTS");
    // the pop-ups and gain floaters sit at the very top: the banner stays below them
    const banner = getByTestId("lm-goodbye-banner");
    expect(
      Number(banner.querySelector("rect")?.getAttribute("y"))
    ).toBeGreaterThanOrEqual(62);
    // big enough to read on a phone, where the picture is drawn at about 60%
    const sizes = [...banner.querySelectorAll("text")].map((t) =>
      Number(t.getAttribute("font-size"))
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(26);
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

  it("says the boat is slow once the fog is thick, and not for a thin mist", () => {
    const thick = draw(lastRun({ flame: 60 }));
    expect(thick.getByTestId("lm-fog")).toHaveAttribute("data-level", "4");
    expect(thick.getByTestId("lm-fog-word")).toHaveTextContent(
      "THE BOAT IS SLOW"
    );
    expect(thick.getByTestId("lm-boat")).toHaveAttribute("data-slow", "yes");
    const thin = draw(lastRun({ flame: 380 }));
    expect(thin.queryAllByTestId("lm-fog-word")).toHaveLength(0);
    expect(thin.getByTestId("lm-boat")).toHaveAttribute("data-slow", "no");
  });

  it("surges the boat when the flame is strong", () => {
    expect(
      draw(lastRun({ flame: 900 })).queryAllByTestId("lm-boat-surge")
    ).toHaveLength(1);
    expect(
      draw(lastRun({ flame: 200 })).queryAllByTestId("lm-boat-surge")
    ).toHaveLength(0);
  });

  it("shows the cold wind coming and blowing, by its kind", () => {
    const coming = draw(
      lastRun({ wmChillIn: 10, wmChillLeft: 0, wmChillSize: 2, wmChillKind: 1 })
    );
    expect(coming.getByTestId("lm-wind-scene")).toHaveAttribute(
      "data-blowing",
      "no"
    );
    expect(coming.getByTestId("lm-wind-scene")).toHaveTextContent(
      "TOWN WIND SOON"
    );
    expect(coming.getByTestId("lm-wind-scene")).toHaveTextContent("BITTER");
    const blowing = draw(
      lastRun({ wmChillLeft: 20, wmChillSize: 1, wmChillKind: 0 })
    );
    expect(blowing.getByTestId("lm-wind-scene")).toHaveAttribute(
      "data-blowing",
      "yes"
    );
    expect(blowing.getByTestId("lm-wind-scene")).toHaveTextContent("SEA WIND!");
  });

  it("makes only the lamps the wind bites lean and flicker, and rings the ones it will bite", () => {
    const lean = (windy: Record<string, number>, state: string) =>
      draw(lastRun(windy))
        .queryAllByTestId("lm-last-lamp")
        .map((lamp, i) => [i, lamp.getAttribute("data-wind")] as const)
        .filter(([, wind]) => wind === state)
        .map(([i]) => i);
    // a town wind bites the porch, the shop signs, the stadium and the towers
    expect(
      lean({ wmChillLeft: 20, wmChillSize: 1, wmChillKind: 1 }, "2")
    ).toEqual([0, 1, 2, 5]);
    const warn = draw(
      lastRun({ wmChillIn: 10, wmChillLeft: 0, wmChillSize: 1, wmChillKind: 2 })
    );
    expect(warn.queryAllByTestId("lm-lamp-warn")).toHaveLength(3);
    expect(draw(lastRun()).queryAllByTestId("lm-lamp-warn")).toHaveLength(0);
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
