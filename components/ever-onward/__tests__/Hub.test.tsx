import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newUniverseSave } from "@/lib/ever-onward/engine/prestige";
import { newSave } from "@/lib/ever-onward/engine/save";
import type { SaveData } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { GROW_TITLE_SCORE } from "../audio/growScores";
import { TITLE_SCORE } from "../audio/scores";
import Hub from "../Hub";
import { hubTitleScore } from "../universes";

function saveWithCompletions(completions: number): SaveData {
  return {
    ...newSave(),
    universes: {
      light: { ...newUniverseSave(lightUniverse), completions },
    },
  };
}

describe("Hub unlock", () => {
  it("shows Grow locked with its hint before the Lighthouse is finished", () => {
    render(
      <Hub
        save={saveWithCompletions(0)}
        isRecovered={false}
        onPlay={jest.fn()}
      />
    );
    const card = screen.getByTestId("lm-locked-grow");
    expect(card).toHaveTextContent("Opens when you finish Keep the Light On.");
    expect(screen.queryByTestId("lm-play-grow")).not.toBeInTheDocument();
  });

  it("shows the Grow play button after it", async () => {
    const onPlay = jest.fn();
    render(
      <Hub save={saveWithCompletions(1)} isRecovered={false} onPlay={onPlay} />
    );
    expect(screen.queryByTestId("lm-locked-grow")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("lm-play-grow"));
    expect(onPlay).toHaveBeenCalledWith("grow");
  });
});

describe("Hub test mode", () => {
  it("is hidden without the owner's test mode", () => {
    render(
      <Hub
        save={saveWithCompletions(0)}
        isRecovered={false}
        onPlay={jest.fn()}
      />
    );
    expect(screen.queryByTestId("eo-hub-test")).not.toBeInTheDocument();
  });

  it("jumps into a locked universe", async () => {
    const onJump = jest.fn();
    render(
      <Hub
        save={saveWithCompletions(0)}
        isRecovered={false}
        onPlay={jest.fn()}
        testMode={{ isJumping: false, onJump }}
      />
    );
    expect(screen.getByTestId("lm-locked-grow")).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Test mode/));
    await userEvent.click(screen.getByRole("button", { name: "Make It Grow" }));
    await userEvent.click(screen.getByTestId("eo-jump-grow-0-late"));
    expect(onJump).toHaveBeenCalledWith("grow", 0, "late");
  });
});

describe("hubTitleScore", () => {
  it("plays the usual theme while Grow is locked", () => {
    expect(hubTitleScore(saveWithCompletions(0))).toBe(TITLE_SCORE);
  });

  it("plays Grow's theme while it is open and unfinished", () => {
    expect(hubTitleScore(saveWithCompletions(1))).toBe(GROW_TITLE_SCORE);
  });

  it("goes back to the usual theme once Grow is finished", () => {
    const save = saveWithCompletions(1);
    save.universes.grow = { ...newUniverseSave(lightUniverse), completions: 1 };
    expect(hubTitleScore(save)).toBe(TITLE_SCORE);
  });
});

describe("Hub last played", () => {
  beforeEach(() => window.localStorage.clear());

  it("puts the last played universe first with a chip", () => {
    window.localStorage.setItem("ever-onward:last", "grow");
    render(
      <Hub
        save={saveWithCompletions(1)}
        isRecovered={false}
        onPlay={jest.fn()}
      />
    );
    const cards = screen.getAllByRole("listitem");
    expect(cards[0]).toContainElement(screen.getByTestId("lm-play-grow"));
    expect(cards[0]).toHaveTextContent("LAST PLAYED");
  });

  it("remembers the universe you play", async () => {
    render(
      <Hub
        save={saveWithCompletions(1)}
        isRecovered={false}
        onPlay={jest.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("lm-play-grow"));
    expect(window.localStorage.getItem("ever-onward:last")).toBe("grow");
  });
});
