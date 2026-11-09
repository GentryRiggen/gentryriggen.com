import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { STORY_GAP, advanceTold, type Told } from "../useToldStory";

const runWith = (story: string[], time: number) => ({
  ...newRun(lightUniverse),
  story,
  time,
});

describe("telling the story one line at a time", () => {
  const start: Told = { universe: "light", count: 1, at: 0 };

  it("holds a line that comes due right after another", () => {
    const run = runWith(["coast-hello", "coast-first-ship", "coast-ten"], 3);
    expect(advanceTold(lightUniverse, run, start).count).toBe(1);
  });

  it("tells the next line once the gap has passed, and only one", () => {
    const run = runWith(
      ["coast-hello", "coast-first-ship", "coast-ten"],
      STORY_GAP
    );
    const told = advanceTold(lightUniverse, run, start);
    expect(told).toEqual({ universe: "light", count: 2, at: STORY_GAP });
    expect(advanceTold(lightUniverse, run, told).count).toBe(2);
  });

  it("tells a part's opening line at once", () => {
    const run = runWith(["coast-hello", "night-hello"], 3);
    expect(advanceTold(lightUniverse, run, start).count).toBe(2);
  });

  it("counts everything as told after a restart", () => {
    const told = { universe: "light", count: 9, at: 600 };
    const run = runWith(["coast-hello"], 0);
    expect(advanceTold(lightUniverse, run, told)).toEqual({
      universe: "light",
      count: 1,
      at: 0,
    });
  });
});
