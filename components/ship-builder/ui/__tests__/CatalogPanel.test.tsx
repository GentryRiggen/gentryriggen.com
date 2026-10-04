import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PART_TYPES } from "@/lib/ship-builder/model/types";
import CatalogPanel from "../CatalogPanel";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("CatalogPanel", () => {
  it("groups parts under category headings", () => {
    render(<CatalogPanel />);
    for (const heading of [
      "Decks",
      "Cabins",
      "Command",
      "Funnels",
      "Masts",
      "Lifeboat gear",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading })
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: /Collapsible lifeboat/ })
    ).toBeInTheDocument();
  });

  it("shows an icon for every part", () => {
    render(<CatalogPanel />);
    expect(screen.getAllByTestId("part-icon")).toHaveLength(PART_TYPES.length);
  });

  it("selects a part and toggles it off on a second click", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    const funnel = screen.getByRole("button", { name: /^Funnel/ });
    await user.click(funnel);
    expect(funnel).toHaveAttribute("aria-pressed", "true");
    expect(useShipBuilderStore.getState().tool).toMatchObject({
      type: "funnel",
    });
    await user.click(funnel);
    expect(funnel).toHaveAttribute("aria-pressed", "false");
    expect(useShipBuilderStore.getState().tool).toEqual({ kind: "none" });
  });

  it("calls onPick after selecting a part", async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    render(<CatalogPanel onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: /^Funnel/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  describe("Hull section", () => {
    const bowTiles = () =>
      within(screen.getByRole("group", { name: "Bow" })).getAllByRole("button");
    const sternTiles = () =>
      within(screen.getByRole("group", { name: "Stern" })).getAllByRole(
        "button"
      );

    it("comes first, with four bow tiles and four stern tiles", () => {
      render(<CatalogPanel />);
      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings[0]).toHaveTextContent("Hull");
      expect(bowTiles().map((b) => b.textContent)).toEqual([
        "Straight",
        "Clipper",
        "Bulbous",
        "Icebreaker",
      ]);
      expect(sternTiles().map((b) => b.textContent)).toEqual([
        "Counter",
        "Cruiser",
        "Transom",
        "Canoe",
      ]);
    });

    it("draws a different side-view icon on every tile", () => {
      const { container } = render(<CatalogPanel />);
      const icons = Array.from(
        container.querySelectorAll('[data-testid="hull-end-icon"]')
      );
      expect(icons).toHaveLength(8);
      expect(new Set(icons.map((i) => i.innerHTML)).size).toBe(8);
    });

    it("marks the ship's current shapes pressed", () => {
      render(<CatalogPanel />);
      expect(bowTiles().map((b) => b.getAttribute("aria-pressed"))).toEqual([
        "true",
        "false",
        "false",
        "false",
      ]);
      expect(sternTiles().map((b) => b.getAttribute("aria-pressed"))).toEqual([
        "true",
        "false",
        "false",
        "false",
      ]);
    });

    it("sets the bow and stern, leaving the tool and parts alone", async () => {
      const user = userEvent.setup();
      const onPick = jest.fn();
      render(<CatalogPanel onPick={onPick} />);
      await user.click(screen.getByRole("button", { name: /^Funnel/ }));
      onPick.mockClear();
      const parts = useShipBuilderStore.getState().ship.parts;

      await user.click(screen.getByRole("button", { name: "Clipper" }));
      await user.click(screen.getByRole("button", { name: "Canoe" }));

      const state = useShipBuilderStore.getState();
      expect(state.ship.hull).toMatchObject({ bow: "clipper", stern: "canoe" });
      expect(state.ship.parts).toEqual(parts);
      expect(state.tool).toMatchObject({ kind: "place", type: "funnel" });
      expect(onPick).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Clipper" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByRole("button", { name: "Straight" })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });

    it("is undoable", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.click(screen.getByRole("button", { name: "Bulbous" }));
      act(() => useShipBuilderStore.getState().undo());
      expect(useShipBuilderStore.getState().ship.hull.bow).toBe("straight");
    });

    it("gives every tile a touch target of at least 44px and dark styles", () => {
      render(<CatalogPanel />);
      for (const tile of [...bowTiles(), ...sternTiles()]) {
        // Tailwind min-h-16 is 64px, comfortably over 44px.
        expect(tile.className).toMatch(/min-h-(1[1-9]|[2-9]\d)\b/);
        expect(tile.className).toContain("dark:");
      }
    });
  });
});
