import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import {
  BONUS_INFO,
  BONUS_KINDS,
  squareAt,
} from "@/lib/plane-builder/prestige";
import { usePlaneBuilderStore as store } from "@/lib/plane-builder/state/store";
import SkyMap from "../SkyMap";

type PrestigePatch = Partial<ReturnType<typeof newProgress>["prestige"]>;

function setup(patch: PrestigePatch) {
  const progress = newProgress();
  progress.prestige = { ...progress.prestige, level: 1, ...patch };
  store.getState().hydrate(progress);
  return render(<SkyMap />);
}

/** A spot whose right-hand neighbour holds (or lacks) a bonus. */
function spotBeside(hasBonus: boolean): { x: number; y: number } {
  for (let x = -30; x < 30; x++) {
    if ((squareAt(x + 1, 0) !== null) === hasBonus) return { x, y: 0 };
  }
  throw new Error("no such square");
}

beforeEach(() => {
  store.setState(store.getInitialState(), true);
});

describe("SkyMap squares", () => {
  it("shows a mystery tile for a bonus square, without naming the bonus", () => {
    setup({ ...spotBeside(true), movePending: true });
    const button = screen.getByRole("button", { name: /^Move right: / });
    expect(button).toHaveAccessibleName("Move right: mystery bonus");
    expect(button).toHaveAttribute("data-square", "mystery");
    expect(button).toHaveTextContent("🎁");
    for (const kind of BONUS_KINDS) {
      expect(button).not.toHaveTextContent(BONUS_INFO[kind].emoji);
    }
  });

  it("shows plain empty sky for an empty square", () => {
    setup({ ...spotBeside(false), movePending: true });
    const button = screen.getByRole("button", { name: /^Move right: / });
    expect(button).toHaveAccessibleName("Move right: empty sky");
    expect(button).toHaveAttribute("data-square", "empty");
    expect(button).toBeEmptyDOMElement();
  });

  it("never leaks a bonus in an unvisited square's label or tile", () => {
    setup({ x: 0, y: 0, movePending: true });
    const group = screen.getByRole("group", { name: "Sky Map squares" });
    const squares = group.querySelectorAll('[data-square="mystery"]');
    for (const square of squares) {
      for (const kind of BONUS_KINDS) {
        expect(square).not.toHaveTextContent(BONUS_INFO[kind].emoji);
      }
    }
    for (const button of within(group).getAllByRole("button")) {
      for (const kind of BONUS_KINDS) {
        expect(button.getAttribute("aria-label")).not.toContain(
          BONUS_INFO[kind].name
        );
      }
    }
  });

  it("highlights visited squares and shows the bonus found there", () => {
    const { x, y } = spotBeside(true);
    const found = squareAt(x + 1, y);
    setup({ x, y, visited: [`${x + 1},${y}`] });
    const tile = document.querySelector('[data-square="visited"]');
    expect(tile).toHaveTextContent(BONUS_INFO[found!].emoji);
  });

  it("marks a visited empty square with a check", () => {
    const { x, y } = spotBeside(false);
    setup({ x, y, visited: [`${x + 1},${y}`] });
    expect(document.querySelector('[data-square="visited"]')).toHaveTextContent(
      "✓"
    );
  });

  it("still reveals the bonus in the message after a move", async () => {
    const spot = spotBeside(true);
    const found = squareAt(spot.x + 1, spot.y)!;
    setup({ ...spot, movePending: true });
    await userEvent.click(screen.getByRole("button", { name: /^Move right/ }));
    expect(screen.getByRole("status")).toHaveTextContent(
      `+1 ${BONUS_INFO[found].emoji} ${BONUS_INFO[found].name}!`
    );
  });
});

describe("SkyMap browse mode", () => {
  it("has no move buttons and goes back to the worlds", async () => {
    setup({ level: 0 });
    expect(
      within(
        screen.getByRole("group", { name: "Sky Map squares" })
      ).queryAllByRole("button")
    ).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(store.getState().screen).toBe("levels");
  });
});

describe("SkyMap help", () => {
  it("explains the map and lists all 8 bonuses with their effects", () => {
    setup({ level: 0 });
    expect(screen.getByText("How the Sky Map works")).toBeInTheDocument();
    expect(screen.getByText(/Beat all 10 worlds to Prestige/)).toBeVisible();
    expect(document.querySelectorAll("[data-legend]")).toHaveLength(8);
    for (const kind of BONUS_KINDS) {
      const row = document.querySelector(`[data-legend="${kind}"]`);
      expect(row).toHaveTextContent(BONUS_INFO[kind].name);
      expect(row).toHaveTextContent(BONUS_INFO[kind].effect);
      expect(row).toHaveTextContent(BONUS_INFO[kind].emoji);
    }
  });
});
