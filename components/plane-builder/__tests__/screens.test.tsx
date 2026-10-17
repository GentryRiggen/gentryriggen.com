import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Hangar from "../ui/Hangar";
import LevelSelect from "../ui/LevelSelect";
import FlightHud from "../ui/FlightHud";
import UpgradeTrack from "../ui/UpgradeTrack";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { LEVELS } from "@/lib/plane-builder/levels";
import { GAUGE_PERIOD } from "@/lib/plane-builder/minigame/gauge";
import {
  MAX_TIER,
  STARTER_TIERS,
  tierPrice,
} from "@/lib/plane-builder/plane/catalog";
import { planeStats } from "@/lib/plane-builder/plane/stats";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import {
  clearFlightToasts,
  flightToasts,
} from "@/lib/plane-builder/state/flightToasts";
import { launch } from "@/lib/plane-builder/sim/flight";
import { usePlaneBuilderStore as store } from "@/lib/plane-builder/state/store";
import { stubFrames } from "../testing/frames";

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

describe("Hangar after a flight", () => {
  const flight = (
    finished: boolean,
    unlocked: "canyon" | null,
    bonuses = { landingBonus: 15, milestoneBonus: 0 }
  ) => ({
    result: {
      distance: 120,
      coins: 5,
      rings: 0,
      finished,
      endReason: "landed" as const,
    },
    payout: {
      distancePay: 60,
      coinPay: 5,
      ...bonuses,
      multiplier: 1,
      total: 65,
    },
    isNewBest: true,
    previousBest: 0,
    unlocked,
    bonus: null,
  });

  it("shows how the flight went above the upgrades", () => {
    store.setState({ screen: "hangar", lastFlight: flight(false, null) });
    render(<Hangar />);
    const results = screen.getByRole("region", { name: "Flight results" });
    expect(results).toHaveTextContent("New best!");
    expect(results).toHaveTextContent("120 m");
    expect(results).toHaveTextContent(
      "Distance 60 + coins grabbed 5 × boost 1"
    );
    expect(results).toHaveTextContent("Total: +65");
    expect(results).toHaveTextContent("Nice landing +15");
    expect(results).not.toHaveTextContent("Milestone flags");
    expect(
      screen.getByRole("heading", { name: /^Nice landing!/ })
    ).toHaveFocus();
  });

  it("shows the milestone flag bonus when one was earned", () => {
    store.setState({
      screen: "hangar",
      lastFlight: flight(false, null, {
        landingBonus: 0,
        milestoneBonus: 260,
      }),
    });
    render(<Hangar />);
    const results = screen.getByRole("region", { name: "Flight results" });
    expect(results).toHaveTextContent("Milestone flags +260");
    expect(results).not.toHaveTextContent("Nice landing +");
  });

  it("shows no results before the first flight", () => {
    store.getState().openLevel("meadow");
    render(<Hangar />);
    expect(
      screen.queryByRole("region", { name: "Flight results" })
    ).not.toBeInTheDocument();
  });

  it("announces an unlock", () => {
    store.setState({ screen: "hangar", lastFlight: flight(true, "canyon") });
    render(<Hangar />);
    expect(screen.getByText("Level complete!")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("status")
        .some((el) => el.textContent?.includes("Level complete!"))
    ).toBe(true);
    expect(
      screen.getByText(`${LEVELS.canyon.name} unlocked!`)
    ).toBeInTheDocument();
  });
});

