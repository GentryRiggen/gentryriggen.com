import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewShipDialog from "../NewShipDialog";
import AppHeader from "../AppHeader";
import { TEMPLATES, type ShipTemplate } from "@/lib/ship-builder/templates";
import { SHIP_KINDS, type ShipKind } from "@/lib/ship-builder/model/kinds";
import { emptyShip } from "@/lib/ship-builder/model/placement";
import { gridPart, testShip } from "@/lib/ship-builder/testing";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

jest.mock("@/components/ThemeToggle", () => () => null);

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
  it("shows five cards, each with an icon, a name and a line of text", () => {
    render(<NewShipDialog onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "New ship" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    for (const name of [
      /Ocean liner \(1910s\)/,
      /Cruise ship/,
      /Navy ship/,
      /Cargo ship/,
      /Pirate ship/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    const icons = screen.getAllByTestId("ship-kind-icon");
    expect(icons.map((i) => i.getAttribute("data-kind"))).toEqual([
      ...SHIP_KINDS,
    ]);
    expect(new Set(icons.map((i) => i.innerHTML)).size).toBe(5);
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
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Blank ship/ }));
    expect(store().ship).toEqual(emptyShip(kind));
    expect(store().savedId).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets the odd last card span both columns", () => {
    render(<NewShipDialog onClose={jest.fn()} />);
    const last = document.querySelector(
      'button[data-kind="pirate"]'
    )?.parentElement;
    expect(last?.className).toContain(
      "[&:last-child:nth-child(odd)]:col-span-2"
    );
  });

  it("lists Blank plus the four pirate templates and loads one", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<NewShipDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /Pirate ship/ }));
    const ids = Array.from(document.querySelectorAll("[data-template]"), (el) =>
      el.getAttribute("data-template")
    );
    expect(ids).toEqual(TEMPLATES.pirate.map((t) => t.id));
    expect(ids).toHaveLength(4);
    expect(document.querySelectorAll("[data-card]")).toHaveLength(5);
    await user.click(
      document.querySelector<HTMLElement>('[data-template="whydah-gally"]')!
    );
    expect(store().ship.kind).toBe("pirate");
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

describe("NewShipDialog step 2", () => {
  const TEMPLATE_STUB: ShipTemplate = {
    id: "stub",
    kind: "liner",
    name: "RMS Stub",
    year: 1999,
    blurb: "A pretend ship.",
    build: () => ({ ...emptyShip("liner"), name: "RMS Stub" }),
  };
  const templates = TEMPLATES as Record<ShipKind, readonly ShipTemplate[]>;
  const original = { ...TEMPLATES };

  afterEach(() => {
    Object.assign(templates, original);
  });

  it("lists Blank ship and each template with name, year and blurb", async () => {
    templates.liner = [TEMPLATE_STUB];
    const user = userEvent.setup();
    render(<NewShipDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /Ocean liner/ }));
    expect(screen.getByRole("button", { name: /Blank ship/ })).toHaveFocus();
    const card = screen.getByRole("button", { name: /RMS Stub \(1999\)/ });
    expect(card).toHaveTextContent("A pretend ship.");
    expect(screen.getAllByTestId("ship-kind-icon")).toHaveLength(2);
  });

  it("loads the template as a new undoable ship and closes", async () => {
    templates.liner = [TEMPLATE_STUB];
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<NewShipDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /Ocean liner/ }));
    await user.click(screen.getByRole("button", { name: /RMS Stub/ }));
    expect(store().ship.name).toBe("RMS Stub");
    expect(store().savedId).toBeNull();
    expect(store().tool).toEqual({ kind: "none" });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => store().undo());
    expect(store().ship.parts).toHaveLength(1);
    expect(store().savedId).toBe("ship-1");
  });

  it("shows only Blank ship for a kind without templates", async () => {
    templates.navy = [];
    const user = userEvent.setup();
    render(<NewShipDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /Navy ship/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Blank ship/ })).toBeVisible();
  });

  it("goes back on Back and on Escape, then closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<NewShipDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /Cargo ship/ }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Cargo ship/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Cargo ship/ }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /Ocean liner/ })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the dialog on step 2", async () => {
    const user = userEvent.setup();
    render(<NewShipDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /Cargo ship/ }));
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /Blank ship/ })).toHaveFocus();
  });
});

function card0Grid(): string {
  return document.querySelector("ul")?.className ?? "";
}

describe("Header New button", () => {
  it("opens the dialog without changing the ship, and restores focus", async () => {
    const user = userEvent.setup();
    const before = store().ship;
    render(<AppHeader />);
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
    render(<AppHeader />);
    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("button", { name: /Cargo ship/ }));
    await user.click(screen.getByRole("button", { name: /Blank ship/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store().ship.kind).toBe("cargo");
    act(() => store().undo());
    expect(store().ship.parts).toHaveLength(1);
    expect(store().savedId).toBe("ship-1");
  });
});
