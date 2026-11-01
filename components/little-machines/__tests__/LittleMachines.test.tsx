import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/little-machines/engine/engine";
import {
  SAVE_KEY,
  newSave,
  writeSave,
} from "@/lib/little-machines/engine/save";
import type { RunState } from "@/lib/little-machines/engine/types";
import { lightUniverse } from "@/lib/little-machines/universes/light";
import { COAST_LIGHTHOUSES } from "@/lib/little-machines/universes/light/resources";
import LittleMachines from "../LittleMachines";

function saveWith(run: RunState, extra: { completions?: number } = {}) {
  writeSave({
    ...newSave(),
    seenIntro: true,
    universes: {
      light: {
        run,
        best: null,
        completions: extra.completions ?? 0,
        embers: 0,
        prestigeUpgrades: {},
      },
    },
  });
}

/** A run that has already been through its intro moment. */
function startedRun(): RunState {
  return { ...newRun(lightUniverse), taps: 1, time: 5 };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("Little Machines hub", () => {
  it("shows the playable universe and the locked ones", async () => {
    render(<LittleMachines />);
    expect(
      await screen.findByRole("heading", { name: "Little Machines" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Keep the Light On" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Play/ })).toBeInTheDocument();
    for (const name of [
      "Make It Grow",
      "Build It Higher",
      "Make Everyone Smile",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Coming soon")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /What's new/ })).toHaveAttribute(
      "href",
      "/little-machines/versions"
    );
  });

  it("offers Continue and shows progress for a saved game", async () => {
    saveWith(startedRun(), { completions: 2 });
    render(<LittleMachines />);
    expect(
      await screen.findByRole("button", { name: /Continue/ })
    ).toBeInTheDocument();
    const facts = screen.getByTestId("lm-facts-light");
    expect(within(facts).getByText("Reached: The Coast")).toBeInTheDocument();
    expect(within(facts).getByText("Finished 2 times")).toBeInTheDocument();
  });
});

describe("Little Machines game", () => {
  it("shows the opening moment, then taps earn coins", async () => {
    const user = userEvent.setup();
    render(<LittleMachines />);
    await user.click(await screen.findByRole("button", { name: /Play/ }));
    expect(screen.getByTestId("lm-phase-overlay")).toHaveTextContent(
      "The Coast"
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByTestId("lm-res-coins")).toHaveTextContent("0");

    await user.click(screen.getByTestId("lm-tap"));
    expect(screen.getByTestId("lm-res-coins")).not.toHaveTextContent(/^0$/);
  });

  it("buys an upgrade with coins", async () => {
    const run = startedRun();
    run.resources.coins = 1_000_000;
    saveWith(run);
    const user = userEvent.setup();
    render(<LittleMachines />);
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    const list = screen.getByRole("region", { name: "Upgrades" });
    const buyable = within(list)
      .getAllByRole("button")
      .find((b) => !(b as HTMLButtonElement).disabled);
    expect(buyable).toBeDefined();
    await user.click(buyable as HTMLElement);

    const stored = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    const owned = stored.universes.light.run.owned as Record<string, number>;
    expect(Object.values(owned).some((level) => level > 0)).toBe(true);
    expect(stored.universes.light.run.resources.coins).toBeLessThan(1_000_000);
  });

  it("pauses for a phase moment when the run moves on", async () => {
    const run = startedRun();
    run.owned.lighthouse = COAST_LIGHTHOUSES - 1;
    saveWith(run);
    const user = userEvent.setup();
    render(<LittleMachines />);
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    const overlay = await waitFor(() => screen.getByTestId("lm-phase-overlay"));
    expect(overlay).toHaveTextContent("No More Night");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Continue" }));
    });
    expect(screen.queryByTestId("lm-phase-overlay")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No More Night" })
    ).toBeInTheDocument();
  });

  it("starts fresh instead of crashing on an out-of-range phase", async () => {
    saveWith({ ...startedRun(), phase: 9 });
    const user = userEvent.setup();
    render(<LittleMachines />);
    await user.click(await screen.findByRole("button", { name: /Continue/ }));
    expect(await screen.findByTestId("lm-phase-overlay")).toHaveTextContent(
      "The Coast"
    );
  });
});
