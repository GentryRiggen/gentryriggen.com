import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newSave } from "@/lib/ever-onward/engine/save";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import GameScreen from "../GameScreen";

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function renderScreen(run: RunState, onGreet = jest.fn()) {
  window.IntersectionObserver =
    QuietObserver as unknown as typeof IntersectionObserver;
  render(
    <GameScreen
      def={lightUniverse}
      universe={{
        run,
        best: null,
        completions: 0,
        embers: 0,
        prestigeUpgrades: {},
      }}
      overlay={null}
      onTap={jest.fn(() => 1)}
      onBuy={jest.fn()}
      onAction={jest.fn()}
      onGreet={onGreet}
      onChooseLantern={jest.fn()}
      onBuyEmber={jest.fn()}
      onRestart={jest.fn()}
      onLeave={jest.fn()}
      onDismissOverlay={jest.fn()}
      currentSave={newSave()}
      onReplaceSave={jest.fn()}
    />
  );
  return onGreet;
}

const withFlags = (flags: Record<string, boolean>): RunState => {
  const run = newRun(lightUniverse);
  return {
    ...run,
    taps: 1,
    time: 5,
    flags: { ...run.flags, ...flags },
    story: [...run.story, "visitor-mail"],
  };
};

describe("visitors", () => {
  it("shows a waiting visitor with its gift and greets it on a tap", async () => {
    const onGreet = renderScreen(withFlags({ "here-visitor-mail": true }));
    const card = screen.getByTestId("lm-visitor");
    expect(within(card).getByText("A mail boat")).toBeInTheDocument();
    expect(within(card).getByText(/A gift for you: .* coins/)).toBeVisible();
    await userEvent.click(
      within(card).getByRole("button", { name: "Say hello" })
    );
    expect(onGreet).toHaveBeenCalledWith("visitor-mail");
  });

  it("keeps a waiting visitor's line on its card, not in the story log too", () => {
    renderScreen(withFlags({ "here-visitor-mail": true }));
    const ticker = screen.getByTestId("lm-story-ticker");
    expect(within(ticker).queryByText(/A mail boat toots hello/)).toBeNull();
  });

  it("shows no card once the visitor is greeted, and logs it in the menu", async () => {
    renderScreen(
      withFlags({ "here-visitor-mail": true, "met-visitor-mail": true })
    );
    expect(screen.queryByTestId("lm-visitor")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const log = screen.getByRole("region", { name: "Logbook" });
    expect(within(log).getByText("A mail boat")).toBeInTheDocument();
    expect(within(log).getByText(/1 visitor so far/)).toBeInTheDocument();
  });

  it("says so when nobody has stopped by yet", async () => {
    renderScreen(withFlags({}));
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const log = screen.getByRole("region", { name: "Logbook" });
    expect(within(log).getByText(/no visitors yet/)).toBeInTheDocument();
  });
});

describe("someday cards", () => {
  it("greys out a hint at an upgrade that has not popped in", () => {
    const run = withFlags({});
    renderScreen({
      ...run,
      owned: { lens: 4 },
      revealed: ["lens", "keeper"],
    });
    const teaser = screen.getByTestId("lm-teaser");
    expect(within(teaser).getByText("Someday")).toBeInTheDocument();
    expect(
      within(teaser).getByText("When you have 3 keepers")
    ).toBeInTheDocument();
  });
});
