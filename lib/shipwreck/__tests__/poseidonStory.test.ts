import { PARENT_LINES } from "@/components/shipwreck/parentLine";
import { helpFor, leanText, powerText, type HelpTopic } from "../help";
import { PLACES_BY_SHIP, POSEIDON_PLACE_IDS } from "../places";
import { poseidon } from "../ships/poseidon";
import { SIM_EVENT_KINDS } from "../sim/events";
import { simulate, whatIfOpenings, whatIfSpots } from "../sim/run";
import type { SimTrack } from "../sim/track";
import {
  WAVE_MOMENT_KINDS,
  captionContext,
  captionEventsBetween,
  captionFor,
  captionText,
  clockText,
  endWords,
  historyNote,
  outcomeOf,
  runInCaption,
  sinceText,
  storyOf,
  timelineMarks,
  waveMoments,
} from "../story";
import { WAVE_CHOICES, spotAria, spotLabel } from "../whatIf";
import { resolveTime, timesOf } from "../times";

/** Words for people in danger, deaths or numbers of them (the 1.0 list). */
const UNKIND =
  /\b(die[ds]?|dying|dead|deaths?|kill\w*|drown\w*|scream\w*|people|passengers?|crew|children|victims?|bodies|lives|lost|trapped|panic\w*)\b/i;
/** Never in her play words: who is aboard, or the film. */
const NEVER =
  /\b(captain|passengers?|survivors?|party-?goers?|films?|characters?)\b/i;

function kind(text: string) {
  expect(text).not.toMatch(UNKIND);
  expect(text).not.toMatch(NEVER);
}

const contexts = [
  {},
  { wave: { variant: "real" as const, smashed: true } },
  { wave: { variant: "real" as const, smashed: false } },
  { wave: { variant: "smaller" as const, smashed: true } },
  { wave: { variant: "ahead" as const, smashed: true } },
  { first: false },
];

