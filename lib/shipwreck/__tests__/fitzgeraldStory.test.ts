import { PARENT_LINES } from "@/components/shipwreck/parentLine";
import { PLACES_BY_SHIP, placeFor } from "../places";
import { spotAria } from "../whatIf";
import { helpFor, type HelpTopic } from "../help";
import { fitzgerald } from "../ships/fitzgerald";
import { lusitania } from "../ships/lusitania";
import { titanic } from "../ships/titanic";
import { SIM_EVENT_KINDS } from "../sim/events";
import { simulate, whatIfOpenings, whatIfSpots } from "../sim/run";
import type { SimTrack } from "../sim/track";
import {
  captionContext,
  captionFor,
  captionText,
  clockText,
  endWords,
  historyNote,
  runInCaption,
  sinceText,
  storyEndT,
  storyOf,
  timelineMarks,
} from "../story";

/** Words for people in danger, deaths or numbers of them (the 1.0 list). */
const UNKIND =
  /\b(die[ds]?|dying|dead|deaths?|kill\w*|drown\w*|scream\w*|people|passengers?|crew|children|victims?|bodies|lives|lost|trapped|panic\w*)\b/i;
/** The famous song's words: never used (spec, north-star 5). */
const LYRICS = [
  "the lake, it is said",
  "gales of november",
  "witch of november",
  "never gives up her dead",
  "big lake they called gitche gumee",
];
/** No blame: nobody's fault, no "should have". */
const BLAME =
  /\b(fault|blame\w*|careless\w*|mistake\w*|should have|clamps?|clamped|not done up|maintenance)\b/i;
const contexts = [
  {},
  { sternUnder: true },
  { sunk: true },
  { first: false },
  { hits: 2 },
];

function kindWords(text: string) {
  expect(text).not.toMatch(UNKIND);
  expect(text).not.toMatch(BLAME);
  for (const l of LYRICS) expect(text.toLowerCase()).not.toContain(l);
}

