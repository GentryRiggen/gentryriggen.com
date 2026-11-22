import type { Opening, ShipSpec } from "../../ships/types";
import { VENT_BURST_M2 } from "../constants";
import { makeCell, seaInflow } from "../flooding";
import { buildHull, hullSlice } from "../geometry";
import { hydrostatics } from "../hydrostatics";
import { simulate } from "../run";
import type { SimTrack } from "../track";
import { WING_Y, wingShip } from "./testShips";

/**
 * Wing bunkers beside a centre space (the Lusitania's longitudinal coal
 * bunkers), the coal doors between them, portholes, and openings that wait.
 */

const END = 3600;
const AFT = 0;
const CENTRE = 1;
const PORT = 2;
const STBD = 3;
const FORE = 4;

const stbdHole: Opening = {
  compartmentId: "stbd",
  areaM2: 0.5,
  zLow: 1,
  zHigh: 3,
  x: 0,
  side: "starboard",
};

function last(track: SimTrack) {
  return track.frames[track.frames.length - 1];
}

function withComp(
  spec: ShipSpec,
  id: string,
  more: Partial<ShipSpec["compartments"][number]>
): ShipSpec {
  return {
    ...spec,
    compartments: spec.compartments.map((c) =>
      c.id === id ? { ...c, ...more } : c
    ),
  };
}

describe("wing cells", () => {
  it("a starboard wing opening lists the ship to starboard", () => {
    const track = simulate(wingShip(), [stbdHole], { endT: END });
    const end = last(track);
    expect(end.listDeg).toBeGreaterThan(5);
    expect(end.water[STBD]).toBeGreaterThan(0.3);
    expect(end.water[PORT]).toBeLessThan(0.01);
    expect(end.water[CENTRE]).toBeLessThan(0.01);
    expect(end.water[AFT]).toBeLessThan(0.01);
    expect(end.water[FORE]).toBeLessThan(0.01);
  });

  it("cross flow fills the centre slowly", () => {
    const spec = withComp(wingShip(), "stbd", { crossFlowM2: 0.05 });
    const track = simulate(spec, [stbdHole], { endT: END });
    const end = last(track);
    expect(end.water[CENTRE]).toBeGreaterThan(0.01);
    expect(end.water[CENTRE]).toBeLessThan(end.water[STBD]);
    expect(end.water[PORT]).toBeLessThan(0.01);
    // Slowly: well behind the wing that the sea fills directly.
    const early = track.frames.find((f) => f.t >= 300);
    expect(early?.water[CENTRE]).toBeLessThan(0.05);
  });

  it("cross flow runs both ways and to both wings", () => {
    // The centre holed: the sea fills it, and it fills both wings through
    // their doors (centre to wing), the two alike.
    const doors = withComp(
      withComp(wingShip(), "stbd", { crossFlowM2: 0.05 }),
      "port",
      { crossFlowM2: 0.05 }
    );
    const centreHole: Opening = { ...stbdHole, compartmentId: "centre" };
    const end = last(simulate(doors, [centreHole], { endT: END }));
    expect(end.water[CENTRE]).toBeGreaterThan(0.2);
    expect(end.water[PORT]).toBeGreaterThan(0.01);
    expect(end.water[STBD]).toBeGreaterThan(0.01);
    expect(end.water[PORT]).toBeLessThan(end.water[CENTRE]);
    expect(Math.abs(end.water[PORT] - end.water[STBD])).toBeLessThan(
      0.2 * end.water[STBD]
    );
    // The port wing holed: it fills the centre (wing to centre, port side),
    // and the starboard wing only through the centre, last.
    const portHole: Opening = {
      ...stbdHole,
      compartmentId: "port",
      side: "port",
    };
    const fromPort = last(simulate(doors, [portHole], { endT: END }));
    expect(fromPort.listDeg).toBeLessThan(0); // to port
    expect(fromPort.water[CENTRE]).toBeGreaterThan(0.01);
    expect(fromPort.water[CENTRE]).toBeLessThan(fromPort.water[PORT]);
    expect(fromPort.water[STBD]).toBeLessThan(fromPort.water[CENTRE]);
  });

  it("wing and centre volumes add up to the full section", () => {
    const spec = wingShip();
    const hull = buildHull(spec);
    const full = hullSlice(hull, -15, 15);
    const parts = (["centre", "port", "starboard"] as const).map((side) =>
      hullSlice(hull, -15, 15, { side, y: WING_Y })
    );
    for (const pose of [
      { heave: -6, pitch: 0, roll: 0 },
      { heave: -6, pitch: 0, roll: 0.3 },
      { heave: -5, pitch: 0.05, roll: -0.2 },
      { heave: -20, pitch: 0, roll: 0 }, // wholly under
    ]) {
      const whole = hydrostatics(full, pose);
      const each = parts.map((p) => hydrostatics(p, pose));
      const sum = each.reduce((a, h) => a + h.volume, 0);
      expect(Math.abs(sum - whole.volume)).toBeLessThan(0.005 * whole.volume);
      // The transverse moments add up too (a wing's buoyancy is off centre).
      const my = each.reduce((a, h) => a + h.volume * h.cb.y, 0);
      expect(Math.abs(my - whole.volume * whole.cb.y)).toBeLessThan(
        0.005 * whole.volume * 10
      );
    }
    // A wing is its own share: port is to port, starboard to starboard.
    const under = { heave: -20, pitch: 0, roll: 0 };
    expect(hydrostatics(parts[1], under).cb.y).toBeGreaterThan(WING_Y);
    expect(hydrostatics(parts[2], under).cb.y).toBeLessThan(-WING_Y);
    expect(parts[1].cy).toBeCloseTo(8, 6);
  });
});

