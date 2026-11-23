import { britannic } from "../ships/britannic";
import { lusitania } from "../ships/lusitania";
import { titanic } from "../ships/titanic";
import { SIM_EVENT_KINDS } from "../sim/events";
import { simulate } from "../sim/run";
import type { SimTrack } from "../sim/track";
import {
  captionFor,
  captionText,
  clockText,
  durationWords,
  endWords,
  HISTORY_NOTE,
  historyNote,
  storyOf,
  MARK_PRIORITY,
  markRows,
  outcomeOf,
  runInCaption,
  sinceText,
  storyEndT,
  timelineMarks,
  showsNewEnding,
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
    const words = endWords(real, titanic, 6);
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
    expect(endWords(floated, titanic, 4).lines[0]).toMatch(
      /^With 4 holes, her bulkheads held/
    );
  });

  it("puts the night's events on the timeline in order", () => {
    const kinds = timelineMarks(real).map((m) => m.kind);
    expect(kinds).toEqual(["rocket", "boat", "break", "lights", "sinks"]);
    expect(timelineMarks(floated).map((m) => m.kind)).toContain("afloat");
  });
});

describe("the Lusitania's words", () => {
  /** Words for people in danger, deaths or numbers of them. */
  const UNKIND =
    /\b(die[ds]?|dying|dead|deaths?|kill\w*|drown\w*|scream\w*|people|passengers?|crew|children|victims?|bodies|lives|lost|trapped|panic\w*)\b/i;
  const contexts = [{}, { sternUnder: true }, { sunk: true }];

  it("has a caption or an explicit none for every event", () => {
    const none: string[] = [];
    for (const kind of SIM_EVENT_KINDS) {
      for (const ctx of contexts) {
        const text = captionText({ kind, index: 0 }, lusitania, ctx);
        if (text === null) none.push(kind);
        else expect(text.length).toBeGreaterThan(10);
      }
    }
    // She fired no rockets; her lights failed early, then went out; she
    // had no storm (no hatch covers to fail, no shelter to reach).
    expect([...new Set(none)].sort()).toEqual([
      "hatch-fails",
      "lights-flicker",
      "radio",
      "rocket",
      "sheltered",
    ]);
  });

  it("never words people in danger or deaths, for any liner", () => {
    for (const ship of [titanic, lusitania, britannic])
      for (const kind of SIM_EVENT_KINDS)
        for (const ctx of contexts)
          for (const index of [0, 1, undefined]) {
            const text = captionText({ kind, index }, ship, ctx) ?? "";
            expect(text).not.toMatch(UNKIND);
          }
  });

  it("counts her clock from the torpedo at 2:10 PM", () => {
    expect(clockText(0, lusitania.clockStartS)).toBe("2:10 PM");
    expect(clockText(18 * 60, lusitania.clockStartS)).toBe("2:28 PM");
    expect(sinceText(720, lusitania)).toBe("12 min after the torpedo");
    expect(sinceText(20, lusitania)).toBe("Just hit by the torpedo");
    // Her run-in before the hit (the pre-roll).
    expect(sinceText(-30, lusitania)).toBe("Just before the torpedo");
    expect(sinceText(-60, lusitania)).toBe("Just before the torpedo");
    expect(sinceText(-1, lusitania)).toBe("Just before the torpedo");
    expect(clockText(-30, lusitania.clockStartS)).toBe("2:09 PM");
    expect(runInCaption(lusitania)).toMatch(/torpedo/i);
    expect(runInCaption(titanic)).toBeNull();
    expect(
      captionFor({ kind: "collision", t: 0, realT: 0 }, lusitania)
    ).toMatch(/^2:10 PM — A torpedo hits the starboard side/);
  });

  it("says smoke and steam pour from her funnels (the Titanic's as 1.0)", () => {
    expect(captionText({ kind: "steam-start" }, lusitania)).toBe(
      "Steam and smoke pour out of the funnels."
    );
    expect(captionText({ kind: "steam-start" }, titanic)).toBe(
      "The engines stop. Steam roars out of the funnels."
    );
  });

  it("says her bow lands in shallow water while her stern is still up", () => {
    expect(captionText({ kind: "bow-lands" }, lusitania)).toBe(
      "The bow ploughs into the sea floor, only 93 m down. Her stern is still up out of the water!"
    );
    expect(
      captionText({ kind: "bow-lands" }, lusitania, { sternUnder: true })
    ).toBe("The bow ploughs into the sea floor, only 93 m down.");
    expect(
      captionText({ kind: "stern-lands" }, lusitania, { sunk: true })
    ).toBe("She has sunk. She lies on the sea floor, 93 m down.");
    // The Titanic's words are 1.0's.
    expect(captionText({ kind: "bow-lands" }, titanic)).toBe(
      "The bow ploughs into the sea floor, 3,800 m down."
    );
  });

  it("ends her real afternoon, and a What if that floats, kindly", () => {
    const real = simulate(lusitania, lusitania.realNight);
    const words = endWords(real, lusitania, 4);
    const sank = real.events.find((e) => e.kind === "stern-under")!;
    expect(words.title).toBe(
      `Lusitania sank at ${clockText(sank.realT, lusitania.clockStartS)}`
    );
    expect(words.title).toMatch(/2:2\d PM$/);
    expect(words.lines[0]).toMatch(/^She sank 1\d minutes after the torpedo/);
    expect(words.lines[0]).toMatch(/93\sm \(305\sfeet\) down/);
    expect(words.lines[1]).toMatch(/her bow hit the floor while her stern/);
    expect(historyNote(lusitania)).toMatch(/2:28\sPM, just 18 minutes/);
    expect(historyNote(titanic)).toBe(HISTORY_NOTE);

    const shut = simulate(lusitania, lusitania.realNight, {
      portholesOpen: false,
    });
    const afloat = endWords(shut, lusitania, 4, { portholesOpen: false });
    expect(afloat.outcome).toBe("floated");
    expect(afloat.lines[0]).toMatch(/^With her portholes shut/);
    for (const l of [...words.lines, ...afloat.lines, historyNote(lusitania)])
      expect(l).not.toMatch(/\b(die[ds]?|dead|deaths?|drown\w*)\b/i);
  });

  it("marks her timeline on her own clock, with no rockets", () => {
    const real = simulate(lusitania, lusitania.realNight);
    const marks = timelineMarks(real, lusitania);
    expect(marks.map((m) => m.kind)).not.toContain("rocket");
    expect(marks.every((m) => / PM$/.test(m.label))).toBe(true);
    expect(storyOf(lusitania).realLabel).toBe("The real afternoon");
    expect(storyOf(titanic).realLabel).toBe("The real night");
  });
});

describe("the new-ending badge (ruling R16)", () => {
  it("is never on the Fitzgerald's real run; her What-ifs and the liners keep it", () => {
    expect(showsNewEnding("fitzgerald", "real", true)).toBe(false);
    expect(showsNewEnding("fitzgerald", "whatif", true)).toBe(true);
    expect(showsNewEnding("titanic", "real", true)).toBe(true);
    expect(showsNewEnding("lusitania", "real", true)).toBe(true);
    expect(showsNewEnding("lusitania", "whatif", false)).toBe(false);
  });
});
