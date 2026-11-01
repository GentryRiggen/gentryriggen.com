import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { spreadActionId } from "@/lib/ever-onward/universes/grow/biomes";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import BiomePanel from "../BiomePanel";

const world = () => ({ ...newRun(def), phase: 2 });

describe("BiomePanel", () => {
  it("renders nothing outside the green world", () => {
    const { container } = render(
      <BiomePanel def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a radio group with the spreading biome checked and one tab stop", () => {
    render(<BiomePanel def={def} run={world()} onAct={jest.fn()} />);
    expect(
      screen.getByRole("radiogroup", { name: "Which kind of green to spread" })
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "Forest" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    radios.forEach((r) => expect(r).not.toBeDisabled());
  });

  it("chooses a biome by click and moves focus with arrows without choosing", async () => {
    const onAct = jest.fn();
    render(<BiomePanel def={def} run={world()} onAct={onAct} />);
    const forest = screen.getByRole("radio", { name: "Forest" });
    act(() => forest.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Jungle" })
    );
    expect(onAct).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "Meadow" }));
    expect(onAct).toHaveBeenCalledWith(spreadActionId("meadow"));
    await userEvent.click(forest);
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("keeps a status line", () => {
    render(<BiomePanel def={def} run={world()} onAct={jest.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Forest is spreading/);
  });
});
