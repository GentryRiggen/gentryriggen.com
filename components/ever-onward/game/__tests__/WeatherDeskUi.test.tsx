import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, tick } from "@/lib/ever-onward/engine/engine";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import {
  chanceOf,
  weatherStage,
} from "@/lib/ever-onward/universes/light/weather";
import type { RunState } from "@/lib/ever-onward/engine/types";
import WeatherDesk from "../WeatherDesk";

function forecastRun(): RunState {
  const base = newRun(def);
  let run: RunState = {
    ...base,
    phase: 1,
    owned: { gen2: 3 },
    resources: { ...base.resources, night: 80 },
  };
  for (let t = 0; t < 600 && weatherStage(run) !== "forecast"; t += 1)
    run = tick(def, run, 1);
  return run;
}

describe("WeatherDesk", () => {
  it("is absent before it opens", () => {
    const { container } = render(
      <WeatherDesk def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows honest chances and shields a town on tap", async () => {
    const onAct = jest.fn();
    const run = forecastRun();
    render(<WeatherDesk def={def} run={run} onAct={onAct} />);
    expect(screen.getByTestId("lm-weather")).toHaveAttribute(
      "data-stage",
      "forecast"
    );
    expect(screen.getByTestId("lm-town-0")).toHaveTextContent(
      `${chanceOf(run, 0)}%`
    );
    await userEvent.click(screen.getByTestId("lm-town-1"));
    expect(onAct).toHaveBeenCalledWith("weather-shield-1");
  });

  it("shows a calm bar while the next front forms", () => {
    let run = forecastRun();
    while (weatherStage(run) === "forecast") run = tick(def, run, 1);
    render(<WeatherDesk def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByText(/Next front forming/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
