import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaintBar, { SWATCH_FILL } from "../PaintBar";
import PlacementHint from "../PlacementHint";
import { PAINT_COLORS } from "@/lib/ship-builder/model/paint";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("PaintBar", () => {
  it("renders nothing outside paint mode", () => {
    render(<PaintBar />);
    expect(screen.queryByRole("group", { name: "Paint colours" })).toBeNull();
  });

  it("shows one named swatch per colour with the current one pressed", () => {
    act(() => store().selectPaint("red"));
    render(<PaintBar />);
    for (const { name } of PAINT_COLORS) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(PAINT_COLORS).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Navy" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("makes every swatch at least 44px", () => {
    act(() => store().selectPaint("red"));
    render(<PaintBar />);
    for (const { name } of PAINT_COLORS) {
      expect(screen.getByRole("button", { name })).toHaveClass("h-11", "w-11");
    }
  });

  it("picks a colour", async () => {
    const user = userEvent.setup();
    act(() => store().selectPaint("red"));
    render(<PaintBar />);
    await user.click(screen.getByRole("button", { name: "Green" }));
    expect(store().tool).toEqual({ kind: "paint", color: "green" });
  });

  it("closes paint mode with the X button", async () => {
    const user = userEvent.setup();
    act(() => store().selectPaint("red"));
    render(<PaintBar />);
    await user.click(screen.getByRole("button", { name: "Close paint bar" }));
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("keeps each swatch fill in step with the palette", () => {
    for (const { id, hex } of PAINT_COLORS) {
      expect(SWATCH_FILL[id]).toBe(`bg-[${hex}]`);
    }
  });

  it("leaves paint mode when a part is picked", () => {
    act(() => store().selectPaint("red"));
    act(() => store().selectTool("deck-1x1"));
    expect(store().tool.kind).toBe("place");
  });
});

describe("PlacementHint in paint mode", () => {
  it("tells the player what to tap", () => {
    act(() => store().selectPaint("red"));
    render(<PlacementHint />);
    expect(
      screen.getByText("Painting · tap a part or the hull")
    ).toBeInTheDocument();
  });
});
