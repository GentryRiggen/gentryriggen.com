import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Hangar from "../ui/Hangar";
import LevelSelect from "../ui/LevelSelect";
import Results from "../ui/Results";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { LEVELS } from "@/lib/plane-builder/levels";
import { tierPrice } from "@/lib/plane-builder/plane/catalog";
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
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Restart",
      })
    );
    expect(store.getState().progress.levels.meadow.coins).toBe(0);
  });

  it("hides Restart on a fresh level and cancels on Escape", async () => {
    render(<LevelSelect />);
    expect(
      screen.queryByRole("button", { name: "Restart" })
    ).not.toBeInTheDocument();

    const p = newProgress();
    p.levels.meadow.best = 10;
    act(() => store.getState().hydrate(p));
    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
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
    const name = `Buy Wings for ${price} coins`;
    expect(screen.getByRole("button", { name })).toBeDisabled();

    const p = newProgress();
    p.levels.meadow.coins = 1000;
    act(() => store.getState().hydrate(p));
    await userEvent.click(screen.getByRole("button", { name }));
    expect(store.getState().progress.levels.meadow.tiers.wings).toBe(1);
    expect(screen.getByLabelText(`${1000 - price} coins`)).toBeInTheDocument();
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
    expect(screen.getByText("+🪙65")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fly again" })).toBeVisible();
  });

  it("announces an unlock", () => {
    store.setState({ screen: "results", lastFlight: flight(true, "canyon") });
    render(<Results />);
    expect(screen.getByText("Level complete!")).toBeInTheDocument();
    expect(
      screen.getByText(`${LEVELS.canyon.name} unlocked!`)
    ).toBeInTheDocument();
  });
});
