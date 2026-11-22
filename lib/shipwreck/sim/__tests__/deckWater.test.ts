import { fitzgerald, titanic } from "../../ships";
import type { ShipSpec, StormSpec } from "../../ships/types";
import { deckWaterVolume } from "../deckWater";
import { simulate } from "../run";

/**
 * Green water on her open deck (deckWater.ts): a sea over her deck edge
 * pours onto the deck, stands round the coamings and vents for seconds and
 * runs back off; it adds to the head at the openings standing in it.
 */

/** A steady sea of one big wave along her (no ramp, no groups). */
function swell(a: number): StormSpec {
  return {
    components: [{ amplitudeM: a, periodS: 11, dirDeg: 10, phase: 0 }],
    hsM: 4 * a * Math.SQRT1_2,
    windKn: 50,
  };
}

/** Her deck water through a short run, every step, and what came in. */
function run(spec: ShipSpec, endT = 400) {
  const vol: number[] = [];
  let deckIn = 0;
  let vents = 0;
  const tank = spec.compartments.findIndex((c) => c.id === "tank1-s");
  const track = simulate(spec, [], {
    endT,
    probe: (p) => {
      const b = p.bodies[0];
      vol.push(deckWaterVolume(b.deckWater));
      deckIn = 0;
      vents = 0;
      for (const c of b.all) {
        deckIn += c.deckIn;
        if (c.comp === tank) vents += c.deckIn;
      }
    },
  });
  return { vol, deckIn, vents, track };
}

describe("green water on her deck", () => {
  const spec: ShipSpec = { ...fitzgerald, storm: swell(4.2) };

  it("comes aboard over the edge and runs off within seconds", () => {
    const { vol } = run(spec);
    const top = Math.max(...vol);
    expect(top).toBeGreaterThan(20);
    // Between crests (an encounter period is about 15 s) the deck clears:
    // it never stays loaded for 10 s running.
    let loaded = 0;
    let longest = 0;
    for (const v of vol) {
      loaded = v > 0.5 * top ? loaded + 1 : 0;
      longest = Math.max(longest, loaded);
    }
    expect(longest).toBeLessThan(10);
    expect(vol.some((v, i) => i > 30 && v < 0.05 * top)).toBe(true);
  });

  it("adds to the head at the openings standing in it", () => {
    // Her vents set nearly flush with the deck, inboard of the edge: the
    // crest stands over them only as it tops the edge, the deck's water
    // for seconds after, so they let in more with it than without.
    const low: ShipSpec = {
      ...spec,
      storm: swell(5),
      deckOpenings: (spec.deckOpenings ?? []).map((d) =>
        d.kind === "vent"
          ? { ...d, y: d.y + 1.5, z: fitzgerald.sheerZ(d.x) + 0.05 }
          : d
      ),
    };
    // (Into the tanks they serve: the split under the edge sees only the sea.)
    const withDeck = run(low).vents;
    const without = run({ ...low, openDeck: undefined }).vents;
    expect(without).toBeGreaterThan(0);
    expect(withDeck).toBeGreaterThan(1.3 * without);
  });

  it("stays dry in still water and in a sea under her deck edge", () => {
    expect(Math.max(...run({ ...fitzgerald, storm: undefined }, 200).vol)).toBe(
      0
    );
    expect(Math.max(...run({ ...fitzgerald, storm: swell(1) }, 200).vol)).toBe(
      0
    );
  });

  it("has a bay to each hatch between her houses", () => {
    const d = fitzgerald.openDeck!;
    expect(d.bayX).toHaveLength(21);
    for (let i = 1; i < d.bayX.length; i += 1)
      expect(d.bayX[i]).toBeGreaterThan(d.bayX[i - 1]);
    expect(d.fromX).toBeLessThan(d.bayX[0]);
    expect(d.toX).toBeGreaterThan(d.bayX[20]);
    expect(d.camberM).toBeCloseTo(18 * 0.0254, 3);
  });
});

describe("deck water in the track", () => {
  it("records each bay's water in every frame while she is whole (the liners record none)", () => {
    const { track } = run(fitzgerald, 400);
    const bays = fitzgerald.openDeck!.bayX.length;
    for (const f of track.frames) {
      expect(f.deckWater).toHaveLength(bays);
      for (const v of f.deckWater!) expect(v).toBeGreaterThanOrEqual(0);
    }
    const liner = simulate(titanic, titanic.realNight, { endT: 30 });
    for (const f of liner.frames) expect(f.deckWater).toBeUndefined();
  });

  it("has green water on her deck in the evening storm", () => {
    const track = simulate(fitzgerald, fitzgerald.realNight, {
      endT: 2 * 3600 + 600,
    });
    let most = 0;
    for (const f of track.frames)
      if (f.t >= 2 * 3600)
        most = Math.max(
          most,
          f.deckWater!.reduce((s, v) => s + v, 0)
        );
    expect(most).toBeGreaterThan(5);
  });
});
