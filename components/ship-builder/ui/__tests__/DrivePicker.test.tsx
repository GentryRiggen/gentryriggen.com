import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEFAULT_DRIVE_PREFS,
  loadDrivePrefs,
} from "@/lib/ship-builder/sail/driveConfig";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { TEMPLATES } from "@/lib/ship-builder/templates";
import DriveButton from "../DriveButton";
import DriveEndButton from "../DriveEndButton";
import DrivePicker from "../DrivePicker";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  window.localStorage.clear();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

afterEach(() => jest.restoreAllMocks());

function openPicker() {
  act(() => store().openDrive());
}

describe("DrivePicker", () => {
  it("renders nothing until the picker is opened", () => {
    render(<DrivePicker />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openPicker();
    expect(
      screen.getByRole("dialog", { name: "Set sail" })
    ).toBeInTheDocument();
  });

  it("starts the drive with the chosen kinds and density, and remembers them", async () => {
    const user = userEvent.setup();
    openPicker();
    render(<DrivePicker />);
    await user.click(screen.getByRole("button", { name: "Icebergs" }));
    await user.click(screen.getByRole("button", { name: "Other ships" }));
    await user.click(screen.getByRole("button", { name: "Many" }));
    await user.click(screen.getByRole("button", { name: "Set sail" }));

    const { drive } = store();
    if (drive.status !== "sailing") throw new Error("not sailing");
    expect(drive.config.kinds).toEqual(["rock", "buoy", "ship"]);
    expect(drive.config.density).toBe("many");
    expect(loadDrivePrefs()).toEqual({
      kinds: ["rock", "buoy", "ship"],
      density: "many",
    });
  });

  it("allows zero obstacles as open water", async () => {
    const user = userEvent.setup();
    openPicker();
    render(<DrivePicker />);
    for (const name of ["Icebergs", "Rocks", "Buoys"]) {
      await user.click(screen.getByRole("button", { name }));
    }
    expect(screen.getByText(/open water/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set sail" }));
    expect(store().drive).toMatchObject({
      status: "sailing",
      config: { kinds: [] },
    });
  });

  it("cancels with the button and with Escape", async () => {
    const user = userEvent.setup();
    openPicker();
    render(<DrivePicker />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store().drive.status).toBe("idle");

    openPicker();
    await user.keyboard("{Escape}");
    expect(store().drive.status).toBe("idle");
  });

  it("starts from the remembered choices", () => {
    window.localStorage.setItem(
      "ship-builder:ui:drive",
      JSON.stringify({ kinds: ["rock"], density: "few" })
    );
    openPicker();
    render(<DrivePicker />);
    expect(screen.getByRole("button", { name: "Rocks" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Icebergs" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Few" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("still renders and sails with storage blocked", async () => {
    const user = userEvent.setup();
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadDrivePrefs()).toEqual(DEFAULT_DRIVE_PREFS);
    openPicker();
    render(<DrivePicker />);
    await user.click(screen.getByRole("button", { name: "Set sail" }));
    expect(store().drive.status).toBe("sailing");
  });

  it("falls back to defaults for garbled storage", () => {
    window.localStorage.setItem("ship-builder:ui:drive", "{nope");
    expect(loadDrivePrefs()).toEqual(DEFAULT_DRIVE_PREFS);
    window.localStorage.setItem(
      "ship-builder:ui:drive",
      JSON.stringify({ kinds: ["kraken", "rock"], density: "lots" })
    );
    expect(loadDrivePrefs()).toEqual({
      kinds: ["rock"],
      density: DEFAULT_DRIVE_PREFS.density,
    });
  });
});

describe("DriveButton", () => {
  it("is disabled with a hint while the ship has no engine", () => {
    render(<DriveButton />);
    const button = screen.getByRole("button", { name: "Drive" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Add an engine to drive");
  });
});

describe("DriveButton with an engine", () => {
  it("opens the picker", async () => {
    const user = userEvent.setup();
    act(() => store().loadShip(TEMPLATES.cruise[0].build(), null));
    render(<DriveButton />);
    await user.click(screen.getByRole("button", { name: "Drive" }));
    expect(store().drive.status).toBe("setup");
  });
});

describe("DriveEndButton", () => {
  it("shows only while sailing and ends the drive", async () => {
    const user = userEvent.setup();
    render(<DriveEndButton />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    act(() => {
      store().openDrive();
      store().startDrive({ seed: 1, kinds: [], density: "few" });
    });
    await user.click(screen.getByRole("button", { name: "End drive" }));
    expect(store().drive.status).toBe("idle");
  });
});
