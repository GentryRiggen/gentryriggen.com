import { PARENT_LINES } from "@/components/shipwreck/parentLine";
import { helpFor, type HelpTopic } from "../help";
import { PLACES_BY_SHIP, placeFor } from "../places";
import { britannic, BRITANNIC_GANTRY_SETS } from "../ships/britannic";
import { lusitania } from "../ships/lusitania";
import { SIM_EVENT_KINDS } from "../sim/events";
import { buildHull, hullHalfBreadth } from "../sim/geometry";
import {
  simulate,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../sim/run";
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
  storyOf,
  timelineMarks,
} from "../story";
import { MINE_TOGGLES, spotAria, spotLabel } from "../whatIf";
import { spanRange } from "../xray";

/** Words for people in danger, deaths or numbers of them (the 1.0 list). */
const UNKIND =
  /\b(die[ds]?|dying|dead|deaths?|kill\w*|drown\w*|scream\w*|people|passengers?|crew|children|victims?|bodies|lives|lost|trapped|panic\w*)\b/i;
/** Never in play: the propeller incident (R15), and no blame. */
const NEVER =
  /\b(propellers?|screws?|blades?|drawn|sucked|nurses?|fault|blame\w*|careless\w*|mistake\w*|should have|against orders)\b/i;
const contexts = [
  {},
  { sternUnder: true },
  { sunk: true },
  { first: false },
  { hits: 2 },
];

function kindWords(text: string) {
  expect(text).not.toMatch(UNKIND);
  expect(text).not.toMatch(NEVER);
}

/** Seconds after 8:12 AM for a clock time h:mm AM. */
const at = (h: number, m: number) => (h - 8) * 3600 + (m - 12) * 60;