describe("Hangar coin bonus gauge", () => {
  const flight = {
    result: {
      distance: 120,
      coins: 5,
      rings: 0,
      finished: false,
      endReason: "landed" as const,
    },
    payout: {
      distancePay: 60,
      coinPay: 5,
      landingBonus: 0,
      milestoneBonus: 0,
      multiplier: 1,
      total: 100,
    },
    isNewBest: false,
    previousBest: 0,
    unlocked: null,
    bonus: null,
  };

  afterEach(() => jest.restoreAllMocks());

  it("shows the gauge and a Stop button until the bonus is claimed", () => {
    stubFrames();
    store.setState({ screen: "hangar", lastFlight: flight });
    render(<Hangar />);
    expect(
      screen.getByRole("meter", { name: "Coin bonus timing" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop!" })).toBeInTheDocument();
  });

  it("pays the bonus for where the marker stopped", async () => {
    const frames = stubFrames();
    store.setState({
      screen: "hangar",
      lastFlight: flight,
      progress: newProgress(),
    });
    render(<Hangar />);
    act(() => frames.at(GAUGE_PERIOD * 250));
    await userEvent.click(screen.getByRole("button", { name: "Stop!" }));

    expect(store.getState().lastFlight?.bonus).toMatchObject({
      zone: "green",
      multiplier: 2,
    });
    const results = screen.getByRole("region", { name: "Flight results" });
    expect(results).toHaveTextContent("Jackpot!");
    expect(results).toHaveTextContent("Coins ×2: +100");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop!" })
    ).not.toBeInTheDocument();
  });

  it("stops on Space when no control has focus", () => {
    const frames = stubFrames();
    store.setState({
      screen: "hangar",
      lastFlight: flight,
      progress: newProgress(),
    });
    render(<Hangar />);
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => frames.at(GAUGE_PERIOD * 500));
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );
    });
    expect(store.getState().lastFlight?.bonus?.zone).toBe("red");
    expect(
      screen.getByRole("region", { name: "Flight results" })
    ).toHaveTextContent("Kept your coins");
  });

  it("shows the earned bonus without a gauge when already claimed", () => {
    store.setState({
      screen: "hangar",
      lastFlight: {
        ...flight,
        bonus: { zone: "yellow", multiplier: 1.5, extra: 50 },
      },
    });
    render(<Hangar />);
    expect(screen.getByText(/Nice! Coins ×1.5: \+50/)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});

describe("FlightHud", () => {
  afterEach(() => {
    flightLive.set(null);
    clearFlightToasts();
    jest.useRealTimers();
  });

  const fly = (speed: number, coins: number) => {
    const s = launch(
      LEVELS.meadow,
      planeStats(LEVELS.meadow.plane, STARTER_TIERS),
      {
        pitch: 0.3,
        yaw: 0,
        power: 1,
      }
    );
    s.speed = speed;
    s.coins = coins;
    flightLive.set(s);
  };

  it("counts the wallet plus the coins grabbed this flight", () => {
    const p = newProgress();
    p.levels.meadow.coins = 400;
    store.getState().hydrate(p);
    store.setState({ screen: "flight", levelId: "meadow" });
    fly(20, 7);
    render(<FlightHud />);
    expect(screen.getByText("407")).toHaveTextContent("407 coins");
    expect(screen.getByText("+7")).toBeInTheDocument();
  });

  it("shows the speed in mph and warns when it gets too slow", () => {
    store.setState({ screen: "flight", levelId: "meadow" });
    fly(40, 0);
    const { unmount } = render(<FlightHud />);
    expect(screen.getByRole("meter", { name: "Speed" })).toHaveAttribute(
      "aria-valuenow",
      "89"
    );
    expect(screen.queryByText("Slow!")).not.toBeInTheDocument();
    unmount();

    fly(5, 0);
    render(<FlightHud />);
    expect(screen.getByText("Slow!")).toBeInTheDocument();
  });

  it("pops up a toast, announces it politely and removes it after 1.2 s", () => {
    jest.useFakeTimers();
    store.setState({ screen: "flight", levelId: "meadow" });
    fly(20, 0);
    render(<FlightHud />);
    act(() => flightToasts.push("Boost!"));
    const texts = screen.getAllByText("Boost!");
    expect(texts).toHaveLength(2);
    const live = texts.find((el) => el.getAttribute("aria-live") === "polite");
    expect(live).toHaveClass("sr-only");
    act(() => {
      jest.advanceTimersByTime(1300);
    });
    expect(screen.queryByText("Boost!")).not.toBeInTheDocument();
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
