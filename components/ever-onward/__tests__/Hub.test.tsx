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
