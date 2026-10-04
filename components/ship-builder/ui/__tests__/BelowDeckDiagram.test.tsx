import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BelowDeckDiagram from "../BelowDeckDiagram";
import type { Hull } from "@/lib/ship-builder/model/types";

const hull: Hull = {
  lengthSegments: 6,
  beam: 4,
  bow: "straight",
  stern: "counter",
  bulkheads: [
    { at: 2, height: "waterline" },
    { at: 4, height: "deck" },
  ],
};

describe("BelowDeckDiagram", () => {
  it("is a labelled picture when read-only", () => {
    render(<BelowDeckDiagram hull={hull} />);
    expect(
      screen.getByRole("img", {
        name: "Below deck: 3 watertight rooms with 2 walls",
      })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("draws walls where they stand and none where they don't", () => {
    render(<BelowDeckDiagram hull={hull} />);
    expect(screen.getByTestId("below-deck-wall-2")).toBeInTheDocument();
    expect(screen.getByTestId("below-deck-wall-4")).toBeInTheDocument();
    expect(screen.queryByTestId("below-deck-wall-3")).not.toBeInTheDocument();
  });

  it("makes a button for each boundary with a plain-words label", () => {
    render(<BelowDeckDiagram hull={hull} onCycle={jest.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(
      screen.getByRole("button", {
        name: "Wall 1: none. Tap to change.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Wall 2: up to the waterline. Tap to change.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Wall 4: up to the deck. Tap to change.",
      })
    ).toBeInTheDocument();
  });

  it("names a low wall", () => {
    render(
      <BelowDeckDiagram
        hull={{ ...hull, bulkheads: [{ at: 1, height: "low" }] }}
        onCycle={jest.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Wall 1: low. Tap to change." })
    ).toBeInTheDocument();
  });

  it("calls onCycle with the boundary on click, Enter and Space", async () => {
    const user = userEvent.setup();
    const onCycle = jest.fn();
    render(<BelowDeckDiagram hull={hull} onCycle={onCycle} />);
    const slot = screen.getByRole("button", { name: /^Wall 3:/ });
    await user.click(slot);
    slot.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onCycle).toHaveBeenCalledTimes(3);
    expect(onCycle).toHaveBeenCalledWith(3);
  });

  it("shows water per compartment and nothing for dry ones", () => {
    render(<BelowDeckDiagram hull={hull} water={{ c0: 0.5, c1: 0 }} />);
    expect(screen.getByTestId("below-deck-water-c0")).toBeInTheDocument();
    expect(screen.queryByTestId("below-deck-water-c1")).not.toBeInTheDocument();
  });

  it("marks opened compartments with a gash", () => {
    render(<BelowDeckDiagram hull={hull} opened={["c1"]} />);
    expect(screen.getByTestId("below-deck-gash-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("below-deck-gash-c0")).not.toBeInTheDocument();
  });
});
