import { PARENT_LINES } from "@/components/shipwreck/parentLine";
import { helpFor, type HelpTopic } from "../help";
import {
  CONCORDIA_PLACE_IDS,
  CONCORDIA_PLACES,
  PLACES_BY_SHIP,
} from "../places";
import { concordia } from "../ships/concordia";
import { SIM_EVENT_KINDS } from "../sim/events";
import { simulate, whatIfOpenings, whatIfSpots } from "../sim/run";
import type { SimTrack } from "../sim/track";
// Her to-sea run takes ~8 s: its saved summary (concordiaToSeaFixture).
import toSea from "../sim/__tests__/fixtures/concordiaToSea.json";
import {
  captionContext,
  captionFor,
  captionText,
  clockText,
  endWords,
  firstHitS,
  historyNote,
  outcomeOf,
  runInCaption,
  sinceText,
  storyOf,
  timelineMarks,
} from "../story";
import { TO_SEA_TOGGLE, spotAria, spotLabel } from "../whatIf";

/** Words for people in danger, deaths or numbers of them (the 1.0 list). */
const UNKIND =
  /\b(die[ds]?|dying|dead|deaths?|kill\w*|drown\w*|scream\w*|people|passengers?|crew|children|victims?|bodies|lives|lost|trapped|panic\w*)\b/i;
/** Never in her words: who steered her, the "salute", blame. */
const NEVER =
  /\b(captain|salute|inchino|fault|blame\w*|careless\w*|mistake\w*|should have|against orders|schettino)\b/i;
const contexts = [
  {},
  { sternUnder: true },
  { sunk: true },
  { first: false },
  { aground: true, restListDeg: 65 },
  { aground: true, restListDeg: 17 },
];

function kindWords(text: string) {
  expect(text).not.toMatch(UNKIND);
  expect(text).not.toMatch(NEVER);
}

