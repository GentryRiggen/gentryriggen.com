import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import {
  PICK_ACTION,
  WATER_ACTION,
} from "@/lib/ever-onward/universes/light/garden";
import type { RunState } from "@/lib/ever-onward/engine/types";
import MemoryGarden from "../MemoryGarden";

function gardenRun(seconds = 0): RunState {
  const base = newRun(def);
  let run: RunState = {
    ...base,
    phase: 3,
    owned: { "letgo-porch": 1, "letgo-signs": 1 },
    resources: { ...base.resources, resolve: 500, lights: 10, flame: 600 },
  };
  for (let t = 0; t < seconds; t += 1) run = tick(def, run, 1);
  return run;
}

describe("MemoryGarden", () => {
  it("is absent before the first let-go and after the ending", () => {
    const { container, rerender } = render(
      <MemoryGarden def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <MemoryGarden
        def={def}
        run={{ ...gardenRun(), complete: true }}
        onAct={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names each plant and its stage", () => {
    render(<MemoryGarden def={def} run={gardenRun(10)} onAct={jest.fn()} />);
    expect(screen.getAllByTestId("lm-garden-plot")).toHaveLength(2);
    expect(screen.getByLabelText(/^Porch lights: /)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Shop signs: /)).toBeInTheDocument();
    const pick = screen.getByTestId("lm-garden-pick");
    expect(pick).toHaveAttribute("aria-disabled", "true");
    expect(pick).toHaveTextContent("Pick the blooms");
    expect(pick).toHaveTextContent("No blooms yet");
  });

  it("waters on a tap, and keeps the button focusable while the can rests", async () => {
    const onAct = jest.fn();
    const { rerender } = render(
      <MemoryGarden def={def} run={gardenRun(5)} onAct={onAct} />
    );
    const water = screen.getByTestId("lm-garden-water");
    expect(water).toHaveAttribute("aria-disabled", "false");
    expect(water).toHaveAccessibleName(/water the garden/i);
    await userEvent.click(water);
    expect(onAct).toHaveBeenCalledWith(WATER_ACTION);
    const watered = performAction(def, gardenRun(5), WATER_ACTION);
    rerender(<MemoryGarden def={def} run={watered} onAct={onAct} />);
    const resting = screen.getByTestId("lm-garden-water");
    expect(resting).toHaveAttribute("aria-disabled", "true");
    expect(resting).not.toBeDisabled();
    expect(resting).toHaveTextContent("Water the garden");
    expect(resting).toHaveTextContent("filling");
    onAct.mockClear();
    await userEvent.click(resting);
    expect(onAct).not.toHaveBeenCalled();
    expect(screen.getByTestId("lm-garden-can")).toHaveAttribute(
      "aria-valuetext",
      "filling up"
    );
  });

  it("offers to pick ready blooms and says so kindly in a status region", async () => {
    const onAct = jest.fn();
    const ready = gardenRun(200);
    const { rerender } = render(
      <MemoryGarden def={def} run={ready} onAct={onAct} />
    );
    await userEvent.click(screen.getByTestId("lm-garden-pick"));
    expect(onAct).toHaveBeenCalledWith(PICK_ACTION);
    const picked = performAction(def, ready, PICK_ACTION);
    rerender(<MemoryGarden def={def} run={picked} onAct={onAct} />);
    expect(screen.getByRole("status")).toHaveTextContent(/memory flowers/);
    expect(screen.getByTestId("lm-garden-tally")).toBeInTheDocument();
  });
});
