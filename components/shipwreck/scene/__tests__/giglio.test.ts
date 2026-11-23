import {
  concordia,
  concordiaEarth,
  frameX,
} from "@/lib/shipwreck/ships/concordia";
import { floorAt, shoreDistance } from "@/lib/shipwreck/sim/seabed";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import type { SimFrame, SimTrack } from "@/lib/shipwreck/sim/track";
import {
  GIGLIO_FINE,
  MOLE_LIGHTS,
  STRIKE_GAP_M,
  alongRoute,
  boatRoute,
  buildGiglioGeometry,
  flashOn,
  giglioBuild,
  giglioLights,
  giglioReady,
  groundZ,
  harbourSlot,
  rockArrays,
  rockLodgedT,
  seagrassCards,
  stepGiglio,
  strikeSpray,
} from "../giglio";

const seabed = concordia.seabed!;
const geo = buildGiglioGeometry();

/** Earth (x, y, z) of vertex i of a mesh (three axes x, z, −y). */
const earth = (p: Float32Array, i: number): [number, number, number] => [
  p[i * 3],
  -p[i * 3 + 2],
  p[i * 3 + 1],
];

describe("Giglio's land and floor (one source of truth)", () => {
  it("draws the floor at floorAt at every vertex", () => {
    const p = geo.floor.position;
    for (let i = 0; i < p.length / 3; i += 1) {
      const [x, y, z] = earth(p, i);
      // Float32 positions: a few cm at 3 km.
      expect(Math.abs(z - floorAt(concordia, x, y))).toBeLessThanOrEqual(0.2);
    }
  });

  it("puts the land's waterline on her seabed's shore, within 5 m", () => {
    // Every edge of the land mesh (in the fine grid) that crosses the
    // sea's surface crosses it within 5 m of the traced shoreline.
    const p = geo.land.position;
    const idx = geo.land.index;
    let crossings = 0;
    let worst = 0;
    const fine = (x: number, y: number) =>
      x > GIGLIO_FINE.x[0] &&
      x < GIGLIO_FINE.x[1] &&
      y > GIGLIO_FINE.y[0] &&
      y < GIGLIO_FINE.y[1];
    const grid = new Set<string>();
    for (let t = 0; t < idx.length; t += 3)
      for (let e = 0; e < 3; e += 1) {
        const a = idx[t + e];
        const b = idx[t + ((e + 1) % 3)];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        if (grid.has(key)) continue;
        grid.add(key);
        const A = earth(p, a);
        const B = earth(p, b);
        if (A[2] * B[2] >= 0 || !fine(A[0], A[1]) || !fine(B[0], B[1]))
          continue;
        // Grid edges only (10 m, or a cell's diagonal): not the mole
        // lights' towers or the rocks' lumps.
        const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (len < 9.9 || len > 15) continue;
        const u = A[2] / (A[2] - B[2]);
        const x = A[0] + (B[0] - A[0]) * u;
        const y = A[1] + (B[1] - A[1]) * u;
        // Not over a rock's lump (Le Scole's islets are not the shore).
        if (
          seabed.rocks!.some(
            (r) => Math.hypot(x - r.x, y - r.y) < r.radiusM * 1.3 + 15
          )
        )
          continue;
        crossings += 1;
        worst = Math.max(worst, Math.abs(shoreDistance(seabed, x, y)));
      }
    expect(worst).toBeLessThanOrEqual(5);
    expect(crossings).toBeGreaterThan(300);
  });

  it("rises to Giglio's hills (SRTM) and stays a coast, not a wall", () => {
    let top = 0;
    const p = geo.land.position;
    for (let i = 0; i < p.length / 3; i += 1) top = Math.max(top, p[i * 3 + 1]);
    // Poggio della Chiusa 485 m, Poggio della Pagana 496 m [OSM].
    expect(top).toBeGreaterThan(380);
    expect(top).toBeLessThan(520);
    // Giglio Castello about 400 m [OSM: the village on the ridge].
    const [cx, cy] = concordiaEarth(42.3665063, 10.9002704);
    expect(groundZ(cx, cy)).toBeGreaterThan(330);
    expect(groundZ(cx, cy)).toBeLessThan(470);
  });

  it("keeps her drift and her rest in water, and the open sea deep", () => {
    // Where she lies (22:58 fix) is sea; to seaward the floor falls away.
    expect(floorAt(concordia, 1015, 564)).toBeLessThan(-10);
    expect(groundZ(1330, -1790)).toBeLessThan(-140);
  });

  it("brings the struck rock to her port side at frame 124, not into her", () => {
    const r = rockArrays();
    const p = r.position;
    let nearest = Infinity;
    let reachesUp = false;
    for (let i = 0; i < p.length / 3; i += 1) {
      const [x, y, z] = earth(p, i);
      if (Math.abs(x - frameX(124)) > 4) continue;
      if (z > -9 && z < 0) {
        nearest = Math.min(nearest, y);
        if (z > -3) reachesUp = true;
      }
    }
    expect(nearest).toBeGreaterThanOrEqual(concordia.beam / 2);
    expect(nearest).toBeLessThanOrEqual(
      concordia.beam / 2 + STRIKE_GAP_M + 0.05
    );
    expect(reachesUp).toBe(true);
  });

  it("stands Le Scole's islets out of the sea", () => {
    const p = rockArrays().position;
    for (const r of seabed.rocks!.filter((k) => k.topDepthM <= 0)) {
      let top = -Infinity;
      for (let i = 0; i < p.length / 3; i += 1) {
        const [x, y, z] = earth(p, i);
        if (Math.hypot(x - r.x, y - r.y) < r.radiusM * 0.4)
          top = Math.max(top, z);
      }
      expect(top).toBeGreaterThan(1);
    }
  });
});

