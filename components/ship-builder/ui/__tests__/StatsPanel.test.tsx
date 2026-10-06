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
import { findTemplate } from "@/lib/ship-builder/templates";
import StatsHud from "../StatsHud";

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

  it("shows a Cargo row in TEU only once there is cargo", () => {
    render(<StatsPanel />);
    expect(screen.queryByTestId("stat-cargo")).not.toBeInTheDocument();
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "container", 0, 2, 1),
          gridPart("b", "container", 1, 2, 1),
        ]),
      })
    );
    expect(screen.getByTestId("stat-cargo")).toHaveTextContent(/^4$/);
    expect(screen.getByText("Cargo")).toBeInTheDocument();
  });

  it("shows Sail area and Cannons rows only on a ship with sails and guns", () => {
    render(<StatsPanel />);
    expect(screen.queryByTestId("stat-sail-area")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stat-cannons")).not.toBeInTheDocument();
    act(() =>
      useShipBuilderStore.setState({
        ship: {
          ...emptyShip("pirate"),
          parts: [
            attachPart("m", "mast-wood-short", "hull", "mast-fore"),
            attachPart("s", "sail-square", "m", "sail:0"),
            attachPart("c", "cannon-chaser", "hull", "bowgun"),
          ],
        },
      })
    );
    expect(screen.getByTestId("stat-sail-area")).toHaveTextContent(/^3$/);
    expect(screen.getByTestId("stat-cannons")).toHaveTextContent(/^1$/);
    expect(
      screen.getByRole("heading", { name: /Queen Anne's Revenge \(1718\)/ })
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("reference-ship")).getByText("Cannons")
    ).toBeVisible();
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

  it("counts watertight compartments from the walls", () => {
    render(<StatsPanel />);
    expect(screen.getByText("Watertight compartments")).toBeInTheDocument();
    expect(screen.getByTestId("stat-compartments")).toHaveTextContent(/^1$/);
    act(() => useShipBuilderStore.getState().cycleBulkhead(2));
    act(() => useShipBuilderStore.getState().cycleBulkhead(4));
    expect(screen.getByTestId("stat-compartments")).toHaveTextContent(/^3$/);
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
      within(screen.getByRole("list", { name: "Checklist" })).getByText(
        /Crew need beds: 120 of 480/
      )
    ).toBeInTheDocument();
  });

  it("opens with the checklist, listing what is still to do", () => {
    render(<StatsPanel />);
    expect(
      screen.getByRole("heading", { name: "Ready to sail?" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stats" })).toBeNull();
    expect(screen.getByTestId("checks-progress")).toHaveTextContent(
      "1 of 5 done"
    );
    const list = screen.getByRole("list", { name: "Checklist" });
    expect(within(list).getByText(/Lifeboats seat 0 of 480/)).toBeVisible();
    expect(within(list).getByText(/No bridge/)).toBeVisible();
    expect(within(list).getAllByTestId("warning-icon")).toHaveLength(4);
    expect(within(list).getByText("Stays upright")).toBeVisible();
    expect(screen.queryByTestId("ready-to-sail")).toBeNull();
    expect(
      screen.getByRole("progressbar", { name: "Checklist progress" })
    ).toHaveAttribute("aria-valuenow", "1");
  });

  it("keeps checks in a stable order as they pass", () => {
    render(<StatsPanel />);
    const order = () =>
      within(screen.getByRole("list", { name: "Checklist" }))
        .getAllByRole("listitem")
        .map((li) => li.textContent);
    const before = order();
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("br", "bridge", 0, 1, 0)]),
      })
    );
    const after = order();
    expect(after).toHaveLength(before.length);
    expect(after[0]).toMatch(/^Bridge to steer from/);
    expect(after[0]).not.toMatch(/No bridge/);
  });

  it("celebrates when every check passes", () => {
    render(<StatsPanel />);
    const template = findTemplate("ocean-breeze");
    if (!template) throw new Error("missing template");
    act(() => useShipBuilderStore.setState({ ship: template.build() }));
    expect(screen.getByTestId("ready-to-sail")).toHaveTextContent(
      "Ready to sail!"
    );
    expect(screen.queryAllByTestId("check-todo")).toHaveLength(0);
    expect(screen.getByTestId("checks-progress")).toHaveTextContent(
      /^(\d+) of \1 done$/
    );
  });

  it("groups the numbers under People and Ship", () => {
    render(<StatsPanel />);
    const people = screen
      .getByRole("heading", { name: "People" })
      .closest("section");
    const ship = screen
      .getByRole("heading", { name: "Ship" })
      .closest("section");
    expect(people).toContainElement(screen.getByTestId("stat-coverage"));
    expect(people).toContainElement(screen.getByTestId("stat-seats"));
    expect(ship).toContainElement(screen.getByTestId("stat-tonnage"));
    expect(ship).toContainElement(screen.getByTestId("stat-stability"));
  });

  describe("comparison ship", () => {
    const showKind = (kind: Parameters<typeof emptyShip>[0]) =>
      act(() => useShipBuilderStore.setState({ ship: emptyShip(kind) }));
    const reference = () => screen.getByTestId("reference-ship");

    it("compares a liner to the Titanic with paired values", () => {
      render(<StatsPanel />);
      expect(
        screen.getByRole("heading", { name: "You vs RMS Titanic (1912)" })
      ).toBeInTheDocument();
      expect(within(reference()).getByText("Gross tonnage")).toBeVisible();
      expect(within(reference()).getByText("46,328")).toBeVisible();
      expect(within(reference()).getByText("1,178")).toBeVisible();
      expect(within(reference()).getByText("21 kn")).toBeVisible();
      expect(within(reference()).getByText("2,224")).toBeVisible();
      // "You" side: blank liner is 24,192 GRT and 480 aboard.
      expect(within(reference()).getByText("24,192")).toBeVisible();
      expect(within(reference()).getByText("480")).toBeVisible();
    });

    it("compares a cruise ship to Wonder of the Seas", () => {
      render(<StatsPanel />);
      showKind("cruise");
      expect(
        screen.getByRole("heading", { name: /Wonder of the Seas \(2022\)/ })
      ).toBeInTheDocument();
      for (const text of ["236,857", "22 kn", "5,734", "2,300"]) {
        expect(within(reference()).getByText(text)).toBeInTheDocument();
      }
      expect(screen.queryByText("46,328")).not.toBeInTheDocument();
    });

    it("compares a navy ship to a destroyer, noting its displacement", () => {
      render(<StatsPanel />);
      showKind("navy");
      expect(
        screen.getByRole("heading", { name: /Arleigh Burke destroyer/ })
      ).toBeInTheDocument();
      expect(within(reference()).queryByText("Gross tonnage")).toBeNull();
      expect(within(reference()).getByText("30 kn")).toBeVisible();
      expect(within(reference()).getByText("300")).toBeVisible();
      expect(screen.getByText("Displaces about 9,200 tons")).toBeVisible();
      expect(
        screen.getByTestId("stat-tonnage").closest("div")
      ).toHaveTextContent(/Gross tonnage/);
    });

    it("compares a cargo ship to the Ever Given", () => {
      render(<StatsPanel />);
      showKind("cargo");
      expect(
        screen.getByRole("heading", { name: /Ever Given \(2018\)/ })
      ).toBeInTheDocument();
      for (const text of ["219,079", "22.8 kn", "20,124 TEU", "25"]) {
        expect(within(reference()).getByText(text)).toBeInTheDocument();
      }
    });
  });
});

describe("StatsHud", () => {
  it("summarises checks, speed, people and coverage without any controls", () => {
    render(<StatsHud />);
    const hud = screen.getByTestId("stats-hud");
    expect(hud).toHaveTextContent("✓ 1/5");
    expect(hud).toHaveTextContent("0 kn");
    expect(hud).toHaveTextContent("480");
    expect(hud).toHaveTextContent("0%");
    expect(hud).toHaveAttribute("aria-hidden", "true");
    expect(within(hud).queryByRole("button")).toBeNull();
  });

  it("follows the ship", () => {
    render(<StatsHud />);
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("br", "bridge", 0, 1, 0)]),
      })
    );
    expect(screen.getByTestId("stats-hud")).toHaveTextContent("✓ 2/5");
  });
});