describe("trapped air deep down", () => {
  // The port wing, empty, its deck 40 m under a level sea.
  const spec = withComp(wingShip(), "port", { burstM2: 0.2 });
  const hull = buildHull(spec);
  const wing = (burst?: number) => {
    const c = makeCell(
      hullSlice(hull, -15, 15, { side: "port", y: WING_Y }),
      PORT,
      false,
      12,
      12,
      true,
      true,
      0.95
    );
    if (burst !== undefined) c.burst = burst;
    return c;
  };

  it("bursts the 1.0 vents and hatches by default", () => {
    const q = seaInflow(wing(), 0, 0, 1, -52);
    expect(q).toBeCloseTo(0.6 * VENT_BURST_M2 * Math.sqrt(2 * 9.81 * 40), 6);
  });

  it("lets a tank's air out by its own vents (`burstM2`)", () => {
    const q = seaInflow(wing(0.2), 0, 0, 1, -52);
    expect(q).toBeCloseTo(0.6 * 0.2 * Math.sqrt(2 * 9.81 * 40), 6);
    // The run takes it from the compartment.
    let seen = -1;
    simulate(spec, [], {
      endT: 1,
      probe: (p) => {
        seen = p.bodies[0].cells[PORT].burst;
      },
    });
    expect(seen).toBe(0.2);
  });
});

describe("portholes", () => {
  // A starboard row over the fore hold, above the sea until she lists
  // past about 11°.
  const spec = (): ShipSpec => ({
    ...wingShip(),
    portholes: [
      { z: 7.5, fromX: 20, toX: 45, side: "starboard", openM2PerM: 0.01 },
    ],
  });

  it("porthole rows flood once under", () => {
    const open = simulate(spec(), [stbdHole], { endT: END });
    const firstWet = open.frames.find((f) => f.water[FORE] > 0);
    const passed = open.frames.find((f) => f.listDeg >= 10);
    expect(passed).toBeDefined();
    expect(firstWet).toBeDefined();
    expect(firstWet!.t).toBeGreaterThan(passed!.t);
    expect(firstWet!.listDeg).toBeGreaterThanOrEqual(10);

    const shut = simulate(spec(), [stbdHole], {
      endT: END,
      portholesOpen: false,
    });
    expect(shut.frames.every((f) => f.water[FORE] === 0)).toBe(true);
    // The water they let in lists her further.
    const at = (track: SimTrack) => track.frames.find((f) => f.t >= 1200);
    expect(at(open)!.listDeg).toBeGreaterThan(at(shut)!.listDeg + 2);
  });
});

describe("porthole sides", () => {
  it("a port row stays dry while she lists to starboard", () => {
    // The same row as above, but on the port side: her list lifts it.
    const port = (): ShipSpec => ({
      ...wingShip(),
      portholes: [
        { z: 7.5, fromX: 20, toX: 45, side: "port", openM2PerM: 0.01 },
      ],
    });
    const track = simulate(port(), [stbdHole], { endT: END });
    expect(Math.max(...track.frames.map((f) => f.listDeg))).toBeGreaterThan(10);
    expect(track.frames.every((f) => f.water[FORE] === 0)).toBe(true);
    expect(last(track)).toEqual(
      last(simulate(port(), [stbdHole], { endT: END, portholesOpen: false }))
    );
  });
});

describe("timed openings", () => {
  it("a timed opening waits", () => {
    const hole: Opening = {
      compartmentId: "fore",
      areaM2: 0.5,
      zLow: 1,
      zHigh: 2,
      x: 30,
      side: "starboard",
      t: 30,
    };
    const track = simulate(wingShip(), [hole], { endT: 120 });
    const before = track.frames.filter((f) => f.t <= 30);
    expect(before.length).toBeGreaterThan(10);
    expect(before.every((f) => f.water[FORE] === 0)).toBe(true);
    const later = track.frames.find((f) => f.t >= 60);
    expect(later?.water[FORE]).toBeGreaterThan(0);
  });
});
