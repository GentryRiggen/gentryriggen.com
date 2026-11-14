import { render } from "@testing-library/react";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import Logbook from "../Logbook";

describe("the logbook", () => {
  it("keeps Light's lines in order: probes, tankers, flowers, weather", () => {
    const base = newRun(lightUniverse);
    const run = {
      ...base,
      resources: {
        ...base.resources,
        prRuns: 1,
        tkVisits: 1,
        wmLets: 1,
        wxFronts: 1,
      },
    };
    const { container } = render(<Logbook def={lightUniverse} run={run} />);
    const text = container.textContent ?? "";
    const at = (s: string) => text.indexOf(s);
    expect(at("Probe races")).toBeGreaterThan(-1);
    expect(at("Probe races")).toBeLessThan(at("Oil tankers"));
    expect(at("Oil tankers")).toBeLessThan(at("Flowers"));
    expect(at("Flowers")).toBeLessThan(at("Weather desk"));
  });
});
