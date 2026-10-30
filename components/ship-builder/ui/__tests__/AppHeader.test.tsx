import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppHeader from "../AppHeader";
import {
  recordBest,
  EMPTY_PROGRESS,
} from "@/lib/ship-builder/challenges/progress";
import { challengeProgress } from "@/lib/ship-builder/challenges/progressStore";
import { listShips } from "@/lib/ship-builder/persist/local";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

jest.mock("@/components/ThemeToggle", () => () => null);

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => {
    challengeProgress.resetMemory();
    useShipBuilderStore.setState(createInitialState());
  });
});

describe("AppHeader", () => {
  it("renames the ship", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    const name = screen.getByLabelText("Ship name");
    await user.clear(name);
    await user.type(name, "Olympic");
    expect(store().ship.name).toBe("Olympic");
  });

  it("blurs the ship name input on Escape", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    const name = screen.getByLabelText("Ship name");
    await user.click(name);
    expect(name).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(name).not.toHaveFocus();
  });

  it("saves to My Ships", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(listShips()).toHaveLength(1);
    expect(store().savedId).toBe(listShips()[0].id);
    expect(store().notice?.text).toBe("Saved to My Ships");
  });

  it("shows the star total on the Challenges button and opens the panel", async () => {
    const user = userEvent.setup();
    act(() =>
      challengeProgress.set(recordBest(EMPTY_PROGRESS, "a", "outlast", 170))
    );
    render(<AppHeader />);
    expect(screen.getByTestId("header-stars")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: /Challenges/ }));
    expect(screen.getByRole("dialog", { name: "Challenges" })).toBeVisible();
  });

  it("moves an unsaved ship's stars to its My Ships entry on first save", async () => {
    const user = userEvent.setup();
    act(() =>
      challengeProgress.set(
        recordBest(EMPTY_PROGRESS, "unsaved", "outlast", 170)
      )
    );
    render(<AppHeader />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const { designs } = challengeProgress.get();
    expect(designs.unsaved).toBeUndefined();
    expect(designs[listShips()[0].id]).toEqual({ outlast: 170 });
  });

  it("starting a new ship forgets the unsaved ship's stars", () => {
    act(() =>
      challengeProgress.set(
        recordBest(EMPTY_PROGRESS, "unsaved", "outlast", 170)
      )
    );
    act(() => store().newShip("liner"));
    expect(challengeProgress.get().designs).toEqual({});
  });

  it("updates the same My Ships entry when saved twice", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    const save = screen.getByRole("button", { name: "Save" });
    await user.click(save);
    const savedId = store().savedId;
    await user.click(save);
    expect(listShips()).toHaveLength(1);
    expect(store().savedId).toBe(savedId);
  });

  it("returns focus to My Ships when the dialog closes", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    const myShips = screen.getByRole("button", { name: "My Ships" });
    await user.click(myShips);
    expect(
      screen.getByRole("dialog", { name: "My Ships" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(myShips).toHaveFocus();
  });

  it("links to the versions page", () => {
    render(<AppHeader />);
    expect(screen.getByTestId("app-version")).toHaveAttribute(
      "href",
      "/ship-builder/versions"
    );
  });
});
