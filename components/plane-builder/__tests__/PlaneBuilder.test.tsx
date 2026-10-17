import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlaneBuilder from "../PlaneBuilder";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { SAVE_KEY, saveProgress } from "@/lib/plane-builder/persist/local";
import { usePlaneBuilderStore as store } from "@/lib/plane-builder/state/store";

jest.mock("@/components/ship-builder/hooks/useWebGLSupport", () => ({
  __esModule: true,
  default: () => true,
}));

jest.mock("../scene/GameStage", () => ({
  __esModule: true,
  default: () => null,
}));

beforeEach(() => {
  window.localStorage.clear();
  store.setState(store.getInitialState(), true);
});

describe("PlaneBuilder", () => {
  it("does not overwrite a real save on mount, but saves later changes", () => {
    const seeded = newProgress();
    seeded.levels.meadow.coins = 321;
    saveProgress(seeded);
    const before = window.localStorage.getItem(SAVE_KEY);

    render(<PlaneBuilder />);

    expect(window.localStorage.getItem(SAVE_KEY)).toBe(before);
    expect(store.getState().progress.levels.meadow.coins).toBe(321);

    act(() => {
      store.getState().restart("meadow");
    });
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY)!);
    expect(saved.progress.levels.meadow.coins).toBe(0);
  });

  it("shows a dismissible notice when the save was unreadable", async () => {
    window.localStorage.setItem(SAVE_KEY, "{not json");
    render(<PlaneBuilder />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your old save couldn't be read, so we started fresh. A copy was kept."
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("draws the level list inside the safe area", () => {
    render(<PlaneBuilder />);
    const level = screen.getByRole("article", { name: "Backyard Meadow" });
    expect(level.closest("[data-safe-area]")).toHaveClass(
      "pt-[env(safe-area-inset-top)]",
      "pb-[env(safe-area-inset-bottom)]"
    );
  });

  it("lets the hangar sheet run edge to edge", () => {
    render(<PlaneBuilder />);
    act(() => store.getState().openLevel("meadow"));
    const hangar = screen.getByRole("region", { name: "Hangar" });
    expect(hangar.closest("[data-safe-area]")).toBeNull();
  });
});