describe("Giglio's lights", () => {
  it("puts every house light on land and the mole lights where OpenStreetMap has them", () => {
    const l = giglioLights();
    expect(l.position.length / 3).toBeGreaterThan(300);
    for (let i = 0; i < l.position.length / 3; i += 1) {
      const x = l.position[i * 3];
      const y = -l.position[i * 3 + 2];
      if (l.period[i] > 0) continue;
      expect(shoreDistance(seabed, x, y)).toBeLessThan(0);
      expect(l.position[i * 3 + 1]).toBeGreaterThan(0);
    }
    const flashing = Array.from(l.period).filter((v) => v > 0);
    expect(flashing).toEqual([3, 3]);
    for (const m of MOLE_LIGHTS) {
      const [x, y] = concordiaEarth(m.lat, m.lon);
      let found = false;
      for (let i = 0; i < l.position.length / 3; i += 1)
        if (
          l.period[i] > 0 &&
          Math.hypot(l.position[i * 3] - x, -l.position[i * 3 + 2] - y) < 0.5 &&
          Math.abs(l.position[i * 3 + 1] - 9) < 0.01
        )
          found = true;
      expect(found).toBe(true);
    }
  });

  it("flashes the mole lights 0.5 s in every 3 s", () => {
    let on = 0;
    for (let t = 0; t < 30; t += 0.01) if (flashOn(t, 3, 0)) on += 1;
    expect(on / 3000).toBeCloseTo(0.5 / 3, 2);
    expect(flashOn(5, 0, 0)).toBe(true);
  });
});

describe("the seagrass", () => {
  it("stands on the meadows of the shelf, 6–34 m down", () => {
    const c = seagrassCards();
    expect(c.length / 5).toBeGreaterThan(200);
    for (let i = 0; i < c.length / 5; i += 1) {
      const z = c[i * 5 + 2];
      expect(z).toBeLessThan(-6);
      expect(z).toBeGreaterThan(-34);
      expect(
        Math.abs(z - floorAt(concordia, c[i * 5], c[i * 5 + 1]))
      ).toBeLessThan(0.01);
    }
  });
});

describe("the strike's white water", () => {
  const ev = (t: number, kind: SimEvent["kind"]): SimEvent => ({
    t,
    realT: t,
    kind,
  });
  const events = [
    ev(0, "collision"),
    ev(58, "lights-out"),
    ev(300, "collision"),
  ];

  it("fires once, at the collision, on her port side aft, for the rock's 7 s", () => {
    expect(strikeSpray(concordia, events, -0.5)).toBeNull();
    const a = strikeSpray(concordia, events, 0.5)!;
    expect(a.amount).toBeGreaterThan(0.4);
    expect(a.y).toBeCloseTo(concordia.beam / 2, 6); // port
    expect(a.x).toBeLessThan(0); // aft of midships
    const b = strikeSpray(concordia, events, 6)!;
    expect(b.x).toBeLessThan(a.x); // the rock runs aft along her
    expect(strikeSpray(concordia, events, 7.5)).toBeNull();
    // Never again (a later event of the same kind is not a strike).
    expect(strikeSpray(concordia, events, 301)).toBeNull();
    expect(strikeSpray(concordia, [], 1)).toBeNull();
  });
});

describe("her boats to the harbour", () => {
  it("keep to the water from her side to off Giglio Porto", () => {
    // At her rest: about 1015, 564, heading about 200° (yaw −150°).
    const yaw = (-150 * Math.PI) / 180;
    for (const side of ["starboard", "port"] as const)
      for (let i = 0; i < 26; i += 1) {
        const out = side === "port" ? 1 : -1;
        const launch: [number, number] = [
          1015 - Math.sin(yaw) * 20 * out,
          564 + Math.cos(yaw) * 20 * out,
        ];
        const route = boatRoute(launch, side, 1015, 564, yaw, i);
        let len = 0;
        for (let k = 1; k < route.length; k += 1)
          len += Math.hypot(
            route[k][0] - route[k - 1][0],
            route[k][1] - route[k - 1][1]
          );
        for (let d = 10; d <= len; d += 10) {
          const [x, y] = alongRoute(route, d);
          expect(floorAt(concordia, x, y)).toBeLessThan(-1.5);
        }
        const [sx, sy] = harbourSlot(i);
        expect(floorAt(concordia, sx, sy)).toBeLessThan(-2);
      }
  });
});

