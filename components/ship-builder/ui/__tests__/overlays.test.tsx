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

  describe("focus", () => {
    function openRemoval() {
      act(() =>
        useShipBuilderStore.setState({
          ship: testShip([
            gridPart("a", "deck-1x1", 0, 2, 1),
            gridPart("b", "deck-1x1", 1, 2, 1),
          ]),
          selectedId: "a",
        })
      );
      render(
        <>
          <button type="button">Elsewhere</button>
          <RemovalConfirm />
        </>
      );
      const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
      act(() => elsewhere.focus());
      act(() => store().requestDelete());
      return elsewhere;
    }

    it("moves focus to Keep on mount", () => {
      openRemoval();
      expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();
    });

    it("returns focus to the previous element when kept", async () => {
      const user = userEvent.setup();
      const elsewhere = openRemoval();
      await user.click(screen.getByRole("button", { name: "Keep" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(elsewhere).toHaveFocus();
    });
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

  describe("with fake timers", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("hides after five seconds", () => {
      render(<Notice />);
      act(() => store().setNotice("Saved"));
      act(() => jest.advanceTimersByTime(5000));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("restarts the timer when the same text is set again", () => {
      render(<Notice />);
      act(() => store().setNotice("Saved"));
      act(() => jest.advanceTimersByTime(4000));
      act(() => store().setNotice("Saved"));
      act(() => jest.advanceTimersByTime(4000));
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
      act(() => jest.advanceTimersByTime(1000));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  it("replaces the announced node when the same text repeats", () => {
    render(<Notice />);
    const status = screen.getByRole("status");
    act(() => store().setNotice("Saved"));
    const first = status.firstChild;
    act(() => store().setNotice("Saved"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status.firstChild).not.toBe(first);
    expect(status).toHaveTextContent("Saved");
  });
});
