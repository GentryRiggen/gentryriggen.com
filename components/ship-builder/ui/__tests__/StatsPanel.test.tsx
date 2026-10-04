import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import StatsPanel from "../StatsPanel";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { emptyShip, validateShip } from "@/lib/ship-builder/model/placement";
import type { PartType } from "@/lib/ship-builder/model/types";
import { attachPart, gridPart, testShip } from "@/lib/ship-builder/testing";

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("StatsPanel", () => {
  it("renders stats for the store's ship", () => {
    render(<StatsPanel />);
    expect(screen.getByTestId("stat-passengers")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("stat-crew")).toHaveTextContent(/^480$/);
    expect(screen.getByTestId("stat-people")).toHaveTextContent(/^480$/);
    expect(screen.getByTestId("stat-seats")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent(/^0%$/);
    expect(screen.getByTestId("stat-tonnage")).toHaveTextContent(/^24,192$/);
    expect(screen.getByTestId("stat-speed")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("stat-stability")).toHaveTextContent(/^Stable$/);
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
    expect(screen.getByTestId("stat-passengers")).toHaveTextContent(/^30$/);
    expect(screen.getByTestId("stat-seats")).toHaveTextContent(/^65$/);
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent(/^13%$/);
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
    expect(screen.getByTestId("stat-people")).toHaveTextContent(/^420$/);
    expect(screen.getByTestId("stat-seats")).toHaveTextContent(/^419$/);
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent(/^99%$/);
  });

  it("shows crew beds against crew", () => {
    render(<StatsPanel />);
    expect(screen.getByTestId("stat-crew-beds")).toHaveTextContent(/^0$/);
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "cabin-crew", 0, 0, 0),
          gridPart("b", "cabin-crew", 0, 1, 0),
        ]),
      })
    );
    expect(screen.getByTestId("stat-crew-beds")).toHaveTextContent(/^120/);
    expect(
      within(screen.getByRole("list", { name: "Warnings" })).getByText(
        /Crew need beds: 120 of 480/
      )
    ).toBeInTheDocument();
  });

  it("lists warnings and the Titanic reference", () => {
    render(<StatsPanel />);
    const warnings = screen.getByRole("list", { name: "Warnings" });
    expect(
      within(warnings).getByText(/Lifeboats seat 0 of 480/)
    ).toBeInTheDocument();
    expect(within(warnings).getByText(/No bridge/)).toBeInTheDocument();
    expect(within(warnings).getAllByTestId("warning-icon")).toHaveLength(
      within(warnings).getAllByRole("listitem").length
    );
    expect(screen.getByText("46,328")).toBeInTheDocument();
    expect(screen.getByText("2,224")).toBeInTheDocument();
  });

  describe("comparison ship", () => {
    const showKind = (kind: Parameters<typeof emptyShip>[0]) =>
      act(() => useShipBuilderStore.setState({ ship: emptyShip(kind) }));
    const reference = () => screen.getByTestId("reference-ship");

    it("compares a liner to the Titanic", () => {
      render(<StatsPanel />);
      expect(
        screen.getByRole("heading", { name: "RMS Titanic (1912)" })
      ).toBeInTheDocument();
      expect(within(reference()).getByText("Tonnage")).toBeInTheDocument();
      expect(within(reference()).getByText("20 (1,178 seats)")).toBeVisible();
    });

    it("compares a cruise ship to Wonder of the Seas", () => {
      render(<StatsPanel />);
      showKind("cruise");
      expect(
        screen.getByRole("heading", { name: "Wonder of the Seas (2022)" })
      ).toBeInTheDocument();
      for (const text of ["236,857", "22 kn", "5,734", "2,300"]) {
        expect(within(reference()).getByText(text)).toBeInTheDocument();
      }
      expect(screen.queryByText("46,328")).not.toBeInTheDocument();
    });

    it("compares a navy ship to a destroyer by displacement", () => {
      render(<StatsPanel />);
      showKind("navy");
      expect(
        screen.getByRole("heading", { name: "Arleigh Burke destroyer" })
      ).toBeInTheDocument();
      expect(within(reference()).getByText("Displacement")).toBeVisible();
      expect(within(reference()).queryByText("Tonnage")).toBeNull();
      expect(within(reference()).getByText("9,200 t")).toBeVisible();
      expect(within(reference()).getByText("30+ kn")).toBeVisible();
      expect(within(reference()).getByText("about 300")).toBeVisible();
      // The player's ship keeps its gross tonnage: displacement is a mass,
      // which the model doesn't compute.
      expect(
        screen.getByTestId("stat-tonnage").closest("div")
      ).toHaveTextContent(/Gross tonnage/);
    });

    it("compares a cargo ship to the Ever Given", () => {
      render(<StatsPanel />);
      showKind("cargo");
      expect(
        screen.getByRole("heading", { name: "Ever Given (2018)" })
      ).toBeInTheDocument();
      for (const text of ["219,079", "22.8 kn", "20,124 TEU", "25"]) {
        expect(within(reference()).getByText(text)).toBeInTheDocument();
      }
    });
  });
});
