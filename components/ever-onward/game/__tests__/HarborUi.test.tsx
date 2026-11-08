import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, reconcileRun } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import HarborPanel from "../HarborPanel";

const coastRun = (keeper: number): RunState => {
  const base = newRun(def);
  return reconcileRun(def, { ...base, owned: { keeper } });
};

describe("HarborPanel", () => {
  it("is absent before the harbor desk opens", () => {
    const { container } = render(
      <HarborPanel def={def} run={coastRun(1)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a radio group with Usual checked, and sets a toll on tap", async () => {
    const onAct = jest.fn();
    render(<HarborPanel def={def} run={coastRun(5)} onAct={onAct} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /^Usual/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await userEvent.click(screen.getByRole("radio", { name: /^Steep/ }));
    expect(onAct).toHaveBeenCalledWith("toll-3");
    await userEvent.click(screen.getByRole("radio", { name: /^Usual/ }));
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("shows the plus and the minus of every toll, and never says which is best", () => {
    render(<HarborPanel def={def} run={coastRun(5)} onAct={jest.fn()} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.textContent).toMatch(/pays x[\d.]+/);
      expect(radio.textContent).toMatch(/\d+% come/);
    }
    const text = screen.getByTestId("lm-harbor").textContent ?? "";
    expect(text).not.toMatch(/best|recommend|should|raise|lower/i);
    expect(screen.getByTestId("lm-harbor-traffic")).toHaveTextContent("100%");
    expect(screen.getByTestId("lm-harbor-rival")).toHaveTextContent("x1.3");
  });

  it("holds the sign while it is being repainted", async () => {
    const onAct = jest.fn();
    const run = coastRun(5);
    run.resources.tollLock = 12;
    render(<HarborPanel def={def} run={run} onAct={onAct} />);
    expect(screen.getByTestId("lm-harbor-lock")).toHaveTextContent(
      "repainted: 12 s"
    );
    expect(screen.getByRole("radio", { name: /^High/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await userEvent.click(screen.getByRole("radio", { name: /^High/ }));
    expect(onAct).not.toHaveBeenCalled();
  });
});
