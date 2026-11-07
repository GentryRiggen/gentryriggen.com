import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import {
  SHADE_ACTION_ID,
  SUN_ACTION_ID,
  type PotStage,
} from "@/lib/ever-onward/universes/grow/windowbox";
import WindowBox from "../WindowBox";

const pot = (growth = 0, resources: Record<string, number> = {}) => {
  const base = newRun(def);
  return {
    ...base,
    phase: 3,
    resources: {
      ...base.resources,
      growth,
      wbReady: 1,
      wbAim: 1,
      wbLight: 0.5,
      wbMoist: 0.55,
      wbSky: 1,
      ...resources,
    },
  };
};

describe("WindowBox", () => {
  it("renders nothing outside the last phase", () => {
    const { container } = render(
      <WindowBox def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    [0, "soil"],
    [30, "sprout"],
    [70, "bud"],
    [100, "bloom"],
  ] as [number, PotStage][])(
    "shows the pot's stage at %i%% grown: %s",
    (growth, stage) => {
      render(<WindowBox def={def} run={pot(growth)} onAct={jest.fn()} />);
      expect(screen.getByTestId("eo-windowbox")).toHaveAttribute(
        "data-stage",
        stage
      );
    }
  );

  it("shows what the leaves look like, and the weather", () => {
    render(
      <WindowBox
        def={def}
        run={pot(30, { wbMoist: 0.1, wbSky: 3 })}
        onAct={jest.fn()}
      />
    );
    expect(screen.getByTestId("eo-windowbox-leaves")).toHaveTextContent(
      "Crisp and brown"
    );
    expect(screen.getByTestId("eo-windowbox-sky")).toHaveTextContent(
      "A hot spell"
    );
  });

  it("shows the plus and the minus of each choice, and never says which is best", () => {
    render(<WindowBox def={def} run={pot(30)} onAct={jest.fn()} />);
    const sun = screen.getByRole("button", { name: "More sun" });
    expect(sun).toHaveTextContent("+ Grows faster");
    expect(sun).toHaveTextContent("− Dries the soil out");
    const shade = screen.getByRole("button", { name: "More shade" });
    expect(shade).toHaveTextContent("+ Keeps the soil moist");
    expect(shade).toHaveTextContent("− Grows slower");
    expect(screen.getByTestId("eo-windowbox").textContent).not.toMatch(
      /best|recommend|should|just right/i
    );
  });

  it("calls onAct for a choice", async () => {
    const onAct = jest.fn();
    render(<WindowBox def={def} run={pot(30)} onAct={onAct} />);
    await userEvent.click(screen.getByRole("button", { name: "More sun" }));
    expect(onAct).toHaveBeenCalledWith(SUN_ACTION_ID);
    await userEvent.click(screen.getByRole("button", { name: "More shade" }));
    expect(onAct).toHaveBeenCalledWith(SHADE_ACTION_ID);
  });

  it("uses aria-disabled at the end of the blind, and never the disabled attribute", async () => {
    const onAct = jest.fn();
    render(
      <WindowBox
        def={def}
        run={pot(30, { wbAim: 2, wbLight: 1 })}
        onAct={onAct}
      />
    );
    const sun = screen.getByRole("button", { name: "More sun" });
    expect(sun).toHaveAttribute("aria-disabled", "true");
    expect(sun).not.toBeDisabled();
    await userEvent.click(sun);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("keeps the same button elements and labels when the blind moves", () => {
    const { rerender } = render(
      <WindowBox def={def} run={pot(10)} onAct={jest.fn()} />
    );
    const before = screen.getByRole("button", { name: "More shade" });
    act(() => before.focus());
    rerender(
      <WindowBox
        def={def}
        run={pot(10, { wbAim: 0, wbMoist: 0.1 })}
        onAct={jest.fn()}
      />
    );
    const after = screen.getByRole("button", { name: "More shade" });
    expect(after).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(after).toHaveAttribute("aria-disabled", "true");
  });
});
