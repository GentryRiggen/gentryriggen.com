import { PARENT_LINES } from "@/components/shipwreck/parentLine";
import { helpFor, type HelpTopic } from "../help";
import { PLACES_BY_SHIP } from "../places";
import { carpathia } from "../ships/carpathia";
import { lusitania } from "../ships/lusitania";
import type { Opening } from "../ships/types";
import { SIM_EVENT_KINDS } from "../sim/events";
import {
  FINISHER_SPOT,
  simulate,
  whatIfOpenings,
  whatIfSpots,
} from "../sim/run";
import type { SimTrack } from "../sim/track";
import {
  captionContext,
  captionText,
  clockText,
  endWords,
  firstHitS,
  historyNote,
  runInCaption,
  sinceText,
  storyOf,
  timelineMarks,
} from "../story";
import { FINISHER_LABEL, spotAria, spotLabel } from "../whatIf";

/** Words for people in danger, deaths or numbers of them (the 1.0 list). */
const UNKIND =
  /\b(die[ds]?|dying|dead|deaths?|kill\w*|drown\w*|scream\w*|people|passengers?|crew|children|victims?|bodies|lives|lost|trapped|panic\w*)\b/i;
const contexts = [{}, { sternUnder: true }, { sunk: true }];

const real = carpathia.realNight as readonly Opening[];
const finisherOnly = whatIfOpenings(carpathia, [FINISHER_SPOT]) as Opening[];

