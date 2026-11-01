import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
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

  it("shows honest chances and sends a crew on tap", async () => {
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

  it("lets a crew go ahead while the next storm forms", async () => {
    let run = forecastRun();
    while (weatherStage(run) === "forecast") run = tick(def, run, 1);
    const onAct = jest.fn();
    render(<WeatherDesk def={def} run={run} onAct={onAct} />);
    expect(screen.getByText(/Next storm forming/)).toBeInTheDocument();
    expect(screen.getByTestId("lm-weather-step")).toHaveTextContent(
      "Storm forming"
    );
    await userEvent.click(screen.getByTestId("lm-town-2"));
    expect(onAct).toHaveBeenCalledWith("weather-shield-2");
  });

  it("shows the forecast step, the storm's track and a crew getting ready", () => {
    let run = performAction(def, forecastRun(), "weather-shield-0");
    run = tick(def, run, 1);
    render(<WeatherDesk def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-weather-step")).toHaveTextContent(
      /Forecast \d of 3/
    );
    expect(screen.getByTestId("lm-storm-track")).toBeInTheDocument();
    const town = screen.getByTestId("lm-town-0");
    expect(town).toHaveAttribute("aria-pressed", "true");
    expect(town).toHaveAccessibleName("Crew at Rivertown");
    expect(town).toHaveAccessibleDescription(/crew \d+% ready/);
    expect(town).toHaveTextContent("Call back");
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
