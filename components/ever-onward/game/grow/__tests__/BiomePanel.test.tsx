import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import {
  lessActionId,
  moreActionId,
} from "@/lib/ever-onward/universes/grow/biomes";
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

  it("shows a slider for every biome with its plus and its minus", () => {
    render(<BiomePanel def={def} run={world()} onAct={jest.fn()} />);
    for (const biome of ["forest", "jungle", "meadow", "wetland"]) {
      expect(screen.getByTestId(`lm-biomes-${biome}`)).toBeInTheDocument();
      expect(screen.getByTestId(`lm-mix-more-${biome}`)).toBeInTheDocument();
      expect(screen.getByTestId(`lm-mix-less-${biome}`)).toBeInTheDocument();
    }
    expect(screen.getByText(/Water in the tank/)).toBeInTheDocument();
  });

  it("moves a slider by click, one point each press", async () => {
    const onAct = jest.fn();
    render(<BiomePanel def={def} run={world()} onAct={onAct} />);
    await userEvent.click(screen.getByTestId("lm-mix-more-jungle"));
    expect(onAct).toHaveBeenCalledWith(moreActionId("jungle"));
    await userEvent.click(screen.getByTestId("lm-mix-less-forest"));
    expect(onAct).toHaveBeenCalledWith(lessActionId("forest"));
    expect(onAct).toHaveBeenCalledTimes(2);
  });

  it("says what each kind costs and never which is best", () => {
    render(<BiomePanel def={def} run={world()} onAct={jest.fn()} />);
    expect(screen.getByText(/drinks the most water/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/best|recommended/i);
    // No printed threshold and no cure: the player finds the line.
    expect(document.body.textContent).not.toMatch(
      /\d+% of the world|spread it out|cure/i
    );
  });

  it("flags a blight in its row and in the result line", () => {
    const run = world();
    run.resources.bmBlight1 = 0.7;
    render(<BiomePanel def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-biomes-jungle")).toHaveAttribute(
      "data-sick",
      "true"
    );
    expect(screen.getByText("BLIGHT")).toBeInTheDocument();
    expect(screen.getByTestId("lm-biomes-result")).toHaveTextContent(
      /Blight in the jungle/
    );
  });

  it("keeps a status line", () => {
    render(<BiomePanel def={def} run={world()} onAct={jest.fn()} />);
    expect(screen.getByText(/The world is \d+% green/)).toBeInTheDocument();
  });
});
