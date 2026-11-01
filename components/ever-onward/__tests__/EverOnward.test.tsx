import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { SAVE_KEY, newSave, writeSave } from "@/lib/ever-onward/engine/save";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { COAST_LIGHTHOUSES } from "@/lib/ever-onward/universes/light/resources";
import EverOnward from "../EverOnward";

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

/** Renders the game and taps through the start screen to the hub. */
async function renderHub() {
  render(<EverOnward />);
  await userEvent.click(await screen.findByTestId("eo-start-button"));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("Ever Onward hub", () => {
  it("shows the playable universe and the locked ones", async () => {
    await renderHub();
    expect(
      await screen.findByRole("heading", { name: "Ever Onward" })
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
    expect(screen.getByRole("link", { name: /what's new/i })).toHaveAttribute(
      "href",
      "/ever-onward/versions"
    );
  });

  it("offers Continue and shows progress for a saved game", async () => {
    saveWith(startedRun(), { completions: 2 });
    await renderHub();
    expect(
      await screen.findByRole("button", { name: /Continue/ })
    ).toBeInTheDocument();
    const facts = screen.getByTestId("lm-facts-light");
    expect(within(facts).getByText("The Coast")).toBeInTheDocument();
    expect(within(facts).getByText("2 times")).toBeInTheDocument();
    expect(within(facts).getByText("Reached")).toBeInTheDocument();
    expect(within(facts).getByText("Finished")).toBeInTheDocument();
  });

  it("shows a fresh universe as PLAY with no stats, and locked ones dim", async () => {
    await renderHub();
    const play = await screen.findByTestId("lm-play-light");
    expect(play).toHaveTextContent("Play Keep the Light On");
    expect(screen.queryByTestId("lm-facts-light")).not.toBeInTheDocument();
    const locked = screen.getByLabelText("Make It Grow, coming soon");
    expect(locked.tagName).toBe("LI");
    expect(within(locked).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows best time and embers once earned", async () => {
    writeSave({
      ...newSave(),
      seenIntro: true,
      universes: {
        light: {
          run: startedRun(),
          best: 125000,
          completions: 1,
          embers: 7,
          prestigeUpgrades: {},
        },
      },
    });
    await renderHub();
    const facts = await screen.findByTestId("lm-facts-light");
    expect(within(facts).getByText("Best time")).toBeInTheDocument();
    expect(within(facts).getByText("Embers")).toBeInTheDocument();
    expect(within(facts).getByText("7")).toBeInTheDocument();
    expect(within(facts).getByText("1 time")).toBeInTheDocument();
  });
});

describe("Ever Onward game", () => {
  it("shows the opening moment, then taps earn coins", async () => {
    const user = userEvent.setup();
    await renderHub();
    await user.click(await screen.findByRole("button", { name: /Play/ }));
    expect(screen.getByTestId("lm-phase-overlay")).toHaveTextContent(
      "The Coast"
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByTestId("lm-hud-value")).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: "Flash the light" }));
    // The lamp's oil bill can eat a lone coin before the counter shows it,
    // so look for the tap's floating gain.
    expect(await screen.findByText(/^\+\d+$/)).toBeInTheDocument();
  });

  it("buys an upgrade with coins", async () => {
    const run = startedRun();
    run.resources.coins = 1_000_000;
    saveWith(run);
    const user = userEvent.setup();
    await renderHub();
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    const list = screen.getByRole("region", { name: "Upgrades" });
    const buyable = within(list)
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-disabled") !== "true");
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
    await renderHub();
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
    await renderHub();
    await user.click(await screen.findByRole("button", { name: /Continue/ }));
    expect(await screen.findByTestId("lm-phase-overlay")).toHaveTextContent(
      "The Coast"
    );
  });

  it("fills in resources a saved run is missing instead of showing NaN", async () => {
    const run = startedRun();
    delete run.resources.oil;
    delete run.resources.keepers;
    saveWith(run);
    const user = userEvent.setup();
    await renderHub();
    await user.click(await screen.findByRole("button", { name: /Continue/ }));
    expect(screen.getByTestId("lm-res-oil")).toHaveTextContent("0");
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("ignores taps and buys while a phase moment is open", async () => {
    const run = startedRun();
    run.owned.lighthouse = COAST_LIGHTHOUSES - 1;
    run.resources.coins = 1_000_000;
    saveWith(run);
    const user = userEvent.setup();
    await renderHub();
    await user.click(await screen.findByRole("button", { name: /Continue/ }));
    await waitFor(() => screen.getByTestId("lm-phase-overlay"));
    const before = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    expect(screen.getByTestId("lm-tap-fab")).toHaveAttribute("inert");
    await user.click(screen.getByTestId("lm-tap"));
    const after = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    expect(after.universes.light.run.taps).toBe(
      before.universes.light.run.taps
    );
  });
});