describe("the Carpathia's captions", () => {
  it("has a caption or an explicit none for every event", () => {
    const none: string[] = [];
    for (const kind of SIM_EVENT_KINDS)
      for (const ctx of contexts) {
        const text = captionText({ kind, index: 0, t: 0 }, carpathia, {
          ...ctx,
          openings: real,
        });
        if (text === null) none.push(kind);
        else expect(text.length).toBeGreaterThan(10);
      }
    // The explosion is her torpedoes' own; her lights went out with the
    // engine room (no flicker back on); no storm, no wireless (R14); she
    // never rests aground (no `spec.aground`).
    expect([...new Set(none)].sort()).toEqual([
      "aground",
      "explosion",
      "hatch-fails",
      "lights-flicker",
      "radio",
      "sheltered",
    ]);
  });

  it("never words people in danger or deaths", () => {
    for (const kind of SIM_EVENT_KINDS)
      for (const ctx of contexts)
        for (const index of [0, 1, 2, 3, undefined])
          for (const openings of [real, finisherOnly, undefined])
            for (const t of [0, 8, 5700, undefined]) {
              const text =
                captionText({ kind, index, t }, carpathia, {
                  ...ctx,
                  openings,
                  hits: 3,
                }) ?? "";
              expect(text).not.toMatch(UNKIND);
            }
  });

  it("starts her clock at 9:15 AM and counts from the first torpedo", () => {
    expect(clockText(0, carpathia.clockStartS)).toBe("9:15 AM");
    expect(clockText(5700, carpathia.clockStartS)).toBe("10:50 AM");
    expect(sinceText(5700, carpathia, 3)).toBe(
      "1 h 35 min after the first torpedo"
    );
    expect(sinceText(20, carpathia, 3)).toBe("Just hit by a torpedo");
    expect(sinceText(12 * 60, carpathia, 1)).toBe("12 min after the torpedo");
    expect(storyOf(carpathia).realLabel).toBe("The real morning");
    expect(storyOf(carpathia).period).toBe("morning");
  });

  it("puts her torpedoes into her port side; the Lusitania's still starboard", () => {
    const ctx = { openings: real, hits: 3 };
    expect(captionText({ kind: "collision", t: 0 }, carpathia, ctx)).toBe(
      "A torpedo hits her port side, by her boiler room. Water rushes in."
    );
    expect(
      captionText({ kind: "torpedo-hit", index: 2, t: 8 }, carpathia, ctx)
    ).toBe("A second torpedo hits her port side, into her engine room.");
    expect(
      captionText({ kind: "torpedo-hit", index: 3, t: 5700 }, carpathia, ctx)
    ).toBe(
      "The U-boat comes back. Its last torpedo hits her port side, by hold 5."
    );
    expect(runInCaption(carpathia)).toMatch(/her port side/);
    // The Lusitania's words are 1.1's.
    expect(captionText({ kind: "collision" }, lusitania)).toMatch(
      /^A torpedo hits the starboard side/
    );
    expect(runInCaption(lusitania)).toMatch(/her starboard side\.$/);
    expect(captionText({ kind: "torpedo-hit", index: 2 }, lusitania)).toBe(
      null
    );
  });

  it("tells a player at ×1 what is happening in the long quiet middle", () => {
    const track = simulate(carpathia, real);
    const last = track.events.find((e) => e.kind === "last-boat")!;
    // Her boats are away by 9:55 AM; the U-boat comes back at 10:50 AM.
    expect(clockText(last.realT, carpathia.clockStartS)).toBe("9:55 AM");
    expect(
      captionText(last, carpathia, {
        ...captionContext(track, last.t, last),
        openings: real,
      })
    ).toMatch(/boats wait nearby while she settles slowly/);
    expect(
      captionText({ kind: "steam-stop", t: 600 }, carpathia, { openings: real })
    ).toMatch(/convoy steams away/);
    // The timeline marks the 10:50 AM torpedo, a jump over the wait.
    const marks = timelineMarks(track, carpathia);
    const torpedo = marks.find((m) => m.kind === "torpedo");
    expect(torpedo?.label).toBe("Torpedo, 10:50 AM");
    expect(marks.map((m) => m.kind)).toEqual(
      expect.arrayContaining(["rocket", "boat", "torpedo", "sinks"])
    );
    // Lights out at the hit; no caption lights her back up later.
    for (const e of track.events.filter((x) => x.kind === "lights-flicker"))
      expect(captionText(e, carpathia, { openings: real })).toBeNull();
  });

  it("copes with a run whose only torpedo is the U-boat's return (index 1)", () => {
    const track = simulate(carpathia, finisherOnly);
    const hits = track.events.filter((e) => e.kind === "torpedo-hit");
    // The only hit: index 1 (intended; ruling in Task 1).
    expect(hits.map((e) => [e.index, e.t])).toEqual([[1, 5700]]);
    expect(firstHitS(finisherOnly)).toBe(5700);
    const ctx = { openings: finisherOnly, hits: 1 };
    // No torpedo at 9:15 AM: a calm start, not a hit.
    const start = captionText({ kind: "collision", t: 0 }, carpathia, ctx)!;
    expect(start).not.toMatch(/torpedo/i);
    expect(start).toMatch(/summer morning/);
    // Her historical events before the hit go uncaptioned.
    for (const kind of [
      "rocket",
      "boat-lowered",
      "last-boat",
      "steam-start",
      "steam-stop",
    ] as const)
      expect(
        captionText({ kind, index: 0, t: 600 }, carpathia, ctx)
      ).toBeNull();
    expect(
      captionText(hits[0], carpathia, {
        ...captionContext(track, hits[0].t, hits[0]),
        ...ctx,
      })
    ).toBe("A torpedo hits her port side, by hold 5. Water rushes in.");
    // The clock's line counts down to it, then up from it.
    expect(sinceText(0, carpathia, 1, 5700)).toBe(
      "1 h 35 min before the torpedo"
    );
    expect(sinceText(5640, carpathia, 1, 5700)).toBe("Just before the torpedo");
    expect(sinceText(5700 + 10 * 60, carpathia, 1, 5700)).toBe(
      "10 min after the torpedo"
    );
    // Her end card counts from the hit, not from 9:15 AM.
    const w = endWords(track, carpathia, 1, { hits: 1, firstHitS: 5700 });
    for (const l of [w.title, ...w.lines]) expect(l).not.toMatch(UNKIND);
    if (w.outcome !== "floated")
      expect(w.lines[0]).not.toMatch(/1 hour (3|4|5)\d minutes/);
  });
});

