import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newSave } from "@/lib/ever-onward/engine/save";
import { ALL_UNIVERSES } from "@/lib/ever-onward/universes/staging";
import type { UniverseDef } from "@/lib/ever-onward/engine/types";
import GameScreen from "../GameScreen";

function showChapter(def: UniverseDef, phase: number) {
  const run = newRun(def);
  run.phase = phase;
  def.phases[phase].onEnter?.(run);
  run.taps = 30;
  run.revealed = def.upgrades
    .filter((u) => !u.phases || u.phases.includes(def.phases[phase].id))
    .map((u) => u.id);
  render(
    <GameScreen
      def={def}
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
      onGreet={jest.fn()}
      onChooseLantern={jest.fn()}
      onBuyEmber={jest.fn()}
      onDismissEmberTip={jest.fn()}
      onRestart={jest.fn()}
      onStartOver={jest.fn()}
      onLeave={jest.fn()}
      onDismissOverlay={jest.fn()}
      currentSave={newSave()}
      onReplaceSave={jest.fn()}
    />
  );
}

for (const def of ALL_UNIVERSES) {
  describe(def.title, () => {
    test.each([0, 1, 2, 3])(
      "chapter %i keeps goals, short cards and inspectable resources",
      async (phase) => {
        showChapter(def, phase);
        expect(screen.getByTestId("lm-goal")).toBeInTheDocument();
        const shop = screen.getByRole("region", { name: "Upgrades" });
        const about = within(shop).getAllByRole("button", {
          name: /^About/,
        })[0];
        expect(about).toHaveAttribute("aria-expanded", "false");
        await userEvent.click(about);
        expect(about).toHaveAttribute("aria-expanded", "true");
        const hasDetails = def.resources.some(
          (r) =>
            r.id !== def.phases[phase].manualResource &&
            (!r.phases || r.phases.includes(def.phases[phase].id))
        );
        if (hasDetails) {
          const disclosure = screen
            .getByText("More details")
            .closest("details")!;
          expect(disclosure).not.toHaveAttribute("open");
          await userEvent.click(screen.getByText("More details"));
          expect(disclosure).toHaveAttribute("open");
          expect(
            within(disclosure).getAllByRole("definition")[0].closest("dl")
          ).toBeVisible();
        } else expect(screen.queryByText("More details")).toBeNull();
        const actions = screen.queryByRole("region", { name: "Actions" });
        if (actions)
          expect(
            shop.compareDocumentPosition(actions) &
              Node.DOCUMENT_POSITION_FOLLOWING
          ).toBeTruthy();
      }
    );
  });
}