describe("the Fitzgerald's words", () => {
  let real: SimTrack;
  let sheltered: SimTrack;
  beforeAll(() => {
    real = simulate(fitzgerald, fitzgerald.realNight);
    // No damage and a calmer storm: she reaches Whitefish Bay.
    sheltered = simulate(fitzgerald, whatIfOpenings(fitzgerald, []), {
      storm: "calmer",
    });
  });

  it("has a caption or an explicit none for every event", () => {
    const none = new Set<string>();
    for (const kind of SIM_EVENT_KINDS)
      for (const index of [0, 1, 7, undefined]) {
        const text = captionText({ kind, index }, fitzgerald);
        if (text === null)
          none.add(`${kind}${index === undefined ? "" : index}`);
        else expect(text.length).toBeGreaterThan(10);
      }
    // Kinds she never has (no rockets, boats lowered, explosions, steam,
    // a funnel that falls, a steady float in a storm), and the ones her
    // story words once (the lights fail with her dive; the bow under says
    // the forecastle; her two radio messages only).
    const kinds = new Set([...none].map((k) => k.replace(/\d+$/, "")));
    for (const k of [
      "explosion",
      "steam-start",
      "steam-stop",
      "rocket",
      "boat-lowered",
      "last-boat",
      "funnel-falls",
      "floating-steady",
      "lights-flicker",
      "forecastle-under",
      "bridge-under",
    ])
      expect(kinds).toContain(k);
    for (const k of [
      "collision",
      "radio",
      "hatch-fails",
      "sheltered",
      "bow-under",
      "breakup",
      "stern-under",
      "bow-lands",
      "stern-lands",
      "lights-out",
    ])
      expect(captionText({ kind: k as never, index: 0 }, fitzgerald)).not.toBe(
        null
      );
    // Only her two messages have words.
    expect(captionText({ kind: "radio", index: 7 }, fitzgerald)).toBeNull();
  });

  it("her What if labels and place facts never assign fault", () => {
    for (const id of whatIfSpots(fitzgerald))
      for (const on of [true, false]) kindWords(spotAria(fitzgerald, id, on));
    expect(spotAria(fitzgerald, "hatch-1", true)).toContain("leaking");
    for (const p of PLACES_BY_SHIP.fitzgerald)
      kindWords(`${p.label}. ${p.fact}`);
    const tank = placeFor("fitzgerald", "ballast-tank")?.fact ?? "";
    // Topside damage alone gives no list (R14): the tank's fact leaves it open.
    expect(tank).not.toMatch(/by her broken vents, water got in/);
    expect(tank).toMatch(/argue/);
  });

  it("never words people, deaths, blame or the song, for any ship", () => {
    for (const ship of [titanic, lusitania, fitzgerald])
      for (const kind of SIM_EVENT_KINDS)
        for (const ctx of contexts)
          for (const index of [0, 1, undefined])
            kindWords(captionText({ kind, index }, ship, ctx) ?? "");
    for (const track of [real, sheltered]) {
      const w = endWords(track, fitzgerald, 0, {});
      for (const l of [w.title, ...w.lines]) kindWords(l);
    }
    kindWords(historyNote(fitzgerald));
    const topics: HelpTopic[] = ["controls", "water", "bow", "lean", "power"];
    for (const t of topics) {
      const h = helpFor(t, real.frames[100], fitzgerald);
      for (const l of [h.title, ...h.lines]) kindWords(l);
    }
    // The parent line is for the grown-ups: it says so plainly.
    expect(PARENT_LINES.fitzgerald).toBe(
      "This is the Edmund Fitzgerald, an ore carrier on Lake Superior. She sank in a storm on 10 November 1975, and all 29 of her crew died. This game shows only the ship."
    );
  });

  it("counts her clock from her first report at 3:30 PM", () => {
    expect(clockText(0, fitzgerald.clockStartS)).toBe("3:30 PM");
    expect(clockText(2 * 3600, fitzgerald.clockStartS)).toBe("5:30 PM");
    expect(sinceText(20, fitzgerald)).toBe("Her first report");
    expect(sinceText(12 * 60, fitzgerald)).toBe("12 min into the storm");
    expect(sinceText(2 * 3600 + 10 * 60 + 30, fitzgerald)).toBe(
      "2 h 10 min into the storm"
    );
    expect(storyOf(fitzgerald).realLabel).toBe("The real storm");
    expect(storyOf(fitzgerald).period).toBe("storm");
    expect(runInCaption(fitzgerald)).toBeNull();
  });

  it("captions her report, her radars and her last message", () => {
    expect(captionFor({ kind: "collision", t: 0, realT: 0 }, fitzgerald)).toBe(
      "3:30 PM — Her captain radios the Arthur M. Anderson, the ship behind her: a railing is down, two vents are broken, and she is leaning. The storm is building."
    );
    const radio = real.events.filter((e) => e.kind === "radio");
    expect(
      radio.map((e) => clockText(e.realT, fitzgerald.clockStartS))
    ).toEqual(["4:10 PM", "7:10 PM"]);
    expect(captionFor(radio[0], fitzgerald)).toBe(
      "4:10 PM — Both of her radars stop working. The Anderson keeps watch and helps her find the way."
    );
    expect(captionText(radio[1], fitzgerald)).toBe(
      "Her captain radios the Anderson: “We are holding our own.”"
    );
    expect(captionFor(radio[1], fitzgerald)).toBe(
      "7:10 PM — Her captain radios the Anderson: “We are holding our own.”"
    );
  });

  it("words the first hatch cover giving way, not each one", () => {
    const fails = real.events.filter((e) => e.kind === "hatch-fails");
    expect(fails.length).toBeGreaterThan(1);
    const first = captionText(
      fails[0],
      fitzgerald,
      captionContext(real, fails[0].t, fails[0])
    );
    expect(first).toMatch(/hatch cover/);
    for (const e of fails.slice(1))
      expect(
        captionText(e, fitzgerald, captionContext(real, e.t, e))
      ).toBeNull();
  });

  it("ends her real run kindly, and a What if that makes it to shelter", () => {
    const sank = endWords(real, fitzgerald, 0);
    expect(sank.outcome).toBe("broke-in-two");
    expect(sank.title).toMatch(/^Edmund Fitzgerald sank at 7:1\d PM$/);
    expect(sank.lines[0]).toMatch(
      /^She broke in two and sank 3 hours 4\d minutes after her 3:30\sPM report\. She lies 162\sm \(531\sfeet\) down\.$/
    );
    expect(sank.lines[1]).toMatch(/bottom while her stern/);
    expect(historyNote(fitzgerald)).toMatch(/17 miles/);
    expect(historyNote(fitzgerald)).toMatch(/very nearly made it/);
    expect(historyNote(fitzgerald)).toMatch(/still argue/);

    expect(sheltered.outcome).toBe("floated");
    const home = endWords(sheltered, fitzgerald, 0, { storm: "calmer" });
    expect(home.outcome).toBe("floated");
    expect(home.title).toBe("She made it to Whitefish Bay.");
    expect(home.lines.join(" ")).toMatch(/8:25\sPM/);
    expect(storyEndT(sheltered, true)).toBe(
      sheltered.frames[sheltered.frames.length - 1].t
    );
  });

  it("marks her timeline on her own clock: the first cover, the end", () => {
    const marks = timelineMarks(real, fitzgerald);
    const kinds = marks.map((m) => m.kind);
    expect(kinds).toContain("hatch");
    expect(kinds).toContain("sinks");
    expect(kinds).not.toContain("rocket");
    expect(marks.every((m) => / PM$/.test(m.label))).toBe(true);
    expect(timelineMarks(sheltered, fitzgerald).map((m) => m.kind)).toContain(
      "shelter"
    );
  });
});

