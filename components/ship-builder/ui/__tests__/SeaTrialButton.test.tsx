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
  it("is a menu button that opens on click and lists the three trials", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Waves",
      "Shipwreck storm",
      "Iceberg",
    ]);
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.querySelector("svg")).not.toBeNull();
    }
    expect(screen.getByRole("menuitem", { name: "Waves" })).toHaveFocus();
  });

  it("stays closed when the button comes back after being hidden", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    expect(screen.getByRole("menu")).toBeInTheDocument();

    act(() => store().aimIceberg());
    expect(screen.queryByRole("button", { name: "Sea trial" })).toBeNull();
    act(() => store().cancelAim());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("is hidden while the drive picker or a drive is on", () => {
    render(<SeaTrialButton />);
    act(() => store().openDrive());
    expect(screen.queryByRole("button", { name: "Sea trial" })).toBeNull();
    act(() => store().startDrive({ seed: 1, kinds: [], density: "few" }));
    expect(screen.queryByRole("button", { name: "Sea trial" })).toBeNull();
    act(() => store().endDrive());
    expect(trigger()).toBeVisible();
  });

  it("Waves opens its setup card", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Waves" }));
    expect(store().trial).toEqual({
      status: "setup",
      kind: "waves",
      look: { sea: "calm", time: "day" },
    });
  });

  it("Shipwreck storm opens its setup card", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Shipwreck storm" }));
    expect(store().trial).toEqual({
      status: "setup",
      kind: "storm",
      look: { sea: "wild", time: "day" },
    });
  });

  it("Iceberg starts aiming", async () => {
    const user = userEvent.setup();
    render(<SeaTrialButton />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Iceberg" }));
    expect(store().trial).toEqual({
      status: "aiming",
      look: { sea: "calm", time: "day" },
    });
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
    expect(
      screen.getByRole("menuitem", { name: "Shipwreck storm" })
    ).toHaveFocus();
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
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(store().trial).toEqual({
      status: "aiming",
      look: { sea: "calm", time: "day" },
    });
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
