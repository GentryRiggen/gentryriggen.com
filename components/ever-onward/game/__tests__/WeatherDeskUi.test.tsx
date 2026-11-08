import { render, screen } from "@testing-library/react";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import {
  POST_WATCH,
  chanceOf,
  crewPostActionId,
  weatherStage,
} from "@/lib/ever-onward/universes/light/weather";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
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

  it("shows honest chances for the three towns", () => {
    const run = forecastRun();
    render(<WeatherDesk def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-weather")).toHaveAttribute(
      "data-stage",
      "forecast"
    );
    for (const town of [0, 1, 2])
      expect(screen.getByTestId(`lm-town-${town}`)).toHaveTextContent(
        `${chanceOf(run, town)}%`
      );
    // the crews are posted from the Crews panel, not from here
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says a storm is forming while the next one gathers", () => {
    let run = forecastRun();
    while (weatherStage(run) === "forecast") run = tick(def, run, 1);
    render(<WeatherDesk def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByText(/Next storm forming/)).toBeInTheDocument();
    expect(screen.getByTestId("lm-weather-step")).toHaveTextContent(
      "Storm forming"
    );
  });

  it("shows the forecast step, the storm's track and a crew getting ready", () => {
    let run = performAction(
      def,
      forecastRun(),
      crewPostActionId(0, POST_WATCH)
    );
    for (let t = 0; t < TUNING.grid.moveSeconds + 5; t += 1)
      run = tick(def, run, 1);
    render(<WeatherDesk def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-weather-step")).toHaveTextContent(
      /Forecast \d of 3/
    );
    expect(screen.getByTestId("lm-storm-track")).toBeInTheDocument();
    const town = screen.getByTestId("lm-town-0");
    expect(town).toHaveAccessibleName("Rivertown");
    expect(town).toHaveAccessibleDescription(/crew \d+% ready/);
  });

  it("marks a dark town, kindly, and says a crew fixes it", () => {
    const base = forecastRun();
    const run = {
      ...base,
      resources: { ...base.resources, wxOut1: 100 },
    };
    render(<WeatherDesk def={def} run={run} onAct={jest.fn()} />);
    const town = screen.getByTestId("lm-town-1");
    expect(town).toHaveAttribute("data-dark", "true");
    expect(town).toHaveTextContent(/Lights out/);
    expect(town).toHaveAccessibleDescription(/its lights are out/);
  });
});
