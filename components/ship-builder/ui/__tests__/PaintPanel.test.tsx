import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaintPanel, { SWATCH_FILL } from "../PaintPanel";
import { PAINT_COLORS } from "@/lib/ship-builder/model/paint";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("PaintPanel", () => {
  it("explains how painting and washing off work", () => {
    render(<PaintPanel />);
    expect(
      screen.getByText(/Tap a part or the hull to paint it/)
    ).toBeVisible();
    expect(screen.getByText(/wash the paint off/)).toBeVisible();
  });

  it("shows one named swatch per colour with the current one pressed", () => {
    act(() => store().selectPaint("red"));
    render(<PaintPanel />);
    for (const { name } of PAINT_COLORS) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(PAINT_COLORS).toHaveLength(15);
    expect(screen.getByRole("group", { name: "Paint colours" })).toBeVisible();
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
    render(<PaintPanel />);
    for (const { name } of PAINT_COLORS) {
      expect(screen.getByRole("button", { name })).toHaveClass("h-11", "w-11");
    }
  });

  it("picks a colour and calls onPick", async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    act(() => store().selectPaint("red"));
    render(<PaintPanel onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "Green" }));
    expect(store().tool).toEqual({ kind: "paint", color: "green" });
    expect(onPick).toHaveBeenCalledTimes(1);
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
