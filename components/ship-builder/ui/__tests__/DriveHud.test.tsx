import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SHIP_KINDS } from "@/lib/ship-builder/model/kinds";
import { resetSailInput } from "@/lib/ship-builder/state/sailInput";
import { publishSail } from "@/lib/ship-builder/state/sailLive";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import type { SailState } from "@/lib/ship-builder/sail/types";
import { controlsForKind } from "../controlsForKind";
import DriveHud from "../DriveHud";

const store = () => useShipBuilderStore.getState();

function startSailing() {
  act(() => {
    store().openDrive();
    store().startDrive({ seed: 1, kinds: [], density: "few" });
  });
}

beforeEach(() => {
  resetSailInput();
  act(() => {
    useShipBuilderStore.setState(createInitialState());
    publishSail(null);
  });
});

describe("DriveHud", () => {
  it("shows only while sailing", () => {
    render(<DriveHud />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    startSailing();
    expect(screen.getByRole("button", { name: "End drive" })).toBeVisible();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("ends the drive from the End drive button", async () => {
    const user = userEvent.setup();
    render(<DriveHud />);
    startSailing();
    await user.click(screen.getByRole("button", { name: "End drive" }));
    expect(store().drive.status).toBe("idle");
  });

  it("switches the camera view", async () => {
    const user = userEvent.setup();
    render(<DriveHud />);
    startSailing();
    await user.click(screen.getByRole("button", { name: "Top" }));
    expect(store().drive).toMatchObject({ view: "top" });
    expect(screen.getByRole("button", { name: "Top" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(screen.getByRole("button", { name: "Bridge" }));
    expect(store().drive).toMatchObject({ view: "bridge" });
  });

  it("reads the speed in knots from the live sail state", () => {
    render(<DriveHud />);
    startSailing();
    expect(screen.getByLabelText("Speed 0 knots")).toBeInTheDocument();
    act(() => {
      publishSail({ speed: 2, rudder: 0 } as SailState); // 2 cells/s = 10 kn
    });
    expect(screen.getByLabelText("Speed 10 knots")).toBeInTheDocument();
  });

  it("has style data for every ship kind", () => {
    for (const kind of SHIP_KINDS) {
      const { wheelStyle, leverStyle, label } = controlsForKind[kind];
      expect(label).not.toBe("");
      expect(wheelStyle.rimClass).toContain("dark:");
      expect(leverStyle.knobClass).toContain("dark:");
    }
  });
});
