import { render } from "@testing-library/react";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import Logbook from "../Logbook";

describe("the logbook", () => {
  it("keeps Light's lines in order: probes, tide, keepsakes, weather", () => {
    const base = newRun(lightUniverse);
    const run = {
      ...base,
      resources: {
        ...base.resources,
        prRuns: 1,
        tdHauls: 1,
        gdPicks: 1,
        wxFronts: 1,
      },
    };
    const { container } = render(<Logbook def={lightUniverse} run={run} />);
    const text = container.textContent ?? "";
    const at = (s: string) => text.indexOf(s);
    expect(at("Probe races")).toBeGreaterThan(-1);
    expect(at("Probe races")).toBeLessThan(at("Tide clock"));
    expect(at("Tide clock")).toBeLessThan(at("Keepsakes"));
    expect(at("Keepsakes")).toBeLessThan(at("Weather desk"));
  });
});
