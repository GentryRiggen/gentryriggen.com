import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlacementHint from "../PlacementHint";
import RemovalConfirm from "../RemovalConfirm";
import Notice from "../Notice";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("PlacementHint", () => {
  it("is hidden without a tool and shows the rule reason on a bad hover", () => {
    const { container } = render(<PlacementHint />);
    expect(container).toBeEmptyDOMElement();
    act(() => {
      store().selectTool("deck-1x1");
      store().hoverAt({ kind: "grid", level: 1, x: 0, z: 0 });
    });
    expect(screen.getByTestId("placement-reason")).toHaveTextContent(
      "Needs a deck beneath every cell"
    );
  });

  it("explains when an attach part has nowhere to go", () => {
    render(<PlacementHint />);
    act(() => store().selectTool("lifeboat-standard"));
    expect(screen.getByText(/Every davit has a boat/)).toBeInTheDocument();
  });
});

describe("RemovalConfirm", () => {
  it("confirms a cascade removal", async () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 1),
          gridPart("b", "deck-1x1", 1, 2, 1),
        ]),
        selectedId: "a",
      })
    );
    act(() => store().requestDelete());
    const user = userEvent.setup();
    render(<RemovalConfirm />);
    expect(
      screen.getByText(/also removes 1 attached part/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(store().ship.parts).toHaveLength(0);
  });
});

describe("Notice", () => {
  it("keeps the live region mounted with no notice", () => {
    render(<Notice />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    act(() => store().setNotice("Saved to My Ships"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Saved to My Ships");
  });

  it("shows and dismisses the notice", async () => {
    const user = userEvent.setup();
    render(<Notice />);
    act(() => store().setNotice("Saved to My Ships"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved to My Ships");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(store().notice).toBeNull();
  });
});
