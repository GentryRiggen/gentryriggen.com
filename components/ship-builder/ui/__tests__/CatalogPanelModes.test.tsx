import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CatalogPanel from "../CatalogPanel";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  window.localStorage.clear();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("CatalogPanel modes", () => {
  it("switches between Build and Paint from the store's tool", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    const build = screen.getByRole("button", { name: "Build" });
    const paint = screen.getByRole("button", { name: "Paint" });
    expect(build).toHaveAttribute("aria-pressed", "true");

    await user.click(paint);
    expect(store().tool).toEqual({ kind: "paint", color: "red" });
    expect(paint).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Paint colours" })).toBeVisible();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Decks" })).toBeNull();

    // Esc (or the viewport's Done button) cancels; the panel follows.
    act(() => store().cancel());
    expect(build).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("goes back to the last colour used", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    const paint = () => screen.getByRole("button", { name: "Paint" });
    await user.click(paint());
    await user.click(screen.getByRole("button", { name: "Navy" }));
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(store().tool).toEqual({ kind: "none" });
    await user.click(paint());
    expect(store().tool).toEqual({ kind: "paint", color: "navy" });
  });

  it("lists categories in build order", () => {
    render(<CatalogPanel />);
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings.slice(0, 6)).toEqual([
      "Hull",
      "Decks",
      "Cabins",
      "Command",
      "Funnels",
      "Propulsion",
    ]);
  });
});

describe("CatalogPanel Hull section", () => {
  const toggle = () => screen.getByRole("button", { name: /^Hull$/ });

  it("includes the size controls and collapses, remembering the choice", async () => {
    const user = userEvent.setup();
    const first = render(<CatalogPanel />);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("hull-length")).toBeVisible();
    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Bow" })).toBeNull();
    first.unmount();
    render(<CatalogPanel />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("still works when storage is blocked", async () => {
    const user = userEvent.setup();
    const spy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    render(<CatalogPanel />);
    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    spy.mockRestore();
  });

  it("opens while a search matches a hull shape", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("ship-builder:ui:hull-open", "0");
    render(<CatalogPanel />);
    await user.type(screen.getByRole("searchbox"), "clipper");
    expect(screen.getByRole("button", { name: "Clipper" })).toBeVisible();
  });
});

describe("CatalogPanel category chips", () => {
  it("scrolls to the tapped category", async () => {
    const user = userEvent.setup();
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<CatalogPanel />);
    await user.click(screen.getByRole("button", { name: "Jump to Masts" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    const target = scrollIntoView.mock.contexts[0] as HTMLElement;
    expect(target).toContainElement(
      screen.getByRole("heading", { name: "Masts" })
    );
  });

  it("only offers categories that have visible parts", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    await user.type(screen.getByRole("searchbox"), "funnel");
    expect(
      screen.getByRole("button", { name: "Jump to Funnels" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jump to Decks" })).toBeNull();
  });

  it("gives every chip a 44px touch area", () => {
    render(<CatalogPanel />);
    const group = screen.getByRole("group", { name: "Categories" });
    for (const chip of within(group).getAllByRole("button")) {
      expect(chip).toHaveClass("h-11");
    }
  });
});

describe("CatalogPanel part tiles", () => {
  it("shows the selected part's description under its category", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    expect(screen.queryByTestId("part-detail")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Funnel/ }));
    expect(screen.getByTestId("part-detail")).toHaveTextContent(/stokers/);
  });

  it("dims a part with nowhere to go but still lets it be picked", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    const mast = screen.getByRole("button", { name: /^Funnel/ });
    expect(mast).toHaveTextContent("Needs a deck block");
    await user.click(mast);
    expect(store().tool).toMatchObject({ kind: "place" });
  });

  it("does not dim a grid part", () => {
    render(<CatalogPanel />);
    expect(
      screen.getByRole("button", { name: /Deck block 1×1/ })
    ).not.toHaveTextContent(/Needs/);
  });
});