describe("the Poseidon's words", () => {
  let real: SimTrack;
  let smaller: SimTrack;
  let ahead: SimTrack;
  let none: SimTrack;
  let fwd: SimTrack;
  beforeAll(() => {
    real = simulate(poseidon, poseidon.realNight);
    smaller = simulate(poseidon, whatIfOpenings(poseidon, [], "smaller"), {
      wave: "smaller",
    });
    ahead = simulate(poseidon, whatIfOpenings(poseidon, [], "ahead"), {
      wave: "ahead",
    });
    none = simulate(poseidon, whatIfOpenings(poseidon, []));
    fwd = simulate(poseidon, whatIfOpenings(poseidon, ["fwd-win"]));
  }, 60_000);

  it("counts from the wave, on her real clock", () => {
    expect(sinceText(120, poseidon)).toBe("2 min after the wave");
    expect(sinceText(0, poseidon)).toBe("Just hit by the wave");
    expect(sinceText(-30, poseidon)).toBe("Just before the wave");
    expect(storyOf(poseidon).realLabel).toBe("The big wave");
    expect(clockText(0, poseidon.clockStartS)).toBe("11:58 PM");
    expect(clockText(3 * 60, poseidon.clockStartS)).toBe("12:01 AM");
  });

  it("has a caption or an explicit none for every event and moment", () => {
    const nones = new Set<string>();
    for (const k of [...SIM_EVENT_KINDS, ...WAVE_MOMENT_KINDS])
      for (const ctx of contexts)
        for (const index of [0, 1, undefined]) {
          const text = captionText({ kind: k, index }, poseidon, ctx);
          if (text === null) nones.add(k);
          else expect(text.length).toBeGreaterThan(10);
        }
    for (const k of [
      "explosion",
      "steam-start",
      "rocket",
      "boat-lowered",
      "lights-flicker",
      "breakup",
      "floating-steady",
    ])
      expect(nones).toContain(k);
    // The beats of her night each have words.
    for (const k of [
      "collision",
      "rolling",
      "on-her-side",
      "lights-out",
      "capsized",
      "keel-up-flooding",
      "ballroom-full",
      "bow-under",
      "stern-under",
      "bow-lands",
      "sheltered",
    ])
      expect(captionText({ kind: k as never }, poseidon)).not.toBeNull();
  });

  it("words the wave, the hit, her roll, the air and her rest", () => {
    const t = (k: string, ctx = {}) =>
      captionText({ kind: k as never }, poseidon, ctx);
    expect(runInCaption(poseidon, 1, -50)).toBe(
      "It's New Year's Eve. The Poseidon is lit up from end to end."
    );
    expect(runInCaption(poseidon, 1, -10)).toBe("A giant wave is coming!");
    expect(t("collision")).toBe("The wave hits her side! Windows break.");
    expect(t("rolling")).toBe("She's rolling over…");
    expect(t("lights-out")).toBe(
      "Her lights go out. Only her emergency lights are on."
    );
    expect(t("capsized")).toBe(
      "She's upside down! Air caught inside is holding her up."
    );
    expect(t("keel-up-flooding")).toBe(
      "Water is coming in through the broken windows. Air is bubbling out."
    );
    expect(t("ballroom-full")).toBe("The ballroom has filled with water.");
    expect(t("bow-under")).toBe("Not enough air is left. She's sinking.");
    expect(t("bow-lands")).toBe(
      "She rests upside down on the ocean floor, 4,000 metres down."
    );
    // A smaller wave or one from ahead is not the giant one.
    expect(
      t("collision", { wave: { variant: "smaller", smashed: true } })
    ).not.toMatch(/Windows break/);
    expect(
      t("collision", { wave: { variant: "ahead", smashed: true } })
    ).toMatch(/bow/);
    expect(
      t("collision", { wave: { variant: "real", smashed: false } })
    ).not.toMatch(/Windows break/);
  });

  it("never words people, deaths, a captain, passengers or the film in play", () => {
    for (const k of [...SIM_EVENT_KINDS, ...WAVE_MOMENT_KINDS])
      for (const ctx of contexts)
        kind(captionText({ kind: k }, poseidon, ctx) ?? "");
    for (const tr of [real, smaller, ahead, none, fwd])
      for (const e of captionEventsBetween(tr, poseidon, -1, tr.endT + 1))
        kind(captionFor(e, poseidon, captionContext(tr, e.t, e)) ?? "");
    for (const s of [-50, -10])
      for (const v of ["real", "smaller", "ahead"] as const)
        kind(runInCaption(poseidon, 1, s, v) ?? "");
    for (const id of whatIfSpots(poseidon))
      for (const on of [true, false]) kind(spotAria(poseidon, id, on));
    for (const w of WAVE_CHOICES) kind(`${w.label}. ${w.aria}. ${w.help}`);
    for (const p of PLACES_BY_SHIP.poseidon) kind(`${p.label}. ${p.fact}`);
    for (const topic of ["controls", "water", "bow", "lean", "power"]) {
      const h = helpFor(topic as HelpTopic, null, poseidon);
      kind([h.title, ...h.lines].join(" "));
    }
    for (const track of [real, smaller, ahead, none, fwd])
      for (const holes of [0, 3, 7]) {
        const w = endWords(track, poseidon, holes);
        kind([w.title, ...w.lines].join(" "));
      }
  });

  it("shows the real clock after she capsizes, not the slowed shown time", () => {
    const cap = real.events.find((e) => e.kind === "capsized")!;
    // Shown time runs 6x slower from here, so her events keep real time.
    const stern = real.events.find((e) => e.kind === "stern-under")!;
    expect(stern.realT).toBeGreaterThan(stern.t);
    const line = captionFor(stern, poseidon)!;
    expect(line.startsWith(clockText(stern.realT, poseidon.clockStartS))).toBe(
      true
    );
    expect(line).not.toContain(clockText(stern.t, poseidon.clockStartS));
    expect(cap.realT).toBeLessThan(60);
  });

  it("finds her moments in the frames: roll, air, ballroom", () => {
    const m = waveMoments(real, poseidon);
    const at = (k: string) => m.find((x) => x.kind === k);
    expect(at("rolling")).toBeDefined();
    expect(at("on-her-side")!.t).toBeGreaterThan(at("rolling")!.t);
    const cap = real.events.find((e) => e.kind === "capsized")!;
    expect(at("on-her-side")!.t).toBeLessThan(cap.t + 1);
    expect(at("keel-up-flooding")!.realT).toBeGreaterThan(cap.realT);
    expect(at("ballroom-full")!.realT).toBeGreaterThan(cap.realT);
    // A lean she recovers from is no "rolling over".
    expect(waveMoments(smaller, poseidon)).toEqual([]);
    expect(waveMoments(ahead, poseidon)).toEqual([]);
    // No other ship has any.
    expect(waveMoments(real, { ...poseidon, cause: "iceberg" })).toEqual([]);
    // The walk through a window sorts events and moments together.
    const walked = captionEventsBetween(real, poseidon, -1, real.endT);
    expect(walked.map((e) => e.t)).toEqual(
      [...walked.map((e) => e.t)].sort((a, b) => a - b)
    );
    expect(walked.some((e) => e.kind === "rolling")).toBe(true);
  });

  it("ends her night from the run's own outcome and times", () => {
    // Real: sank after floating keel up.
    expect(outcomeOf(real)).toBe("sank");
    const w = endWords(real, poseidon, 7);
    const up = real.events.find((e) => e.kind === "capsized")!;
    const gone = real.events.find((e) => e.kind === "stern-under")!;
    const minutes = Math.round((gone.realT - up.realT) / 60);
    expect(w.title).toBe(
      `Upside down, she floated for ${minutes} minutes, then sank at ${clockText(gone.realT, poseidon.clockStartS)}.`
    );
    expect(w.title).toMatch(/floated for \d+ minutes, then sank at 12:\d\d AM/);
    expect(w.outcome).toBe("sank");
    // Front windows alone still sink her, and the card follows the run.
    expect(outcomeOf(fwd)).toBe("sank");
    expect(endWords(fwd, poseidon, 2).title).toMatch(/then sank at/);
    // Nothing smashed on the real wave: still afloat upside down.
    expect(outcomeOf(none)).toBe("capsized");
    const c = endWords(none, poseidon, 0);
    expect(c.outcome).toBe("capsized");
    expect(c.title).toBe("Upside down, she was still floating.");
    // The smaller wave: leaned far over, stood up again.
    expect(outcomeOf(smaller)).toBe("floated");
    expect(endWords(smaller, poseidon, 0).title).toBe(
      "She leaned far over, then stood up again."
    );
    // From ahead: ridden over.
    expect(outcomeOf(ahead)).toBe("floated");
    expect(endWords(ahead, poseidon, 0).title).toBe("She rode over the wave.");
    // The lines describe the run, not the chip: neither names a wave size
    // or direction the run may not have had.
    for (const t of [smaller, ahead]) {
      const lines = endWords(t, poseidon, 0).lines.join(" ");
      expect(lines).not.toMatch(/smaller wave|came at her bow/i);
    }
  });

  it("marks her roll-over on the timeline, with her real clock", () => {
    const marks = timelineMarks(real, poseidon);
    const up = marks.find((m) => m.kind === "capsized")!;
    expect(up.label).toBe("Upside down, 11:58 PM");
    expect(marks.map((m) => m.kind)).toEqual(["lights", "capsized", "sinks"]);
    expect(timelineMarks(smaller, poseidon).map((m) => m.kind)).toEqual([
      "shelter",
    ]);
  });

  it("says nothing of a real history", () => {
    expect(historyNote(poseidon)).toMatch(/made-up ship/);
    expect(PARENT_LINES.poseidon).toBe(
      "The Poseidon is not a real ship. She is a made-up cruise ship from a 2006 film, rolled over by a giant wave on New Year's Eve. Real ships have met waves nearly this big. This game shows what physics says could happen to a ship turned upside down, and it shows only the ship."
    );
  });

  it("reads her lean in words past her side", () => {
    expect(leanText({ listDeg: 185 })).toBe("upside down");
    expect(leanText({ listDeg: -190 })).toBe("upside down");
    expect(leanText({ listDeg: 95 })).toBe("on her side");
    // Past a full turn it folds back: 287 degrees is 73 degrees the other way.
    expect(leanText({ listDeg: 287 })).toBe("73.0° to port");
    expect(leanText({ listDeg: 10 })).toBe("10.0° to starboard");
    expect(leanText({ listDeg: -10 })).toBe("10.0° to port");
    expect(leanText({ listDeg: 0 })).toBe("Upright");
  });

  it("calls her emergency level emergency lights, not a flicker", () => {
    const em = poseidon.blackout!.emergencyLight;
    expect(powerText({ power: em }, poseidon)).toBe("Emergency lights");
    expect(powerText({ power: 1 }, poseidon)).toBe("Lights on");
    expect(powerText({ power: 0 }, poseidon)).toBe("Lights out");
    expect(powerText({ power: 0.6 }, poseidon)).toBe("Lights flickering");
    // Other ships' chips are as they were.
    expect(powerText({ power: em })).toBe("Lights flickering");
  });

  it("has her places inside her hull or boxes", () => {
    expect(PLACES_BY_SHIP.poseidon.map((p) => p.id)).toEqual([
      ...POSEIDON_PLACE_IDS,
    ]);
    const x0 = poseidon.stations[0].x;
    const x1 = poseidon.stations[poseidon.stations.length - 1].x;
    const hull = (x: number, z: number) =>
      x > x0 && x < x1 && z > 0 && z < poseidon.funnels[0].topZ;
    const boxes = poseidon.superstructure;
    for (const p of PLACES_BY_SHIP.poseidon) {
      const [x, y, z] = p.at;
      expect(hull(x, z)).toBe(true);
      expect(Math.abs(y)).toBeLessThan(poseidon.beam / 2);
      expect(p.floorZ).toBeLessThanOrEqual(z);
      if (p.compartmentId !== null) {
        const c = poseidon.compartments.find((k) => k.id === p.compartmentId)!;
        expect(x).toBeGreaterThanOrEqual(c.fromX);
        expect(x).toBeLessThan(c.toX);
      }
    }
    const inBox = (id: string, x: number, z: number) => {
      const b = boxes.find((s) => s.id === id)!;
      return x >= b.fromX && x <= b.toX && z <= b.topZ;
    };
    const at = (id: (typeof POSEIDON_PLACE_IDS)[number]) =>
      PLACES_BY_SHIP.poseidon.find((p) => p.id === id)!;
    // The bridge forward in her upper tier, the ballroom in its box, the
    // lobby in her middle tier, the engine room in WTC 6.
    expect(
      inBox(
        "fwd-upper",
        ...([at("bridge").at[0], at("bridge").at[2]] as [number, number])
      )
    ).toBe(true);
    expect(inBox("ballroom", at("ballroom").at[0], at("ballroom").at[2])).toBe(
      true
    );
    expect(inBox("mid-lower", at("lobby").at[0], at("lobby").at[2])).toBe(true);
    expect(at("engine-room").compartmentId).toBe("wtc6");
    expect(at("funnel").at[0]).toBe(poseidon.funnels[0].x);
    // A propeller: aft, off her centreline, under her stern; a lifeboat in
    // the recess on deck 4.
    expect(at("propeller").at[0]).toBeLessThan(-100);
    expect(Math.abs(at("propeller").at[1])).toBeGreaterThan(3);
    expect(at("lifeboat").at[2]).toBeGreaterThan(20);
  });

  it("words her seven spots and her wave chip", () => {
    expect(whatIfSpots(poseidon)).toHaveLength(7);
    expect(spotLabel(poseidon, "ballroom")).toBe("The ballroom dome");
    expect(spotAria(poseidon, "vents", true)).toBe(
      "Engine air vents: the wave smashes it"
    );
    expect(spotAria(poseidon, "vents", false)).toBe(
      "Engine air vents: the wave leaves it whole"
    );
    expect(WAVE_CHOICES.map((w) => w.id)).toEqual(["real", "smaller", "ahead"]);
  });

  it("offers her real night and by day", () => {
    expect(timesOf("poseidon").map((o) => o.id)).toEqual(["real", "storm-day"]);
    expect(timesOf("poseidon")[0].label).toMatch(/midnight/);
    expect(timesOf("poseidon")[1].label).toBe("The big wave by day");
    expect(resolveTime("poseidon", "night")).toBe("real");
    expect(resolveTime("poseidon", "storm-day")).toBe("storm-day");
  });
});
