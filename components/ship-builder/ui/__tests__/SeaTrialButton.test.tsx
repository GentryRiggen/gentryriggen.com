import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import SeaTrialButton from "../SeaTrialButton";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

function trigger() {
  return screen.getByRole("button", { name: "Sea trial" });
}

describe("SeaTrialButton menu", () => {
  it("is a menu button that opens on click and lists Waves and Iceberg", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Waves",
      "Iceberg",
    ]);
    expect(screen.getByRole("menuitem", { name: "Waves" })).toHaveFocus();
  });

  it("Waves starts the plain sea trial", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Waves" }));
    const { trial } = store();
    expect(trial.status).toBe("running");
    if (trial.status === "running") {
      expect(trial.input.iceberg).toBeUndefined();
    }
  });

  it("Iceberg starts aiming", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Iceberg" }));
    expect(store().trial).toEqual({ status: "aiming" });
  });

  it("comes back with the menu closed after aiming is cancelled", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Iceberg" }));
    act(() => store().cancelAim());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("works from the keyboard: arrows move, Enter picks, Esc closes", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Waves" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Iceberg" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Waves" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Iceberg" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(store().trial).toEqual({ status: "aiming" });
  });

  it("closes on a press outside", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("is hidden while aiming", () => {
    act(() => store().aimIceberg());
    const { container } = render(<SeaTrialButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