describe("the strike's white water stays at the rock", () => {
  it("is where the rock is as she runs on past it, never aft of frame 52", () => {
    const events: SimEvent[] = [{ t: 0, realT: 0, kind: "collision" }];
    expect(strikeSpray(concordia, events, 3, 12)!.x).toBeCloseTo(
      frameX(124) - 12,
      6
    );
    expect(strikeSpray(concordia, events, 6.9, 500)!.x).toBeCloseTo(
      concordia.heel!.rock!.x,
      6
    );
  });
});

describe("the rock in her side is the one she struck", () => {
  /** A straight run at `ms` m/s from the strike at t = 0, 0.5 s frames. */
  function straight(ms: number, endT: number): SimTrack {
    const frames: SimFrame[] = [];
    for (let t = 0; t <= endT; t += 0.5)
      frames.push({
        t,
        realT: t,
        bodies: [
          { part: "whole", x: ms * t, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 },
        ],
        water: [],
        waterAboardT: 0,
        trimDeg: 0,
        listDeg: 0,
        power: 1,
        groundedParts: [],
      });
    return {
      frames,
      events: [{ t: 0, realT: 0, kind: "collision" }],
      outcome: "floated",
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT,
    };
  }
  const rockX = concordia.heel!.rock!.x;
  const run = frameX(124) - rockX; // frame 124 to frame 52, 52.2 m

  it("lodges when the islet she runs past reaches frame 52", () => {
    // Her sim's 8.3 kn (4.27 m/s): about 12 s, not the gash's 7.
    const t = rockLodgedT(straight(4.27, 60), rockX)!;
    expect(t).toBeCloseTo(run / 4.27, 0);
    expect(t).toBeGreaterThan(7);
    // At 15.5 kn (the gash's pace) it is the gash's 7 s.
    expect(rockLodgedT(straight(run / 7, 60), rockX)).toBeCloseTo(7, 0);
  });

  it("waits for the track, and has none without a strike", () => {
    expect(rockLodgedT(straight(4.27, 5), rockX)).toBeUndefined();
    expect(rockLodgedT({ ...straight(4.27, 60), events: [] }, rockX)).toBe(
      null
    );
    // Stopped dead: the gash's 7 s.
    expect(rockLodgedT(straight(0, 70), rockX)).toBe(7);
  });

  it("the white water lasts until it lodges, then stops", () => {
    const events: SimEvent[] = [{ t: 0, realT: 0, kind: "collision" }];
    const until = run / 4.27;
    expect(strikeSpray(concordia, events, 10, 42.7, until)).not.toBeNull();
    expect(strikeSpray(concordia, events, until + 0.5, 60, until)).toBeNull();
  });
});

describe("building the island a step at a time", () => {
  it("takes many small steps and ends with the same island", () => {
    const g = giglioBuild();
    let steps = 0;
    let r = g.next();
    while (!r.done) {
      steps += 1;
      r = g.next();
    }
    // A column of the grid (about 170 points) or a few dozen houses a step.
    expect(steps).toBeGreaterThan(500);
    expect(Array.from(r.value.floor.position)).toEqual(
      Array.from(geo.floor.position)
    );
    expect(r.value.grass.matrices.length).toBe(
      (r.value.grass.cards.length / 5) * 16
    );
    expect(r.value.land.normal.length).toBe(r.value.land.position.length);
  });

  it("stops each frame's share when its budget is spent", () => {
    // A clock that ticks 1 ms each read: a 3 ms budget runs 3 steps.
    let ms = 0;
    const now = () => (ms += 1);
    let calls = 0;
    let done = null;
    while (!done) {
      done = stepGiglio(3, now);
      calls += 1;
    }
    expect(calls).toBeGreaterThan(150);
    expect(giglioReady()).toBe(done);
  });
});

describe("the rocks face out", () => {
  it("turns the islets', spurs' and ridge's faces up and out, not in", () => {
    const r = rockArrays();
    let up = 0;
    let down = 0;
    for (let i = 0; i < r.normal.length / 3; i += 1) {
      if (r.normal[i * 3 + 1] > 0.2) up += 1;
      if (r.normal[i * 3 + 1] < -0.2) down += 1;
    }
    expect(up).toBeGreaterThan(down * 10);
  });
});