describe("the Carpathia's end card", () => {
  let track: SimTrack;
  beforeAll(() => {
    track = simulate(carpathia, real);
  });

  it("reads her sinking time, from the first torpedo, and Snowdrop", () => {
    const w = endWords(track, carpathia, 4, { hits: 3 });
    const sank = track.events.find((e) => e.kind === "stern-under")!;
    expect(w.outcome).toBe("sank");
    expect(w.title).toBe(
      `Carpathia sank at ${clockText(sank.realT, carpathia.clockStartS)}`
    );
    expect(w.title).toMatch(/1[01]:\d\d AM$/);
    expect(w.lines[0]).toMatch(
      /^She sank 1 hour \d+ minutes after the first torpedo hit\. She lies 150\sm \(492\sfeet\) down\.$/
    );
    expect(historyNote(carpathia)).toMatch(/11:00\sAM/);
    expect(historyNote(carpathia)).toMatch(
      /HMS Snowdrop came and picked up her lifeboats/
    );
    for (const l of [w.title, ...w.lines, historyNote(carpathia)])
      expect(l).not.toMatch(UNKIND);
  });

  it("words a What if that floats or breaks in two kindly", () => {
    const floated = simulate(carpathia, whatIfOpenings(carpathia, ["hold1"]));
    const f = endWords(floated, carpathia, 1, { hits: 1 });
    expect(f.outcome).toBe("floated");
    expect(f.lines[1]).toMatch(/U-boat came back at 10:50\sAM/);
    // Without the third torpedo she breaks as her bow strikes the floor.
    const noFin = simulate(
      carpathia,
      whatIfOpenings(carpathia, ["boiler", "engine"])
    );
    const b = endWords(noFin, carpathia, 4, { hits: 2 });
    expect(b.outcome).toBe("broke-in-two");
    expect(b.lines[0]).toMatch(/^She broke in two and sank 2 hours/);
    expect(captionText({ kind: "breakup" }, carpathia)).toBe(
      "The ship breaks in two."
    );
    for (const l of [...f.lines, ...b.lines]) expect(l).not.toMatch(UNKIND);
  });
});

describe("the Carpathia's What if words, help and places", () => {
  it("names the U-boat's return as its own choice", () => {
    expect(spotLabel(carpathia, FINISHER_SPOT)).toBe(FINISHER_LABEL);
    expect(FINISHER_LABEL).toBe("The U-boat comes back");
    expect(spotAria(carpathia, FINISHER_SPOT, true)).toBe(
      "The U-boat comes back: a last torpedo at 10:50 AM"
    );
    expect(spotAria(carpathia, FINISHER_SPOT, false)).toBe(
      "The U-boat comes back: no last torpedo"
    );
    expect(spotAria(carpathia, "engine", true)).toBe(
      "Engine room: a torpedo hits her port side here"
    );
    // The Lusitania's are 1.1's.
    expect(spotAria(lusitania, "br1", true)).toBe(
      "Boiler room 1: a torpedo hits here"
    );
    for (const id of whatIfSpots(carpathia))
      for (const on of [true, false])
        expect(spotAria(carpathia, id, on)).not.toMatch(UNKIND);
  });

  it("explains her HUD on tap, for her morning and her port list", () => {
    const controls = helpFor("controls", null, carpathia).lines.join(" ");
    expect(controls).toMatch(/how fast the morning goes/);
    expect(controls).toMatch(/10:50 AM, when the U-boat came back/);
    expect(controls).toMatch(
      /the Bridge, the Boiler Room, the Engine Room, Hold 5, the Dining Saloon and the Wireless Room/
    );
    expect(helpFor("lean", null, carpathia).lines.join(" ")).toMatch(
      /port side, so she leaned a little to port/
    );
    expect(helpFor("bow", null, carpathia).lines.join(" ")).toMatch(/150 m/);
    // The Lusitania's cards are 1.1's.
    expect(helpFor("lean", null, lusitania).lines.join(" ")).toMatch(
      /starboard side, she leaned over a long way/
    );
    const topics: HelpTopic[] = ["controls", "water", "bow", "lean", "power"];
    for (const t of topics) {
      const h = helpFor(t, null, carpathia);
      for (const l of [h.title, ...h.lines]) expect(l).not.toMatch(UNKIND);
    }
  });

  it("nods to the Titanic in the wireless room, and words her places kindly", () => {
    const wireless = PLACES_BY_SHIP.carpathia.find(
      (p) => p.id === "wireless-room"
    );
    expect(wireless?.fact).toBe(
      "In 1912 her wireless operator heard the Titanic's call for help here."
    );
    for (const p of PLACES_BY_SHIP.carpathia)
      expect(`${p.label}. ${p.fact}`).not.toMatch(UNKIND);
  });

  it("tells the grown-ups in the spec's exact words", () => {
    expect(PARENT_LINES.carpathia).toBe(
      "This is the Carpathia, the ship that rescued the Titanic's survivors in 1912. During the First World War, on 17 July 1918, a U-boat's torpedoes sank her off Ireland, and five of her crew died. This game shows only the ship."
    );
  });
});
