import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewShipDialog from "../NewShipDialog";
import Toolbar from "../Toolbar";
import { SHIP_KINDS } from "@/lib/ship-builder/model/kinds";
import { emptyShip } from "@/lib/ship-builder/model/placement";
import { gridPart, testShip } from "@/lib/ship-builder/testing";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() =>
    useShipBuilderStore.setState({
      ...createInitialState(),
      ship: testShip([gridPart("a", "deck-1x1", 0, 0, 0)]),
      savedId: "ship-1",
    })
  );
});

describe("NewShipDialog", () => {
  it("shows four cards, each with an icon, a name and a line of text", () => {
    render(<NewShipDialog onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "New ship" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    for (const name of [
      /Ocean liner \(1910s\)/,
      /Cruise ship/,
      /Navy ship/,
      /Cargo ship/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    const icons = screen.getAllByTestId("ship-kind-icon");
    expect(icons.map((i) => i.getAttribute("data-kind"))).toEqual([
      ...SHIP_KINDS,
    ]);
    expect(new Set(icons.map((i) => i.innerHTML)).size).toBe(4);
  });

  it("makes the cards tall, with light and dark styles", () => {
    render(<NewShipDialog onClose={jest.fn()} />);
    const cards = SHIP_KINDS.map((kind) =>
      document.querySelector<HTMLElement>(`button[data-kind="${kind}"]`)
    );
    for (const card of cards) {
      // Tailwind min-h-32 is 128px.
      expect(card?.className).toMatch(/min-h-(3[2-9]|[4-9]\d)\b/);
      expect(card?.className).toContain("dark:");
    }
    expect(card0Grid()).toMatch(/\bgrid-cols-2\b/);
  });

  it.each([
    ["Ocean liner", "liner"],
    ["Cruise ship", "cruise"],
    ["Navy ship", "navy"],
    ["Cargo ship", "cargo"],
  ] as const)("choosing %s starts a %s ship and closes", async (name, kind) => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<NewShipDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: new RegExp(name) }));
    expect(store().ship).toEqual(emptyShip(kind));
    expect(store().savedId).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("changes nothing on Cancel or Escape", async () => {
    const user = userEvent.setup();
    const before = store().ship;
    const onClose = jest.fn();
    render(<NewShipDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(store().ship).toBe(before);
    expect(store().savedId).toBe("ship-1");
    expect(store().past).toHaveLength(0);
  });

  it("focuses the first card and keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<NewShipDialog onClose={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Ocean liner/ })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /Ocean liner/ })).toHaveFocus();
  });
});

function card0Grid(): string {
  return document.querySelector("ul")?.className ?? "";
}

describe("Toolbar New button", () => {
  it("opens the dialog without changing the ship, and restores focus", async () => {
    const user = userEvent.setup();
    const before = store().ship;
    render(<Toolbar />);
    const newButton = screen.getByRole("button", { name: "New" });
    await user.click(newButton);
    expect(screen.getByRole("dialog", { name: "New ship" })).toBeVisible();
    expect(store().ship).toBe(before);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(newButton).toHaveFocus();
    expect(store().ship).toBe(before);
  });

  it("starts the chosen kind, undoable", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("button", { name: /Cargo ship/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store().ship.kind).toBe("cargo");
    act(() => store().undo());
    expect(store().ship.parts).toHaveLength(1);
    expect(store().savedId).toBe("ship-1");
  });
});
