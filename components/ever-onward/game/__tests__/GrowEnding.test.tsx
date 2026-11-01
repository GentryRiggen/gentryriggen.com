import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, visitorHereFlag } from "@/lib/ever-onward/engine/engine";
import { SAVE_KEY, newSave, writeSave } from "@/lib/ever-onward/engine/save";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { growUniverse } from "@/lib/ever-onward/universes/grow";
import { PHASE_IDS } from "@/lib/ever-onward/universes/grow/resources";
import { ENDING_STORY_IDS } from "@/lib/ever-onward/universes/grow/story";
import { RETURN_VISITOR_ID } from "@/lib/ever-onward/universes/grow/visitors";
import EverOnward from "../../EverOnward";
import { GROW_UI } from "../../universes/grow";
import EndingOverlay from "../EndingOverlay";

const def = growUniverse;
const textOf = (id: string): string =>
  def.story.find((m) => m.id === id)?.text ?? "";

/** A Grow run that bloomed and was finished (a visitor came back). */
function finishedRun(): RunState {
  const base = newRun(def);
  return {
    ...base,
    phase: PHASE_IDS.length - 1,
    time: 5400,
    taps: 900,
    complete: true,
    resources: { ...base.resources, growth: 100, potStage: 3 },
    flags: { [visitorHereFlag(RETURN_VISITOR_ID)]: true },
    story: ["seed-hello", ...ENDING_STORY_IDS],
    transitions: PHASE_IDS.slice(1).map((to, i) => ({
      from: PHASE_IDS[i],
      to,
      at: 600 * (i + 1),
    })),
  };
}

function saveFinished() {
  writeSave({
    ...newSave(),
    seenIntro: true,
    universes: {
      // Grow opens once the Lighthouse has been finished.
      light: {
        run: newRun(lightUniverse),
        best: 600,
        completions: 1,
        embers: 0,
        prestigeUpgrades: {},
      },
      grow: {
        run: finishedRun(),
        best: 5400,
        completions: 1,
        embers: 18,
        prestigeUpgrades: {},
      },
    },
  });
}

async function openGrow() {
  render(<EverOnward />);
  await userEvent.click(await screen.findByTestId("eo-start-button"));
  await userEvent.click(await screen.findByTestId("lm-play-grow"));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("the Last Seed ending", () => {
  it("shows the someone-comes-back art and the ending lines in order", () => {
    const Art = GROW_UI.ending.Art;
    expect(Art).toBeDefined();
    const run = finishedRun();
    const lines = GROW_UI.ending.storyIds.map(textOf);
    render(
      <EndingOverlay
        lines={lines}
        embers={18}
        label="Acorns"
        Icon={GROW_UI.PrestigeIcon}
        art={Art ? <Art run={run} /> : undefined}
        onContinue={jest.fn()}
      />
    );
    const dialog = screen.getByTestId("lm-ending");
    expect(within(dialog).getByTestId("lm-ending-art")).toBeInTheDocument();
    // The grown-up and the little one stand at the window.
    expect(within(dialog).getByTestId("lm-visitors")).toBeInTheDocument();
    const shown = within(dialog)
      .getAllByText(/./, { selector: "p" })
      .map((p) => p.textContent);
    const positions = lines.map((line) => shown.indexOf(line));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(lines[1]).toContain("I planted the first one, right there");
    expect(screen.getByTestId("lm-ending-embers")).toHaveTextContent(
      "18 acorns"
    );
  });

  it("says Acorns on the finished panel and offers a restart (Review Focus 5)", async () => {
    saveFinished();
    await openGrow();
    const panel = await screen.findByTestId("lm-embers");
    expect(within(panel).getByText("Acorns")).toBeInTheDocument();
    expect(panel).not.toHaveTextContent(/embers/i);
    expect(panel).toHaveTextContent("This run earns");
    expect(panel).toHaveTextContent(/acorns/);
    expect(
      within(panel).getByRole("button", { name: "Play again" })
    ).toBeInTheDocument();
    // Grow has no "Universe 2" pointer: it is the second universe.
    expect(panel).not.toHaveTextContent("Universe 2");
  });

  it("does not show the ending again when a finished save is reopened (Review Focus 5)", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      saveFinished();
      await openGrow();
      await screen.findByTestId("lm-embers");
      await act(async () => {
        jest.advanceTimersByTime(15_000);
      });
      expect(screen.queryByTestId("lm-ending")).not.toBeInTheDocument();
      expect(screen.queryByTestId("lm-phase-overlay")).not.toBeInTheDocument();
      // The run stays finished and the save is untouched by the reopen.
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
      expect(saved.universes.grow.run.complete).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("lists the ending lines in the Story drawer after reload", async () => {
    saveFinished();
    await openGrow();
    await userEvent.click(
      await screen.findByRole("button", { name: /Story \(/ })
    );
    const drawer = screen.getByRole("dialog", { name: "Story" });
    for (const id of ENDING_STORY_IDS) {
      expect(drawer).toHaveTextContent(textOf(id).slice(0, 40));
    }
  });
});
