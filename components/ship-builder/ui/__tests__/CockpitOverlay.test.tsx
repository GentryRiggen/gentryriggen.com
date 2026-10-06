import { act, render, screen } from "@testing-library/react";
import { SHIP_KINDS } from "@/lib/ship-builder/model/kinds";
import { resetSailInput } from "@/lib/ship-builder/state/sailInput";
import { publishSail } from "@/lib/ship-builder/state/sailLive";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import type { SailState } from "@/lib/ship-builder/sail/types";
import CockpitOverlay from "../CockpitOverlay";
import { controlsForKind } from "../controlsForKind";
import DriveHud from "../DriveHud";

beforeEach(() => {
  resetSailInput();
  act(() => {
    useShipBuilderStore.setState(createInitialState());
    publishSail(null);
  });
});

describe("CockpitOverlay", () => {
  it.each(SHIP_KINDS)("renders the %s cockpit", (kind) => {
    const { cockpit, wheelStyle, label } = controlsForKind[kind];
    render(<CockpitOverlay kind={kind} />);
    expect(screen.getByTestId("cockpit-overlay")).toHaveAttribute(
      "data-kind",
      kind
    );
    expect(screen.getByText(cockpit.instrumentName)).toBeInTheDocument();
    expect(screen.getByLabelText("Speed 0 knots")).toBeInTheDocument();
    // The very same wheel and lever the HUD shows, in the kind's own style.
    expect(
      screen.getByRole("img", { name: new RegExp(label) })
    ).toHaveAttribute("data-variant", wheelStyle.variant);
    expect(
      screen.getByRole("slider", { name: `${label} throttle` })
    ).toBeVisible();
  });

  it("gives each kind a different look", () => {
    const consoles = SHIP_KINDS.map((k) => controlsForKind[k].cockpit);
    expect(new Set(consoles.map((c) => c.consoleClass)).size).toBe(5);
    expect(new Set(consoles.map((c) => c.instrumentName)).size).toBe(5);
    const variants = SHIP_KINDS.map(
      (k) => controlsForKind[k].wheelStyle.variant
    );
    expect(new Set(variants).size).toBe(4);
  });

  it("is light and dark safe on every class string", () => {
    for (const kind of SHIP_KINDS) {
      const { cockpit } = controlsForKind[kind];
      for (const value of [
        cockpit.consoleClass,
        cockpit.readoutClass,
        cockpit.gaugeClass,
        cockpit.needleClass,
        cockpit.captionClass,
      ]) {
        expect(value).toContain("dark:");
      }
    }
  });

  it("reads the speed in knots", () => {
    render(<CockpitOverlay kind="liner" />);
    act(() => {
      publishSail({ speed: 2, rudder: 0 } as SailState);
    });
    expect(screen.getByLabelText("Speed 10 knots")).toBeInTheDocument();
  });
});

describe("DriveHud in bridge view", () => {
  it("swaps the plain controls for the cockpit, with one wheel and one lever", () => {
    render(<DriveHud />);
    act(() => {
      useShipBuilderStore.getState().openDrive();
      useShipBuilderStore
        .getState()
        .startDrive({ seed: 1, kinds: [], density: "few" });
    });
    expect(screen.queryByTestId("cockpit-overlay")).not.toBeInTheDocument();
    act(() => useShipBuilderStore.getState().setDriveView("bridge"));
    expect(screen.getByTestId("cockpit-overlay")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    expect(screen.getAllByLabelText(/^Speed \d+ knots$/)).toHaveLength(1);
  });
});