describe("the Costa Concordia's words", () => {
  let real: SimTrack;
  let sea: SimTrack;
  let none: SimTrack;
  let few: SimTrack;
  beforeAll(() => {
    real = simulate(concordia, concordia.realNight);
    sea = toSea.night as SimTrack;
    none = simulate(concordia, whatIfOpenings(concordia, []));
    few = simulate(
      concordia,
      whatIfOpenings(concordia, ["wtc4", "wtc5", "wtc6", "wtc7"])
    );
  }, 30_000);

  it("has a caption or an explicit none for every event", () => {
    const none = new Set<string>();
    for (const kind of SIM_EVENT_KINDS)
      for (const ctx of contexts)
        for (const index of [0, 1, undefined]) {
          const text = captionText({ kind, index }, concordia, ctx);
          if (text === null) none.add(kind);
          else expect(text.length).toBeGreaterThan(10);
        }
    for (const k of [
      "explosion",
      "steam-start",
      "steam-stop",
      "rocket",
      "hatch-fails",
      "lights-flicker",
      "funnel-falls",
      "breakup",
      "sheltered",
      "radio",
      "torpedo-hit",
    ])
      expect(none).toContain(k);
    for (const k of [
      "collision",
      "lights-out",
      "boat-lowered",
      "last-boat",
      "aground",
      "floating-steady",
      "stern-under",
    ])
      expect(
        captionText({ kind: k as never, index: 0 }, concordia, { first: true })
      ).not.toBeNull();
  });

  it("never words deaths, people in danger, her captain, the salute or blame", () => {
    for (const kind of SIM_EVENT_KINDS)
      for (const ctx of contexts)
        for (const index of [0, 1, undefined])
          kindWords(captionText({ kind, index }, concordia, ctx) ?? "");
    for (const t of [real, sea, none, few])
      for (const e of t.events)
        kindWords(captionFor(e, concordia, captionContext(t, e.t, e)) ?? "");
    kindWords(runInCaption(concordia) ?? "");
    for (const id of whatIfSpots(concordia))
      for (const on of [true, false]) kindWords(spotAria(concordia, id, on));
    for (const p of PLACES_BY_SHIP.concordia)
      kindWords(`${p.label}. ${p.fact}`);
    for (const on of [true, false])
      kindWords(
        `${TO_SEA_TOGGLE.label(on)}. ${TO_SEA_TOGGLE.aria(on)}. ${TO_SEA_TOGGLE.help}`
      );
    for (const [t, holes, ctx] of [
      [real, 5, {}],
      [sea, 5, { toSea: true }],
      [none, 0, {}],
      [few, 4, {}],
    ] as const) {
      const w = endWords(t, concordia, holes, ctx);
      for (const l of [...w.lines, w.title]) kindWords(l);
    }
    for (const topic of [
      "controls",
      "water",
      "bow",
      "lean",
      "power",
    ] as HelpTopic[])
      for (const l of helpFor(topic, null, concordia).lines) kindWords(l);
    kindWords(historyNote(concordia));
  });

  it("counts her clock from the rocks at 9:45 PM", () => {
    expect(clockText(0, concordia.clockStartS)).toBe("9:45 PM");
    expect(sinceText(720, concordia)).toBe("12 min after the rocks");
    expect(sinceText(20, concordia)).toBe("Just hit the rocks");
    expect(storyOf(concordia).realLabel).toBe("The real night");
    expect(runInCaption(concordia)).toBe(
      "She sails close to the island, all lit up."
    );
    expect(captionFor({ kind: "collision", t: 0, realT: 0 }, concordia)).toBe(
      "9:45 PM — She scrapes rocks! A long tear opens in her left side."
    );
  });

  it("words the blackout, emergency lights, the boats, the touch and her rest", () => {
    const text = (kind: string, ctx = {}) =>
      captionText({ kind: kind as never, index: 0 }, concordia, ctx) ?? "";
    expect(text("lights-out")).toMatch(/lights go out/);
    expect(text("lights-out")).toMatch(/engines and rudder stop/);
    expect(text("lights-out")).toMatch(/emergency lights/);
    expect(text("lights-out")).toMatch(/back toward the island/);
    expect(text("boat-lowered", { first: true })).toMatch(/first lifeboat/);
    expect(text("aground")).toMatch(/touches the rocks/);
    expect(text("floating-steady", { aground: true, restListDeg: 65 })).toBe(
      "She lies on her side on the rocks, half out of the water, right by the harbour."
    );
    expect(text("floating-steady", { aground: true, restListDeg: 17 })).toMatch(
      /rests on the rocks, leaning/
    );
    expect(text("floating-steady")).toMatch(/staying afloat/);
  });

  it("shows real time after she touches the rocks, and the rest at 12:41 AM", () => {
    const rest = real.events.find((e) => e.kind === "floating-steady")!;
    const touch = real.events.find((e) => e.kind === "aground")!;
    expect(clockText(touch.realT, concordia.clockStartS)).toBe("10:39 PM");
    expect(clockText(rest.realT, concordia.clockStartS)).toBe("12:41 AM");
    expect(
      captionFor(rest, concordia, captionContext(real, rest.t, rest))
    ).toMatch(/^12:41 AM — She lies on her side on the rocks/);
    // Her marks: the touch and the first boat get icons.
    const marks = timelineMarks(real, concordia).map((m) => m.kind);
    expect(marks).toContain("aground");
    expect(marks).toContain("boat");
  });

  it("ends her real night on her side by the harbour, with the time from the run", () => {
    expect(outcomeOf(real)).toBe("aground");
    const w = endWords(real, concordia, 5);
    expect(w.outcome).toBe("aground");
    expect(w.lines[0]).toBe(
      "She came to rest on her side by Giglio's harbour at 12:41 AM, 2 hours 56 minutes after the rocks."
    );
    expect(historyNote(concordia)).toMatch(/^What really happened:/);
  });

  it("words the What ifs honestly", () => {
    expect(outcomeOf(none)).toBe("floated");
    expect(endWords(none, concordia, 0).title).toBe(
      "She sailed safely past the island."
    );
    // Four rooms: she runs aground leaning only a little.
    expect(outcomeOf(few)).toBe("aground");
    const f = endWords(few, concordia, 4);
    expect(f.lines[0]).toMatch(/^She came to rest on the rocks by Giglio's/);
    expect(f.lines[0]).toMatch(/leaning \d+°/);
    expect(f.lines[0]).not.toMatch(/on her side/);
    // Blown out to sea, she sinks by the stern: never "rolled over".
    expect(outcomeOf(sea)).toBe("sank");
    const s = endWords(sea, concordia, 5, { toSea: true });
    expect(s.title).toBe("Blown out to sea, she sank.");
    expect(s.lines.join(" ")).toMatch(/by the stern/);
    expect(s.lines.join(" ")).not.toMatch(/rolled|capsiz/);
  });

  it("has deliberate words for every rocks outcome", () => {
    // Sank, with or without the wind toggle: never the generic iceberg text.
    const plain = endWords(sea, concordia, 5);
    expect(plain.title).toBe("She sank.");
    expect(plain.lines[0]).toMatch(
      /by the stern at 1:36 AM, 3 hours 51 minutes after the rocks/
    );
    expect(plain.lines.join(" ")).not.toMatch(/lies|iceberg|down\./);
    const wind = endWords(sea, concordia, 5, { toSea: true });
    expect(wind.title).toBe("Blown out to sea, she sank.");
    // Stayed afloat after some holes: no ground, no sinking.
    const afloat = { ...few, outcome: "floated" as const };
    expect(endWords(afloat, concordia, 2).title).toBe("She stayed afloat.");
    // Aground and no strike are covered above; none is "never null".
    for (const t of [real, sea, none, few])
      expect(endWords(t, concordia, 1).lines.length).toBeGreaterThan(0);
  });

  it("counts her clock from the strike even though her first hole opens at 0.75 s", () => {
    expect(firstHitS(concordia.realNight)).toBe(0);
    expect(firstHitS([{ t: 5700 }])).toBe(5700);
  });

  it("has her parent line (the spec's exact copy)", () => {
    expect(PARENT_LINES.concordia).toBe(
      "This is the Costa Concordia, a cruise ship, in January 2012. At night she sailed too close to the island of Giglio, struck rocks and rolled onto her side beside the harbour. Most of the 4,229 people aboard were rescued, but 32 people died. This game shows only the ship. You can walk her top decks and go inside some of her rooms."
    );
  });

  it("has her places inside her hull or superstructure, in her compartments", () => {
    expect(PLACES_BY_SHIP.concordia.map((p) => p.id)).toEqual([
      ...CONCORDIA_PLACE_IDS,
    ]);
    const x0 = concordia.stations[0].x;
    const x1 = concordia.stations[concordia.stations.length - 1].x;
    for (const p of PLACES_BY_SHIP.concordia) {
      const [x, y, z] = p.at;
      expect(x).toBeGreaterThan(x0);
      expect(x).toBeLessThan(x1);
      expect(Math.abs(y)).toBeLessThan(concordia.beam / 2);
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(concordia.funnels[0].topZ);
      expect(p.floorZ).toBeLessThanOrEqual(z);
      if (p.compartmentId !== null) {
        const c = concordia.compartments.find((k) => k.id === p.compartmentId)!;
        expect(c).toBeDefined();
        expect(x).toBeGreaterThanOrEqual(c.fromX);
        expect(x).toBeLessThan(c.toX);
      }
    }
    const at = (id: (typeof CONCORDIA_PLACE_IDS)[number]) =>
      CONCORDIA_PLACES[id];
    expect(at("motor-room").compartmentId).toBe("wtc5");
    expect(at("generator-room").compartmentId).toBe("wtc6");
    // The rock is in her port side, the bridge and pool high up.
    expect(at("the-rock").at[1]).toBeGreaterThan(0);
    expect(at("bridge").at[2]).toBeGreaterThan(30);
    expect(at("pool").at[2]).toBeGreaterThan(40);
    expect(at("funnel").at[0]).toBe(concordia.funnels[0].x);
  });

  it("words the rock's tear for each spot", () => {
    expect(spotLabel(concordia, "wtc5")).toBe("Electric motor room");
    expect(spotAria(concordia, "wtc6", true)).toBe(
      "Back generator room: the rock tears it open"
    );
    expect(spotAria(concordia, "wtc6", false)).toBe(
      "Back generator room: not torn"
    );
  });
});