describe("more than one torpedo (the Lusitania, 1.3)", () => {
  it("one hit still reads 'the torpedo'; more say how many", () => {
    expect(captionText({ kind: "collision" }, lusitania, { hits: 1 })).toMatch(
      /^A torpedo hits the starboard side/
    );
    expect(captionText({ kind: "collision" }, lusitania, { hits: 2 })).toBe(
      "Two torpedoes hit the starboard side. Water rushes in."
    );
    expect(captionText({ kind: "collision" }, lusitania, { hits: 3 })).toBe(
      "Three torpedoes hit the starboard side. Water rushes in."
    );
    expect(sinceText(-5, lusitania, 1)).toBe("Just before the torpedo");
    expect(sinceText(-5, lusitania, 2)).toBe("Just before the torpedoes");
    expect(sinceText(20, lusitania, 3)).toBe("Just hit by the torpedoes");
    expect(sinceText(12 * 60, lusitania, 2)).toBe("12 min after the torpedoes");
    expect(runInCaption(lusitania)).toMatch(/^A torpedo is coming!/);
    expect(runInCaption(lusitania, 1)).toMatch(/^A torpedo is coming!/);
    expect(runInCaption(lusitania, 2)).toBe(
      "Two torpedoes are coming! Their white trails of bubbles streak toward her starboard side."
    );
  });

  it("ends a run with more than one hit in the plural", () => {
    const track = simulate(
      lusitania,
      whatIfOpenings(lusitania, ["br1", "br3"])
    );
    const words = endWords(track, lusitania, 6, { hits: 2 });
    if (words.outcome === "floated")
      expect(words.lines[0]).toMatch(/torpedoes opened/);
    else expect(words.lines[0]).toMatch(/after the torpedoes hit/);
    expect(endWords(track, lusitania, 6, { hits: 1 }).lines[0]).not.toMatch(
      /torpedoes/
    );
  });
});
