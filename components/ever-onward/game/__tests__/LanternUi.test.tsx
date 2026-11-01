import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse, sceneInfo } from "@/lib/ever-onward/universes/light";
import LastLayer from "../../scenes/light/LastLayer";
import LanternPicker from "../LanternPicker";
import PhaseOverlay from "../PhaseOverlay";

describe("the lantern pick at the start of a run", () => {
  it("offers three named colours, one picked, and reports a change", async () => {
    const onChange = jest.fn();
    render(
      <PhaseOverlay
        phase={lightUniverse.phases[0]}
        number={1}
        total={4}
        onContinue={jest.fn()}
        opening={<LanternPicker value={1} onChange={onChange} />}
      />
    );
    const group = screen.getByRole("radiogroup", { name: "Lantern colour" });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Gold", "Sea", "Rose"]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(radios[2]);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("is not shown for the later parts", () => {
    render(
      <PhaseOverlay
        phase={lightUniverse.phases[1]}
        number={2}
        total={4}
        onContinue={jest.fn()}
      />
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});

describe("the last scene", () => {
  const sceneAt = (flame: number, lantern: number) => {
    const run = { ...newRun(lightUniverse), phase: 3 };
    return sceneInfo({
      ...run,
      resources: { ...run.resources, flame, lights: 2, lantern },
    });
  };

  it("dims the night when the flame is low, and not when it is high", () => {
    const { rerender } = render(
      <svg>
        <LastLayer info={sceneAt(900, 1)} />
      </svg>
    );
    expect(screen.getByTestId("lm-last-sky")).toHaveAttribute("opacity", "1");
    rerender(
      <svg>
        <LastLayer info={sceneAt(50, 1)} />
      </svg>
    );
    const dimmed = Number(
      screen.getByTestId("lm-last-sky").getAttribute("opacity")
    );
    expect(dimmed).toBeLessThan(0.6);
    expect(dimmed).toBeGreaterThan(0.2);
  });

  it("carries the picked lantern on the boat", () => {
    const { container } = render(
      <svg>
        <LastLayer info={sceneAt(900, 3)} />
      </svg>
    );
    expect(container.innerHTML).toContain("url(#lm-lantern-3)");
  });
});
