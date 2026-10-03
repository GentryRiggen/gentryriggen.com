import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import StatsPanel from "../StatsPanel";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { validateShip } from "@/lib/ship-builder/model/placement";
import type { PartType } from "@/lib/ship-builder/model/types";
import { attachPart, gridPart, testShip } from "@/lib/ship-builder/testing";

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("StatsPanel", () => {
  it("renders stats for the store's ship", () => {
    render(<StatsPanel />);
    expect(screen.getByTestId("stat-passengers")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-crew")).toHaveTextContent("480");
    expect(screen.getByTestId("stat-people")).toHaveTextContent("480");
    expect(screen.getByTestId("stat-seats")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent("0%");
    expect(screen.getByTestId("stat-tonnage")).toHaveTextContent("24,192");
    expect(screen.getByTestId("stat-speed")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-stability")).toHaveTextContent("Stable");
  });

  it("updates when the ship changes", () => {
    render(<StatsPanel />);
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 0),
          gridPart("b", "deck-1x1", 1, 2, 0),
          attachPart("dv", "davit", "b", "davit:2:0"),
          attachPart("lb", "lifeboat-standard", "dv", "boat"),
          gridPart("c", "cabin-1st", 0, 3, 0),
        ]),
      })
    );
    expect(screen.getByTestId("stat-passengers")).toHaveTextContent("30");
    expect(screen.getByTestId("stat-seats")).toHaveTextContent("65");
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent("13%");
  });

  it("never shows 100% coverage while short of seats", () => {
    // 7 segments → 420 crew. 5 standard (65) + 2 collapsible (47) boats seat
    // 419, so coverage is 0.9976, which plain rounding would show as 100%.
    const boats = [
      ...Array<PartType>(5).fill("lifeboat-standard"),
      ...Array<PartType>(2).fill("lifeboat-collapsible"),
    ];
    const parts = boats.flatMap((boat, x) => [
      gridPart(`lower-${x}`, "deck-1x1", 0, x, 0),
      gridPart(`upper-${x}`, "deck-1x1", 1, x, 0),
      attachPart(`davit-${x}`, "davit", `upper-${x}`, `davit:${x}:0`),
      attachPart(`boat-${x}`, boat, `davit-${x}`, "boat"),
    ]);
    const ship = testShip(parts, 7);
    expect(validateShip(ship)).toEqual({ ok: true });
    render(<StatsPanel />);
    act(() => useShipBuilderStore.setState({ ship }));
    expect(screen.getByTestId("stat-people")).toHaveTextContent("420");
    expect(screen.getByTestId("stat-seats")).toHaveTextContent("419");
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent("99%");
  });

  it("lists warnings and the Titanic reference", () => {
    render(<StatsPanel />);
    const warnings = screen.getByRole("list", { name: "Warnings" });
    expect(
      within(warnings).getByText(/Lifeboats seat 0 of 480/)
    ).toBeInTheDocument();
    expect(within(warnings).getByText(/No bridge/)).toBeInTheDocument();
    expect(screen.getByText("46,328")).toBeInTheDocument();
    expect(screen.getByText("2,224")).toBeInTheDocument();
  });
});
