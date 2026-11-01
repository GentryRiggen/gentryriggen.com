import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import {
  tendActionId,
  WANTS,
  type PotStage,
} from "@/lib/ever-onward/universes/grow/windowbox";
import WindowBox from "../WindowBox";

const pot = (growth = 0, want?: number) => {
  const base = newRun(def);
  return {
    ...base,
    phase: 3,
    resources: {
      ...base.resources,
      growth,
      wbStage: want === undefined ? 0 : 1,
      wbWant: want ?? 0,
      wbShown: want === undefined ? 0 : 1,
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
      expect(screen.getByTestId("lm-windowbox-pot")).toHaveAttribute(
        "data-stage",
        stage
      );
    }
  );

  it("calls onAct for a tending choice when the pot wants something", async () => {
    const onAct = jest.fn();
    render(<WindowBox def={def} run={pot(10, 1)} onAct={onAct} />);
    expect(screen.getByRole("status")).toHaveTextContent(WANTS[1].clue);
    await userEvent.click(
      screen.getByRole("button", { name: "Sing it a song" })
    );
    expect(onAct).toHaveBeenCalledWith(tendActionId(1));
  });

  it("uses aria-disabled while the pot rests, and never the disabled attribute", async () => {
    const onAct = jest.fn();
    render(<WindowBox def={def} run={pot(10)} onAct={onAct} />);
    const group = screen.getByRole("group", { name: "Tend the pot" });
    const buttons = group.querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    buttons.forEach((b) => {
      expect(b).toHaveAttribute("aria-disabled", "true");
      expect(b).not.toBeDisabled();
    });
    await userEvent.click(buttons[0]);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("keeps the same button elements and labels when the pot starts to want", () => {
    const { rerender } = render(
      <WindowBox def={def} run={pot(10)} onAct={jest.fn()} />
    );
    const before = screen.getByRole("button", {
      name: "Water it from the can",
    });
    act(() => before.focus());
    rerender(<WindowBox def={def} run={pot(10, 2)} onAct={jest.fn()} />);
    const after = screen.getByRole("button", { name: "Water it from the can" });
    expect(after).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(after).toHaveAttribute("aria-disabled", "false");
  });
});