describe("the Britannic's words", () => {
  let real: SimTrack;
  let fixed: SimTrack;
  beforeAll(() => {
    real = simulate(britannic, britannic.realNight);
    // Her real mine, and every fix on: she floats.
    fixed = simulate(britannic, whatIfOpenings(britannic, ["hold3"]), {
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    });
  });

  it("has a caption or an explicit none for every event", () => {
    const none = new Set<string>();
    for (const kind of SIM_EVENT_KINDS)
      for (const ctx of contexts)
        for (const index of [0, 1, undefined]) {
          const text = captionText({ kind, index }, britannic, ctx);
          if (text === null) none.add(kind);
          else expect(text.length).toBeGreaterThan(10);
        }
    // Kinds she never has, or whose news another caption already gives:
    // the mine is her collision; her lights flicker just before they go out;
    // her front deck and bridge going under say the bow.
    for (const k of [
      "explosion",
      "steam-start",
      "steam-stop",
      "rocket",
      "hatch-fails",
      "lights-flicker",
      "bow-under",
    ])
      expect(none).toContain(k);
    for (const k of [
      "collision",
      "boat-lowered",
      "last-boat",
      "forecastle-under",
      "bridge-under",
      "funnel-falls",
      "lights-out",
      "breakup",
      "stern-under",
      "bow-lands",
      "stern-lands",
      "floating-steady",
      "sheltered",
      "radio",
    ])
      expect(
        captionText({ kind: k as never, index: 0 }, britannic, { first: true })
      ).not.toBeNull();
  });

  it("never words deaths, people in danger, blame or the propellers", () => {
    for (const kind of SIM_EVENT_KINDS)
      for (const ctx of contexts)
        for (const index of [0, 1, undefined])
          kindWords(captionText({ kind, index }, britannic, ctx) ?? "");
    for (const e of real.events)
      kindWords(captionFor(e, britannic, captionContext(real, e.t, e)) ?? "");
    for (const id of whatIfSpots(britannic))
      for (const on of [true, false]) kindWords(spotAria(britannic, id, on));
    for (const p of PLACES_BY_SHIP.britannic)
      kindWords(`${p.label}. ${p.fact}`);
    for (const t of MINE_TOGGLES)
      for (const on of [true, false])
        kindWords(`${t.label(on)}. ${t.aria(on)}. ${t.help}`);
    const words = endWords(real, britannic, 6);
    for (const l of [...words.lines, words.title]) kindWords(l);
    for (const l of endWords(fixed, britannic, 1, {
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    }).lines)
      kindWords(l);
    for (const topic of [
      "controls",
      "water",
      "bow",
      "lean",
      "power",
    ] as HelpTopic[])
      for (const l of helpFor(topic, null, britannic).lines) kindWords(l);
  });

  it("counts her clock from the mine at 8:12 AM", () => {
    expect(clockText(0, britannic.clockStartS)).toBe("8:12 AM");
    expect(clockText(at(9, 7), britannic.clockStartS)).toBe("9:07 AM");
    expect(sinceText(720, britannic)).toBe("12 min after the mine");
    expect(sinceText(20, britannic)).toBe("Just hit by the mine");
    expect(sinceText(720, britannic, 2)).toBe("12 min after the mines");
    expect(storyOf(britannic).period).toBe("morning");
    expect(storyOf(britannic).realLabel).toBe("The real morning");
    // No run-in: a mine is not seen coming.
    expect(runInCaption(britannic)).toBeNull();
    expect(
      captionFor({ kind: "collision", t: 0, realT: 0 }, britannic)
    ).toMatch(/^8:12 AM — A mine explodes against her starboard side/);
  });

  it("sounds two long blasts on her whistle at 9:00, and nothing of her propellers", () => {
    const whistle = real.events.filter((e) => e.kind === "radio");
    expect(whistle).toHaveLength(1);
    expect(clockText(whistle[0].realT, britannic.clockStartS)).toBe("9:00 AM");
    expect(captionFor(whistle[0], britannic)).toBe(
      "9:00 AM — Her engines stop. Two long blasts on her whistle."
    );
    // The same kind words nothing for the Lusitania (she has none).
    expect(captionText({ kind: "radio", index: 0 }, lusitania)).toBeNull();
    // Every caption of her real morning: none of the propeller incident.
    const all = real.events
      .map((e) => captionFor(e, britannic, captionContext(real, e.t, e)))
      .filter((c): c is string => c !== null);
    expect(all.some((c) => /whistle/.test(c))).toBe(true);
    for (const c of all) expect(c).not.toMatch(/propeller|screw/i);
  });

  it("captions only the first boat lowered and the first funnel to fall", () => {
    const boats = real.events.filter((e) => e.kind === "boat-lowered");
    expect(boats.length).toBe(35);
    const worded = boats.filter(
      (e) => captionText(e, britannic, captionContext(real, e.t, e)) !== null
    );
    expect(worded).toEqual([boats[0]]);
    const funnels = real.events.filter((e) => e.kind === "funnel-falls");
    expect(
      funnels.filter(
        (e) => captionText(e, britannic, captionContext(real, e.t, e)) !== null
      )
    ).toEqual([funnels[0]]);
  });

  it("ends her real morning as the sim ran it, with the real time beside it", () => {
    const words = endWords(real, britannic, 6);
    const sank = real.events.find((e) => e.kind === "stern-under")!;
    expect(words.outcome).toBe("sank");
    expect(words.title).toBe(
      `HMHS Britannic sank at ${clockText(sank.realT, britannic.clockStartS)}`
    );
    expect(words.lines[0]).toMatch(/^She sank 5\d minutes after the mine\./);
    expect(words.lines[0]).toMatch(/120\sm \(394\sfeet\) down/);
    expect(words.lines[1]).toMatch(/her bow hit the floor while her stern/);
    expect(historyNote(britannic)).toMatch(
      /She sank at 9:07\sAM, 55 minutes after the mine\./
    );
    expect(historyNote(britannic)).toMatch(/^What really happened:/);
  });

  it("ends a What if that floats, and one that reaches Kea", () => {
    expect(fixed.outcome).toBe("floated");
    const words = endWords(fixed, britannic, 1, {
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    });
    expect(words.title).toBe("She stayed afloat.");
    expect(words.lines[0]).toMatch(
      /^With her portholes shut, her doors closed and her engines stopped, the water stayed in the rooms the mine opened/
    );
    expect(words.lines[1]).toMatch(/six/);
    // One fix alone.
    expect(
      endWords(fixed, britannic, 1, { doorsClosed: true }).lines[0]
    ).toMatch(/^With her doors closed, the water stayed/);
    // Shelter (R18; her real profile never reaches it, R20c): words kept.
    const kea: SimTrack = {
      ...fixed,
      events: [
        ...fixed.events,
        { kind: "sheltered", t: at(9, 40), realT: at(9, 40) },
      ],
    };
    const safe = endWords(kea, britannic, 1);
    expect(safe.title).toBe("She reached Kea.");
    expect(safe.lines[0]).toMatch(/9:40\sAM/);
  });

  // Task 2b, Step 3: Run for Kea changes her end by seconds (R20b), so
  // the card names what mattered.
  it("says what mattered when only her engines were stopped", () => {
    const lesson =
      "Stopping her engines changed little. Her open portholes and the door that did not shut mattered most.";
    const stopped = simulate(britannic, whatIfOpenings(britannic, ["hold3"]), {
      enginesStopped: true,
    });
    expect(stopped.outcome).toBe("sank");
    const ctx = { enginesStopped: true, realSpot: true, hits: 1 };
    expect(endWords(stopped, britannic, 1, ctx).lines).toContain(lesson);
    kindWords(lesson);
    // Not when anything else differs from her real morning.
    for (const other of [
      { ...ctx, enginesStopped: false },
      { ...ctx, realSpot: false },
      { ...ctx, doorsClosed: true },
      { ...ctx, portholesOpen: false },
      { ...ctx, hits: 2 },
    ])
      expect(endWords(stopped, britannic, 1, other).lines).not.toContain(
        lesson
      );
    // Nor on the real morning, nor when she sinks more than 2 min off it.
    expect(endWords(real, britannic, 1).lines).not.toContain(lesson);
    const late = (dt: number): SimTrack => {
      const t = (stopped.sankAtT as number) + dt;
      return {
        ...stopped,
        sankAtT: t,
        events: stopped.events.map((e) =>
          e.kind === "stern-under" ? { ...e, t, realT: t } : e
        ),
      };
    };
    expect(endWords(late(200), britannic, 1, ctx).lines).not.toContain(lesson);
    expect(endWords(late(-200), britannic, 1, ctx).lines).not.toContain(lesson);
  }, 30000);

  it("marks her timeline on her own morning clock", () => {
    const marks = timelineMarks(real, britannic);
    expect(marks.map((m) => m.kind)).toEqual(["boat", "lights", "sinks"]);
    expect(marks.every((m) => / AM$/.test(m.label))).toBe(true);
  });

  it("tells the grown-ups, in the spec's words", () => {
    expect(PARENT_LINES.britannic).toBe(
      "This is the Britannic in 1916, a hospital ship in the First World War. A mine sank her in 55 minutes, and 30 people died. This game shows only the ship."
    );
  });
});

