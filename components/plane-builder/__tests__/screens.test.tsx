import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Hangar from "../ui/Hangar";
import LevelSelect from "../ui/LevelSelect";
import Results from "../ui/Results";
import UpgradeTrack from "../ui/UpgradeTrack";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { LEVELS } from "@/lib/plane-builder/levels";
import { MAX_TIER, tierPrice } from "@/lib/plane-builder/plane/catalog";
import { usePlaneBuilderStore as store } from "@/lib/plane-builder/state/store";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  store.setState(store.getInitialState(), true);
});

describe("LevelSelect", () => {
  it("shows the canyon locked with no Play button", () => {
    render(<LevelSelect />);
    const card = screen.getByRole("article", { name: LEVELS.canyon.name });
    expect(card).toHaveTextContent(
      `Reach the finish in ${LEVELS.meadow.name} to unlock`
    );
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the hangar from Play", async () => {
    render(<LevelSelect />);
    await userEvent.click(
      screen.getByRole("button", {
        name: `Play ${LEVELS.meadow.name}`,
      })
    );
    expect(store.getState()).toMatchObject({
      screen: "hangar",
      levelId: "meadow",
    });
  });

  it("restarts only after confirming", async () => {
    const p = newProgress();
    p.levels.meadow.coins = 40;
    store.getState().hydrate(p);
    render(<LevelSelect />);

    await userEvent.click(
      screen.getByRole("button", { name: `Restart ${LEVELS.meadow.name}` })
    );
    const dialog = screen.getByRole("dialog", {
      name: `Restart ${LEVELS.meadow.name}?`,
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toHaveFocus();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" })
    );
    expect(store.getState().progress.levels.meadow.coins).toBe(40);

    await userEvent.click(
      screen.getByRole("button", { name: `Restart ${LEVELS.meadow.name}` })
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Restart",
      })
    );
    expect(store.getState().progress.levels.meadow.coins).toBe(0);
    // The Restart button is gone, so focus lands on the level's Play button.
    expect(
      screen.getByRole("button", { name: `Play ${LEVELS.meadow.name}` })
    ).toHaveFocus();
  });

  it("gives each level's buttons a unique name", () => {
    const p = newProgress();
    p.levels.meadow.finished = true;
    p.levels.meadow.best = 100;
    store.getState().hydrate(p);
    render(<LevelSelect />);
    expect(
      screen.getByRole("button", { name: `Replay ${LEVELS.meadow.name}` })
    ).toHaveTextContent("Replay");
    expect(
      screen.getByRole("button", { name: `Restart ${LEVELS.meadow.name}` })
    ).toHaveTextContent("Restart");
  });

  it("cancels on Escape even when focus is outside the dialog", async () => {
    const p = newProgress();
    p.levels.meadow.coins = 40;
    store.getState().hydrate(p);
    render(<LevelSelect />);
    await userEvent.click(
      screen.getByRole("button", { name: `Restart ${LEVELS.meadow.name}` })
    );
    act(() => document.body.focus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store.getState().progress.levels.meadow.coins).toBe(40);
  });

  it("keeps Tab inside the dialog and cancels on a backdrop click", async () => {
    const p = newProgress();
    p.levels.meadow.coins = 40;
    store.getState().hydrate(p);
    const { container } = render(<LevelSelect />);
    await userEvent.click(
      screen.getByRole("button", { name: `Restart ${LEVELS.meadow.name}` })
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.tab();
    expect(
      within(dialog).getByRole("button", { name: "Restart" })
    ).toHaveFocus();
    await userEvent.tab();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(
      within(dialog).getByRole("button", { name: "Restart" })
    ).toHaveFocus();

    // The backdrop is the dialog's parent.
    await userEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("hides Restart on a fresh level and cancels on Escape", async () => {
    render(<LevelSelect />);
    expect(
      screen.queryByRole("button", { name: `Restart ${LEVELS.meadow.name}` })
    ).not.toBeInTheDocument();

    const p = newProgress();
    p.levels.meadow.best = 10;
    act(() => store.getState().hydrate(p));
    await userEvent.click(
      screen.getByRole("button", { name: `Restart ${LEVELS.meadow.name}` })
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store.getState().progress.levels.meadow.best).toBe(10);
  });
});

describe("Hangar", () => {
  const price = tierPrice(LEVELS.meadow.plane.wings, 0)!;

  it("disables buying when too poor, buys when able", async () => {
    store.getState().openLevel("meadow");
    render(<Hangar />);
    expect(
      screen.getByRole("button", {
        name: `Buy Wings, need ${price} more coins`,
      })
    ).toBeDisabled();

    const p = newProgress();
    p.levels.meadow.coins = 1000;
    act(() => store.getState().hydrate(p));
    await userEvent.click(
      screen.getByRole("button", { name: `Buy Wings for ${price} coins` })
    );
    expect(store.getState().progress.levels.meadow.tiers.wings).toBe(1);
    expect(screen.getByText(`${1000 - price}`)).toHaveTextContent(
      `${1000 - price} coins`
    );
    expect(screen.getByText("Bought Folded wings!")).toBeInTheDocument();
  });

  it("keeps Launch! outside the scrolling upgrade list", () => {
    store.getState().openLevel("meadow");
    render(<Hangar />);
    const list = screen.getByRole("list");
    expect(list).not.toContainElement(
      screen.getByRole("button", { name: "Launch!" })
    );
  });
});

describe("Results", () => {
  const flight = (finished: boolean, unlocked: "canyon" | null) => ({
    result: {
      distance: 120,
      coins: 5,
      rings: 0,
      finished,
      endReason: "landed" as const,
    },
    payout: { distancePay: 60, coinPay: 5, multiplier: 1, total: 65 },
    isNewBest: true,
    previousBest: 0,
    unlocked,
  });

  it("shows new best and the total", () => {
    store.setState({ screen: "results", lastFlight: flight(false, null) });
    render(<Results />);
    expect(screen.getByText("New best!")).toBeInTheDocument();
    expect(screen.getByText("Distance: 60 coins")).toBeInTheDocument();
    expect(screen.getByText("Coins grabbed: 5")).toBeInTheDocument();
    expect(screen.getByText("Coin boost: ×1")).toBeInTheDocument();
    expect(screen.getByText("Total: +65")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nice landing!" })
    ).toHaveFocus();
  });

  it("Upgrade opens the hangar and Fly again starts a launch", async () => {
    store.setState({
      screen: "results",
      levelId: "meadow",
      lastFlight: flight(false, null),
    });
    const { unmount } = render(<Results />);
    await userEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    expect(store.getState().screen).toBe("hangar");
    unmount();

    store.setState({ screen: "results", lastFlight: flight(false, null) });
    render(<Results />);
    await userEvent.click(screen.getByRole("button", { name: "Fly again" }));
    expect(store.getState().screen).toBe("launch");
  });

  it("goes back to the levels when there is no flight to show", () => {
    store.setState({ screen: "results", lastFlight: null });
    render(<Results />);
    expect(store.getState().screen).toBe("levels");
  });

  it("announces an unlock", () => {
    store.setState({ screen: "results", lastFlight: flight(true, "canyon") });
    render(<Results />);
    expect(screen.getByText("Level complete!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Level complete!");
    expect(
      screen.getByText(`${LEVELS.canyon.name} unlocked!`)
    ).toBeInTheDocument();
  });
});

describe("UpgradeTrack", () => {
  const catalog = LEVELS.meadow.plane;

  it("says what comes next and the tier for screen readers", () => {
    render(
      <ul>
        <UpgradeTrack
          track="wings"
          catalog={catalog}
          tier={2}
          coins={0}
          onBuy={() => false}
        />
      </ul>
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      `Next: glide further`
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      `tier 2 of ${MAX_TIER}`
    );
  });

  it("shows no next line, and no tier number past the top, when maxed", () => {
    render(
      <ul>
        <UpgradeTrack
          track="wings"
          catalog={catalog}
          tier={MAX_TIER}
          coins={999999}
          onBuy={() => true}
        />
      </ul>
    );
    const row = screen.getByRole("listitem");
    expect(row).not.toHaveTextContent("Next:");
    expect(row).not.toHaveTextContent("Wings 9");
    expect(row).not.toHaveTextContent("→");
    expect(screen.getByRole("button", { name: "Wings maxed" })).toBeDisabled();
  });
});
