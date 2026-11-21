import { titanic } from "../ships/titanic";
import { simulate } from "../sim/run";
import type { SimTrack } from "../sim/track";
import {
  captionFor,
  clockText,
  durationWords,
  endWords,
  MARK_PRIORITY,
  markRows,
  outcomeOf,
  sinceText,
  storyEndT,
  timelineMarks,
} from "../story";

describe("clock words", () => {
  it("counts the clock from 11:40 PM", () => {
    expect(clockText(0)).toBe("11:40 PM");
    expect(clockText(20 * 60)).toBe("12:00 AM");
    expect(clockText(2 * 3600 + 7 * 60)).toBe("1:47 AM");
    expect(clockText(22800)).toBe("6:00 AM");
  });

  it("says how long since the iceberg", () => {
    expect(sinceText(10)).toBe("Just hit the iceberg");
    expect(sinceText(25 * 60)).toBe("25 min after the iceberg");
    expect(sinceText(2 * 3600 + 7 * 60 + 30)).toBe(
      "2 h 07 min after the iceberg"
    );
    expect(durationWords(2 * 3600 + 40 * 60)).toBe("2 hours 40 minutes");
    expect(durationWords(3600)).toBe("1 hour");
    expect(durationWords(60)).toBe("1 minute");
  });

  it("captions events with the sim's real time", () => {
    expect(
      captionFor({ kind: "boat-lowered", t: 3900, realT: 3900, index: 0 })
    ).toBe("12:45 AM — The first lifeboat is lowered.");
    expect(
      captionFor({ kind: "boat-lowered", t: 4000, realT: 4000, index: 3 })
    ).toBeNull();
  });

  it("lays timeline icons in two rows and folds a third", () => {
    expect(markRows([0.1, 0.12, 0.13, 0.5], 0.05)).toEqual([0, 1, -1, 0]);
  });

  it("keeps the end of the story when the last icons crowd together", () => {
    // Lights out, breaks in two and sinks within a few minutes.
    const kinds = ["boat", "rocket", "lights", "break", "sinks"] as const;
    const rows = markRows(
      [0.4, 0.41, 0.9, 0.905, 0.91],
      0.05,
      kinds.map((k) => MARK_PRIORITY[k])
    );
    expect(rows[4]).not.toBe(-1); // sinks
    expect(rows[3]).not.toBe(-1); // break
    expect(rows[2]).toBe(-1); // lights folded
    expect(rows[0]).not.toBe(-1);
    expect(rows[1]).not.toBe(-1);
  });
});

describe("the story of a run", () => {
  let real: SimTrack;
  let floated: SimTrack;
  beforeAll(() => {
    real = simulate(titanic, titanic.realNight);
    floated = simulate(
      titanic,
      titanic.realNight.filter((o) =>
        ["fore-peak", "hold1", "hold2", "hold3"].includes(o.compartmentId)
      )
    );
  });

  it("ends the real night when she is on the floor, broken in two", () => {
    expect(outcomeOf(real)).toBe("broke-in-two");
    expect(storyEndT(real, true)).toBe(real.frames[real.frames.length - 1].t);
    expect(storyEndT(real, false)).toBeNull();
    const words = endWords(real, "Titanic", 3800, 6);
    const sank = real.events.find((e) => e.kind === "stern-under")!;
    // The sim's own time, not 2:20 AM.
    expect(words.title).toBe(`Titanic sank at ${clockText(sank.realT)}`);
    expect(words.lines[0]).toMatch(/broke in two and sank 2 hours/);
    expect(words.lines[0]).toMatch(/3,800 m \(2\.4 miles\)/);
  });

  it("ends a floating What if soon after she steadies", () => {
    expect(outcomeOf(floated)).toBe("floated");
    const steady = floated.events.find((e) => e.kind === "floating-steady")!;
    expect(storyEndT(floated, true)).toBeCloseTo(steady.t + 20, 5);
    expect(endWords(floated, "Titanic", 3800, 4).lines[0]).toMatch(
      /^With 4 holes, her bulkheads held/
    );
  });

  it("puts the night's events on the timeline in order", () => {
    const kinds = timelineMarks(real).map((m) => m.kind);
    expect(kinds).toEqual(["rocket", "boat", "break", "lights", "sinks"]);
    expect(timelineMarks(floated).map((m) => m.kind)).toContain("afloat");
  });
});