describe("the Britannic's What if words", () => {
  it("words each starboard spot as a mine", () => {
    expect(spotLabel(britannic, "hold2")).toBe("Hold 2");
    expect(spotAria(britannic, "hold2", true)).toBe("Hold 2: a mine hits here");
    expect(spotAria(britannic, "hold2", false)).toBe("Hold 2: no mine");
    expect(whatIfRealIds(britannic)).toEqual(["hold3"]);
  });

  it("has three picture toggles, each with words for on and off and a help line", () => {
    expect(MINE_TOGGLES.map((t) => t.id)).toEqual([
      "portholes",
      "doors",
      "engines",
    ]);
    for (const t of MINE_TOGGLES) {
      expect(t.label(true)).not.toBe(t.label(false));
      expect(t.aria(true)).not.toBe(t.aria(false));
      expect(t.aria(true)).toMatch(/tap to/);
      expect(t.help.length).toBeGreaterThan(20);
    }
    expect(MINE_TOGGLES[0].label(true)).toBe("Portholes open");
    expect(MINE_TOGGLES[1].label(true)).toBe("Doors stuck open");
    expect(MINE_TOGGLES[2].label(true)).toBe("Run for Kea");
  });
});

describe("the Britannic's places and help", () => {
  const hull = buildHull(britannic);
  const places = PLACES_BY_SHIP.britannic;
  const comp = (id: string | null) =>
    britannic.compartments.find((c) => c.id === id);

  it("are her bridge, the mine's hold, boiler room 6, the open portholes, a gantry davit and the turbine room", () => {
    expect(places.map((p) => p.id)).toEqual([
      "bridge",
      "hold-2",
      "boiler-room-6",
      "portholes",
      "gantry-davit",
      "turbine-room",
    ]);
    expect(placeFor("britannic", "hold-2")?.compartmentId).toBe("hold2");
    expect(placeFor("britannic", "hold-2")?.fact).toMatch(/mine/);
    expect(placeFor("britannic", "boiler-room-6")?.compartmentId).toBe("br6");
    expect(placeFor("britannic", "turbine-room")?.compartmentId).toBe(
      "turbine"
    );
    expect(placeFor("britannic", "portholes")?.fact).toMatch(/E deck/);
    // The gantry by the officers' quarters: starboard, forward.
    const g = placeFor("britannic", "gantry-davit")!;
    expect(g.at[0]).toBe(BRITANNIC_GANTRY_SETS[0].x);
    expect(g.at[1]).toBeLessThan(0);
    expect(placeFor("britannic", "grand-staircase")).toBeNull();
  });

  it("each sits inside her hull or on her decks, in a compartment she has", () => {
    for (const p of places) {
      const [x, y, z] = p.at;
      expect(p.fact.length).toBeGreaterThan(30);
      expect(p.floorZ).toBeLessThanOrEqual(z);
      expect(x).toBeGreaterThan(hull.xMin);
      expect(x).toBeLessThan(hull.xMax);
      if (p.compartmentId) {
        const c = comp(p.compartmentId);
        expect(c).toBeDefined();
        expect(p.interior).toBe(true);
        expect(x).toBeGreaterThanOrEqual(c!.fromX);
        expect(x).toBeLessThanOrEqual(c!.toX);
        expect(z).toBeLessThan(britannic.sheerZ(x));
        const [lo, hi] = spanRange(c!, hullHalfBreadth(hull, x, z));
        expect(y).toBeGreaterThan(lo);
        expect(y).toBeLessThan(hi);
      } else {
        // Over her decks: within her breadth, under her gantry tops.
        expect(Math.abs(y)).toBeLessThan(britannic.beam / 2);
        expect(z).toBeGreaterThan(britannic.sheerZ(x));
        expect(z).toBeLessThan(britannic.sheerZ(x) + 25);
      }
    }
  });

  it("the open portholes' pin sits at her E-deck row, by her starboard side", () => {
    const p = placeFor("britannic", "portholes")!;
    const rowZ = Math.max(...(britannic.portholes ?? []).map((r) => r.z));
    const [x, y, z] = p.at;
    expect(
      Math.abs(z - (rowZ + britannic.sheerZ(x) - britannic.sheerZ(0)))
    ).toBeLessThan(3);
    expect(y).toBeLessThan(-hullHalfBreadth(hull, x, z) + 3);
  });

  it("words her cards for a mine, a shallow sea and her morning", () => {
    const controls = helpFor("controls", null, britannic).lines.join(" ");
    expect(controls).toMatch(/how fast the morning goes/);
    expect(controls).toMatch(
      /the Bridge, Hold 2, Boiler Room 6, the Open Portholes, the Gantry Davit and the Turbine Room/
    );
    expect(helpFor("water", null, britannic).lines.join(" ")).toMatch(
      /Britannic weighed about 53,000 t/
    );
    expect(helpFor("bow", null, britannic).lines.join(" ")).toMatch(/120 m/);
    expect(helpFor("lean", null, britannic).lines.join(" ")).toMatch(
      /her side/
    );
    expect(helpFor("water", null, britannic).lines.join(" ")).not.toMatch(
      /Titanic/
    );
  });
});
