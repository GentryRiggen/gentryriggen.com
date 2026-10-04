import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { visibleParts } from "@/lib/ship-builder/model/catalog";
import { PART_TYPES } from "@/lib/ship-builder/model/types";
import CatalogPanel from "../CatalogPanel";
import Drawer from "../Drawer";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import { emptyShip } from "@/lib/ship-builder/model/placement";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

beforeEach(() => {
  window.localStorage.clear();
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
    expect(screen.getAllByTestId("part-icon")).toHaveLength(
      visibleParts("liner", false).length
    );
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

  describe("Search", () => {
    const box = () => screen.getByRole("searchbox", { name: "Search parts" });

    it("finds a part despite a typo and hides everything else", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.type(box(), "funel");
      expect(
        screen.getByRole("button", { name: /^Funnel/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Mast/ })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Decks" })
      ).not.toBeInTheDocument();
    });

    it("finds Lifeboat for 'lifebot'", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.type(box(), "lifebot");
      expect(
        screen.getByRole("button", { name: /^Collapsible lifeboat/ })
      ).toBeInTheDocument();
    });

    it("matches by category name", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.type(box(), "cabins");
      expect(screen.getByRole("heading", { name: "Cabins" })).toBeVisible();
      expect(
        screen.queryByRole("heading", { name: "Funnels" })
      ).not.toBeInTheDocument();
    });

    it("searches hull shapes and hides the Hull section when nothing matches", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.type(box(), "clipper");
      expect(screen.getByRole("heading", { name: "Hull" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Clipper" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Canoe" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: "Stern" })
      ).not.toBeInTheDocument();

      await user.clear(box());
      await user.type(box(), "funnel");
      expect(
        screen.queryByRole("heading", { name: "Hull" })
      ).not.toBeInTheDocument();
    });

    it("selects hull shapes that are still visible", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.type(box(), "canoe");
      await user.click(screen.getByRole("button", { name: "Canoe" }));
      expect(useShipBuilderStore.getState().ship.hull.stern).toBe("canoe");
    });

    it("shows a message when nothing matches", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.type(box(), "zzzzzz");
      expect(screen.getByText("No parts match")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    });

    it("clears with the clear button", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      expect(
        screen.queryByRole("button", { name: "Clear search" })
      ).not.toBeInTheDocument();
      await user.type(box(), "funnel");
      await user.click(screen.getByRole("button", { name: "Clear search" }));
      expect(box()).toHaveValue("");
      expect(screen.getByRole("heading", { name: "Decks" })).toBeVisible();
    });

    it("clears on the first Escape and blurs on the second", async () => {
      const user = userEvent.setup();
      render(<CatalogPanel />);
      await user.type(box(), "funnel");
      await user.keyboard("{Escape}");
      expect(box()).toHaveValue("");
      expect(box()).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(box()).not.toHaveFocus();
    });

    it("does not trigger global shortcuts while typing", async () => {
      const user = userEvent.setup();
      function Harness() {
        useKeyboardShortcuts();
        return <CatalogPanel />;
      }
      render(<Harness />);
      act(() => useShipBuilderStore.getState().selectTool("deck-2x1"));
      await user.click(box());
      await user.keyboard("r{Backspace}{Escape}");
      expect(useShipBuilderStore.getState().tool).toMatchObject({
        kind: "place",
        rotation: 0,
      });
    });

    it("renders into the drawer's sticky header", () => {
      render(
        <Drawer side="left" label="Parts" open onOpenChange={() => {}}>
          <CatalogPanel />
        </Drawer>
      );
      expect(
        within(screen.getByTestId("drawer-header-Parts")).getByRole("searchbox")
      ).toBeInTheDocument();
      expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    });
  });

  describe("Kinds and Show all parts", () => {
    const showCruise = () =>
      act(() => useShipBuilderStore.setState({ ship: emptyShip("cruise") }));
    const funnelButton = () =>
      screen.queryByRole("button", { name: /^Funnel/ });
    const toggle = () => screen.getByRole("switch", { name: "Show all parts" });

    it("lists the liner-only parts for a liner", () => {
      render(<CatalogPanel />);
      expect(funnelButton()).toBeInTheDocument();
      expect(toggle()).toHaveAttribute("aria-checked", "false");
    });

    it("hides liner-only parts and lists the cruise funnel on a cruise ship", () => {
      showCruise();
      render(<CatalogPanel />);
      expect(funnelButton()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^(Collapsible|Large) lifeboat/ })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Modern funnel/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Lifeboat gear" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Mast/ })).toBeInTheDocument();
    });

    it("shows everything with the switch and remembers it", async () => {
      const user = userEvent.setup();
      showCruise();
      const first = render(<CatalogPanel />);
      await user.click(toggle());
      expect(toggle()).toHaveAttribute("aria-checked", "true");
      expect(funnelButton()).toBeInTheDocument();
      expect(screen.getAllByTestId("part-icon")).toHaveLength(
        PART_TYPES.length
      );
      first.unmount();
      render(<CatalogPanel />);
      expect(toggle()).toHaveAttribute("aria-checked", "true");
      expect(funnelButton()).toBeInTheDocument();
    });

    it("only searches the visible parts", async () => {
      const user = userEvent.setup();
      showCruise();
      render(<CatalogPanel />);
      const box = screen.getByRole("searchbox", { name: "Search parts" });
      await user.type(box, "collapsible");
      expect(
        screen.queryByRole("button", { name: /^Collapsible lifeboat/ })
      ).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("No parts match");
      await user.click(toggle());
      expect(
        screen.getByRole("button", { name: /^Collapsible lifeboat/ })
      ).toBeInTheDocument();
    });

    it("puts the switch in the drawer's sticky header beside the search", () => {
      render(
        <Drawer side="left" label="Parts" open onOpenChange={() => {}}>
          <CatalogPanel />
        </Drawer>
      );
      const search = screen.getByRole("searchbox", { name: "Search parts" });
      expect(search.closest("aside")).toContainElement(toggle());
    });
  });
});
