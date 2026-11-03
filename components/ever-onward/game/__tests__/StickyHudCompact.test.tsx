import { fireEvent, render, screen } from "@testing-library/react";
import StickyHud from "../StickyHud";

const base = {
  isCovered: false,
  resourceId: "coins",
  resourceLabel: "Coins",
  value: 2090000,
  rate: 93800,
  trend: "flat" as const,
  spend: null,
  effect: null,
  next: null,
  goal: {
    label: "LIGHT THE COAST",
    current: 5,
    target: 8,
    unit: "lighthouses",
    next: "Next lighthouse: 4.18M coins",
    progress: 0.5,
  },
  gauge: {
    label: "OIL",
    current: 300,
    max: 3000,
    isLow: true,
    isCritical: true,
  },
  onSelectNext: jest.fn(),
};

describe("StickyHud folded to one row", () => {
  it("shows the full bar when not folded", () => {
    render(<StickyHud {...base} />);
    expect(screen.getByTestId("lm-goal")).toBeInTheDocument();
    expect(screen.getByTestId("lm-hud-gauge")).toBeInTheDocument();
    expect(screen.queryByTestId("lm-hud-toggle")).not.toBeInTheDocument();
    expect(screen.getByTestId("lm-hud-details")).not.toHaveAttribute("inert");
  });

  it("keeps the money, a mini goal and a mini gauge in the slim row", () => {
    const onToggle = jest.fn();
    render(
      <StickyHud {...base} isCompact isFolded onToggleCompact={onToggle} />
    );
    expect(screen.getByTestId("lm-hud")).toHaveAttribute(
      "data-compact",
      "true"
    );
    // The details slide shut: still in the page, but hidden and inert.
    expect(screen.getByTestId("lm-hud-details")).toHaveAttribute("inert");
    expect(screen.getByTestId("lm-hud-details")).toHaveClass("invisible");
    expect(screen.getByTestId("lm-hud-mini-goal")).toHaveTextContent("5/8");
    expect(screen.getByTestId("lm-hud-mini-gauge")).toHaveAttribute(
      "data-tone",
      "critical"
    );
    const toggle = screen.getByRole("button", {
      name: "Show the goal and details",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalled();
  });

  it("leaves a bar-less gauge (a savings jar) out of the slim row", () => {
    render(
      <StickyHud
        {...base}
        gauge={{
          label: "RESERVOIR",
          current: 5000,
          max: 5000,
          isLow: false,
          isCritical: false,
          display: "5K saved",
          status: "",
          hasBar: false,
        }}
        isCompact
        isFolded
        onToggleCompact={jest.fn()}
      />
    );
    expect(screen.getByTestId("lm-hud-mini-goal")).toBeInTheDocument();
    expect(screen.queryByTestId("lm-hud-mini-gauge")).not.toBeInTheDocument();
  });

  it("offers to fold again while peeking", () => {
    render(<StickyHud {...base} isFolded onToggleCompact={jest.fn()} />);
    expect(screen.getByTestId("lm-goal")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fold the bar" })
    ).toHaveAttribute("aria-expanded", "true");
  });
});
